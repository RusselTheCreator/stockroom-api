// =====================================================
// API INTEGRATION TESTS - AI ASK
// Natural-language questions grounded in application data
// =====================================================

const request = require('supertest');
const app = require('../../index');
const pool = require('../../database/db');

describe('POST /api/agent/ask', () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    process.env.AI_PROVIDER = 'mock';

    const admin = await request(app)
      .post('/api/authentication/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = admin.body.jwtToken;

    const user = await request(app)
      .post('/api/authentication/login')
      .send({ username: 'user', password: 'user123' });
    userToken = user.body.jwtToken;
  });

  test('admin question about users is answered from data and contains no password hash', async () => {
    const hashes = await pool.query('SELECT password_hash FROM users');
    expect(hashes.rows.length).toBeGreaterThan(0);

    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'List all users and their roles' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('mock');
    expect(response.body.answer).toContain('admin@stockroom.local');
    expect(response.body.answer).toContain('user@stockroom.local');
    expect(response.body.answer).toMatch(/users \(count \d+/);
    expect(response.body.context_used.users.count).toBeGreaterThanOrEqual(2);
    expect(response.body.context_used.users.rows.some(row => row.username === 'admin' && row.role === 'Admin')).toBe(true);

    const body = JSON.stringify(response.body);
    for (const row of hashes.rows) {
      expect(body).not.toContain(row.password_hash);
    }
    expect(body).not.toMatch(/password/i);
    expect(response.body.context_used.users.rows[0].password_hash).toBeUndefined();
  });

  test('non-admin cannot get user records', async () => {
    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'List all users and their email addresses' });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/admin-only/i);
    expect(response.body.answer).toBeUndefined();
    expect(response.body.context_used).toBeUndefined();

    const body = JSON.stringify(response.body);
    expect(body).not.toContain('admin@stockroom.local');
    expect(body).not.toContain('user@stockroom.local');
    expect(body).not.toMatch(/password/i);
  });

  test('non-admin inventory question omits users when the question also asks about them', async () => {
    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'List users and also list suppliers' });

    expect(response.status).toBe(200);
    expect(response.body.context_used.users).toBeUndefined();
    expect(response.body.answer).toMatch(/admin-only/i);
    expect(response.body.answer).toContain('TechParts Inc');
    expect(JSON.stringify(response.body)).not.toContain('admin@stockroom.local');
  });

  test('a product question uses real product rows', async () => {
    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'What products are in the catalog?' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('mock');
    expect(response.body.answer).toContain('Standard Widget');
    expect(response.body.answer).toMatch(/products \(count \d+/);
    expect(response.body.context_used.products.rows.some(row => row.sku === 'WIDGET-001')).toBe(true);
    expect(response.body.context_used.users).toBeUndefined();
    expect(response.body.context_used.total_products).toBeUndefined();
  });

  test('a stock question uses real stock rows', async () => {
    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'What are the current stock quantities on hand?' });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain('Standard Widget');
    expect(response.body.context_used.stock.count).toBeGreaterThan(0);
    expect(response.body.context_used.stock.rows.some(row => row.warehouse_name === 'Main Warehouse')).toBe(true);
    expect(response.body.context_used.stock.returned).toBeLessThanOrEqual(response.body.context_used.stock.limit);
    expect(response.body.context_used.users).toBeUndefined();
  });

  test('an orders question does not invent orders', async () => {
    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Which purchase orders and sales orders are open?' });

    expect(response.status).toBe(200);
    expect(response.body.answer).toMatch(/does not track purchase or sales orders/i);
    expect(response.body.context_used.orders).toEqual({
      tracked: false,
      message: 'This application does not track purchase or sales orders.'
    });
    expect(response.body.context_used.orders.rows).toBeUndefined();
    expect(JSON.stringify(response.body.context_used)).not.toMatch(/order_id|purchase_order|sales_order/i);
  });

  test('mock still works without API keys', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const keyNames = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'];
    const saved = {};
    for (const name of keyNames) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
    process.env.AI_PROVIDER = 'mock';

    try {
      const response = await request(app)
        .post('/api/agent/ask')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ question: 'How many suppliers do we have?' });

      expect(response.status).toBe(200);
      expect(response.body.provider).toBe('mock');
      expect(response.body.answer).toContain('TechParts Inc');
      expect(response.body.answer).toMatch(/suppliers \(count \d+/);
      expect(response.body.context_used.suppliers.rows.length).toBeGreaterThan(0);
      expect(response.body.context_used.suppliers.rows.some(row => row.name === 'Global Components')).toBe(true);
    } finally {
      process.env.AI_PROVIDER = previousProvider;
      for (const name of keyNames) {
        if (saved[name] === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = saved[name];
        }
      }
    }
  });

  test('reorder advice still returns mock recommendations', async () => {
    const response = await request(app)
      .post('/api/agent/reorder-advice')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ low_stock_only: true });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('mock');
    expect(Array.isArray(response.body.advice)).toBe(true);
  });
});
