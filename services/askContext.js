// =====================================================
// ASK CONTEXT
// Builds a bounded, question-specific snapshot for POST /api/agent/ask.
// Password hashes are never selected. There is no orders table.
// =====================================================

const pool = require('../database/db');

const LIMITS = {
  users: 25,
  products: 25,
  suppliers: 25,
  warehouses: 25,
  stock: 40,
  movements: 15,
  overviewProducts: 10,
  overviewSuppliers: 10,
  overviewWarehouses: 10,
  overviewStock: 10,
  overviewMovements: 5
};

const ORDERS_MESSAGE = 'This application does not track purchase or sales orders.';

/**
 * CLASSIFY A NATURAL-LANGUAGE QUESTION
 * Picks the tables that should be loaded. An empty match becomes a
 * small overview rather than a single canned summary.
 */
function classifyQuestion(question) {
  const q = String(question).toLowerCase();
  const topics = new Set();

  if (/\b(users?|usernames?|accounts?|staff|employees?|team members?|roles?|admins?)\b/.test(q)) {
    topics.add('users');
  }
  // "reorder" must not count as an order. Word boundaries keep it out.
  if (/\b(purchase orders?|sales orders?|orders?|invoices?)\b/.test(q)) {
    topics.add('orders');
  }
  if (/\b(suppliers?|vendors?)\b/.test(q)) {
    topics.add('suppliers');
  }
  if (/\b(warehouses?|distribution centers?)\b/.test(q)) {
    topics.add('warehouses');
  }
  if (/\b(stock levels?|stocks?|inventor(?:y|ies)|quantit(?:y|ies)|on hand|low stock|reorder levels?|stock value)\b/.test(q)) {
    topics.add('stock');
  }
  if (/\b(products?|skus?|catalog|unit prices?)\b/.test(q)) {
    topics.add('products');
  }
  if (/\b(stock movements?|movements?|movement history|adjustments?)\b/.test(q) || /\b(received|issued)\b/.test(q)) {
    topics.add('movements');
  }

  if (topics.size === 0) {
    topics.add('overview');
  }
  return topics;
}

function money(value) {
  const number = Number(value || 0);
  return number.toFixed(2);
}

async function countOf(sql) {
  const result = await pool.query(sql);
  return result.rows[0].count;
}

async function loadUsers() {
  const count = await countOf('SELECT COUNT(*)::int AS count FROM users');
  const result = await pool.query(
    `SELECT id, username, email, role, is_active, created_at
     FROM users
     ORDER BY id
     LIMIT $1`,
    [LIMITS.users]
  );
  return { count, returned: result.rows.length, limit: LIMITS.users, rows: result.rows };
}

async function loadProducts(limit) {
  const count = await countOf('SELECT COUNT(*)::int AS count FROM products');
  const result = await pool.query(
    `SELECT p.id, p.sku, p.name, p.unit, p.unit_price, p.reorder_level, p.is_active,
            s.name AS supplier_name
     FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     ORDER BY p.name
     LIMIT $1`,
    [limit]
  );
  return {
    count,
    returned: result.rows.length,
    limit,
    rows: result.rows.map(row => ({ ...row, unit_price: money(row.unit_price) }))
  };
}

async function loadSuppliers(limit) {
  const count = await countOf('SELECT COUNT(*)::int AS count FROM suppliers');
  const result = await pool.query(
    `SELECT id, name, email, phone, address, is_active
     FROM suppliers
     ORDER BY name
     LIMIT $1`,
    [limit]
  );
  return { count, returned: result.rows.length, limit, rows: result.rows };
}

async function loadWarehouses(limit) {
  const count = await countOf('SELECT COUNT(*)::int AS count FROM warehouses');
  const result = await pool.query(
    `SELECT id, name, location, is_active
     FROM warehouses
     ORDER BY name
     LIMIT $1`,
    [limit]
  );
  return { count, returned: result.rows.length, limit, rows: result.rows };
}

async function loadStock(limit) {
  const summary = await pool.query(`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(sl.quantity * p.unit_price), 0) AS total_value,
           COUNT(*) FILTER (WHERE sl.quantity < p.reorder_level AND p.is_active = true)::int AS low_stock_count
    FROM stock_levels sl
    INNER JOIN products p ON p.id = sl.product_id
  `);
  const result = await pool.query(
    `SELECT p.sku, p.name AS product_name, w.name AS warehouse_name,
            sl.quantity, p.reorder_level, p.unit, p.unit_price
     FROM stock_levels sl
     INNER JOIN products p ON p.id = sl.product_id
     INNER JOIN warehouses w ON w.id = sl.warehouse_id
     ORDER BY p.name, w.name
     LIMIT $1`,
    [limit]
  );
  const row = summary.rows[0];
  return {
    count: row.count,
    low_stock_count: row.low_stock_count,
    total_value: money(row.total_value),
    returned: result.rows.length,
    limit,
    rows: result.rows.map(item => ({ ...item, unit_price: money(item.unit_price) }))
  };
}

async function loadMovements(limit, includeActor) {
  const count = await countOf('SELECT COUNT(*)::int AS count FROM stock_movements');
  const actorSelect = includeActor ? ', u.username AS performed_by' : '';
  const actorJoin = includeActor ? 'LEFT JOIN users u ON u.id = sm.user_id' : '';
  const result = await pool.query(
    `SELECT sm.id, sm.movement_type, sm.quantity, sm.reason, sm.created_at,
            p.name AS product_name, p.sku, w.name AS warehouse_name
            ${actorSelect}
     FROM stock_movements sm
     INNER JOIN products p ON p.id = sm.product_id
     INNER JOIN warehouses w ON w.id = sm.warehouse_id
     ${actorJoin}
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT $1`,
    [limit]
  );
  return {
    count,
    returned: result.rows.length,
    limit,
    note: 'Most recent movements only. The full movement history is not included.',
    rows: result.rows
  };
}

/**
 * BUILD CONTEXT FOR ONE QUESTION
 * Non-admins asking only about users are denied. Mixed questions omit users.
 * @returns {Promise<{denied:true,status:number,body:object}|{denied:false,context:object}>}
 */
async function buildAskContext(question, role) {
  const topics = classifyQuestion(question);
  const isAdmin = role === 'Admin';

  let usersOmitted = false;
  if (topics.has('users') && !isAdmin) {
    const otherData = [...topics].filter(topic => topic !== 'users' && topic !== 'orders');
    if (otherData.length === 0) {
      return {
        denied: true,
        status: 403,
        body: { error: 'User records are admin-only.' }
      };
    }
    topics.delete('users');
    usersOmitted = true;
  }

  const context = {
    topics: [...topics],
    bounds: 'Context includes only the tables relevant to the question, with row limits and total counts. Full movement history is not included.'
  };

  if (usersOmitted) {
    context.access_note = 'User records are admin-only and were omitted from this answer.';
  }

  if (topics.has('orders')) {
    context.orders = {
      tracked: false,
      message: ORDERS_MESSAGE
    };
  }

  const overview = topics.has('overview');

  if (topics.has('users')) {
    context.users = await loadUsers();
  }
  if (topics.has('products') || overview) {
    const limit = overview && !topics.has('products') ? LIMITS.overviewProducts : LIMITS.products;
    context.products = await loadProducts(limit);
  }
  if (topics.has('suppliers') || overview) {
    const limit = overview && !topics.has('suppliers') ? LIMITS.overviewSuppliers : LIMITS.suppliers;
    context.suppliers = await loadSuppliers(limit);
  }
  if (topics.has('warehouses') || overview) {
    const limit = overview && !topics.has('warehouses') ? LIMITS.overviewWarehouses : LIMITS.warehouses;
    context.warehouses = await loadWarehouses(limit);
  }
  if (topics.has('stock') || overview) {
    const limit = overview && !topics.has('stock') ? LIMITS.overviewStock : LIMITS.stock;
    context.stock = await loadStock(limit);
  }
  if (topics.has('movements') || overview) {
    const limit = overview && !topics.has('movements') ? LIMITS.overviewMovements : LIMITS.movements;
    context.movements = await loadMovements(limit, isAdmin);
  }

  return { denied: false, context };
}

module.exports = {
  ORDERS_MESSAGE,
  classifyQuestion,
  buildAskContext
};
