// =====================================================
// STOCK LEVELS ROUTES
// Manage inventory quantities at warehouses
// Includes receive, issue, and adjust operations
// All routes require JWT authentication
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const apiRequestJWTCheck = require('../middleware/apiRequestJWTCheck');
const authorizeUserRole = require('../middleware/authorizeUserRole');
const { withUnitPrice } = require('../utils/money');
const { isRequired, isPositiveNumber, isInteger, isIntegerId } = require('../utils/validation');

// APPLY JWT AUTHENTICATION TO ALL STOCK ROUTES
router.use(apiRequestJWTCheck);

// REJECT NON-INTEGER PATH IDS BEFORE THEY HIT POSTGRES
router.param('id', (req, res, next, id) => {
  if (!isIntegerId(id)) {
    return res.status(400).json({ error: 'Invalid id. Must be an integer.' });
  }
  return next();
});

// =====================================================
// GET /api/stock
// Retrieve all stock levels with product and warehouse info
// =====================================================

/**
 * @swagger
 * /api/stock:
 *   get:
 *     summary: Get all stock levels
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: integer
 *         description: Filter by product ID
 *       - in: query
 *         name: warehouse_id
 *         schema:
 *           type: integer
 *         description: Filter by warehouse ID
 *       - in: query
 *         name: low_stock
 *         schema:
 *           type: boolean
 *         description: Show only items below reorder level
 *     responses:
 *       200:
 *         description: List of stock levels
 */
router.get('/', async (req, res) => {
  try {
    // STEP 1: GET QUERY PARAMETERS FOR FILTERING
    const { product_id, warehouse_id, low_stock } = req.query;
    
    // STEP 2: BUILD BASE QUERY WITH JOINS
    let query = `
      SELECT 
        sl.*, 
        p.sku, p.name as product_name, p.unit, p.reorder_level,
        w.name as warehouse_name, w.location as warehouse_location,
        u.username as updated_by_username
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      INNER JOIN warehouses w ON sl.warehouse_id = w.id
      LEFT JOIN users u ON sl.updated_by = u.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    // STEP 3: ADD FILTERS IF PROVIDED
    if (product_id) {
      query += ` AND sl.product_id = $${paramCount++}`;
      queryParams.push(product_id);
    }
    
    if (warehouse_id) {
      query += ` AND sl.warehouse_id = $${paramCount++}`;
      queryParams.push(warehouse_id);
    }
    
    if (low_stock === 'true') {
      query += ` AND sl.quantity < p.reorder_level`;
    }
    
    query += ' ORDER BY sl.last_updated DESC';
    
    // STEP 4: EXECUTE QUERY
    const result = await pool.query(query, queryParams);
    
    // STEP 5: RETURN STOCK LEVELS
    return res.status(200).json({
      message: 'Stock levels retrieved successfully.',
      count: result.rows.length,
      stock: result.rows.map(withUnitPrice)
    });
    
  } catch (error) {
    console.error('Get stock levels error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/stock/:id
// Retrieve a single stock level by ID
// =====================================================

/**
 * @swagger
 * /api/stock/{id}:
 *   get:
 *     summary: Get stock level by ID
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stock level details
 *       404:
 *         description: Stock level not found
 *       400:
 *         description: Invalid id. Must be an integer.
 */
router.get('/:id', async (req, res) => {
  try {
    // STEP 1: GET STOCK LEVEL ID FROM URL
    const { id } = req.params;
    
    // STEP 2: QUERY DATABASE WITH JOINS
    const result = await pool.query(
      `SELECT 
        sl.*, 
        p.sku, p.name as product_name, p.unit, p.reorder_level,
        w.name as warehouse_name, w.location as warehouse_location,
        u.username as updated_by_username
       FROM stock_levels sl
       INNER JOIN products p ON sl.product_id = p.id
       INNER JOIN warehouses w ON sl.warehouse_id = w.id
       LEFT JOIN users u ON sl.updated_by = u.id
       WHERE sl.id = $1`,
      [id]
    );
    
    // STEP 3: CHECK IF STOCK LEVEL EXISTS
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock level not found.' });
    }
    
    // STEP 4: RETURN STOCK LEVEL DATA
    return res.status(200).json({
      message: 'Stock level retrieved successfully.',
      stock: withUnitPrice(result.rows[0])
    });
    
  } catch (error) {
    console.error('Get stock level error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// POST /api/stock/receive
// Receive inventory (increase stock quantity)
// =====================================================

/**
 * @swagger
 * /api/stock/receive:
 *   post:
 *     summary: Receive stock (increase quantity)
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - warehouse_id
 *               - quantity
 *             properties:
 *               product_id:
 *                 type: integer
 *               warehouse_id:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock received successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin only. A User JWT receives {"error":"Access denied. Insufficient permissions."}.
 */
router.post('/receive', authorizeUserRole('Admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    // STEP 1: EXTRACT REQUEST DATA
    const { product_id, warehouse_id, quantity, reason } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS
    if (!isRequired(product_id) || !isInteger(product_id)) {
      return res.status(400).json({ error: 'Valid product ID is required.' });
    }
    if (!isRequired(warehouse_id) || !isInteger(warehouse_id)) {
      return res.status(400).json({ error: 'Valid warehouse ID is required.' });
    }
    if (!isRequired(quantity) || !isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }
    
    // STEP 3: BEGIN TRANSACTION
    await client.query('BEGIN');
    
    // STEP 4: VERIFY PRODUCT AND WAREHOUSE EXIST
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    const warehouseCheck = await client.query('SELECT id FROM warehouses WHERE id = $1', [warehouse_id]);
    if (warehouseCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Warehouse not found.' });
    }
    
    // STEP 5: CHECK IF STOCK LEVEL RECORD EXISTS
    const stockCheck = await client.query(
      'SELECT id, quantity FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2',
      [product_id, warehouse_id]
    );
    
    let updatedStock;
    
    if (stockCheck.rows.length > 0) {
      // STEP 6A: UPDATE EXISTING STOCK LEVEL
      const currentQuantity = stockCheck.rows[0].quantity;
      const newQuantity = currentQuantity + quantity;
      
      const updateResult = await client.query(
        `UPDATE stock_levels 
         SET quantity = $1, last_updated = CURRENT_TIMESTAMP, updated_by = $2
         WHERE product_id = $3 AND warehouse_id = $4
         RETURNING *`,
        [newQuantity, req.user.id, product_id, warehouse_id]
      );
      
      updatedStock = updateResult.rows[0];
    } else {
      // STEP 6B: CREATE NEW STOCK LEVEL RECORD
      const insertResult = await client.query(
        `INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [product_id, warehouse_id, quantity, req.user.id]
      );
      
      updatedStock = insertResult.rows[0];
    }
    
    // STEP 7: CREATE STOCK MOVEMENT RECORD
    await client.query(
      `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reason, user_id)
       VALUES ($1, $2, 'receive', $3, $4, $5)`,
      [product_id, warehouse_id, quantity, reason || 'Stock received', req.user.id]
    );
    
    // STEP 8: COMMIT TRANSACTION
    await client.query('COMMIT');
    
    // STEP 9: RETURN SUCCESS RESPONSE
    return res.status(200).json({
      message: 'Stock received successfully.',
      stock: withUnitPrice(updatedStock)
    });
    
  } catch (error) {
    // ROLLBACK ON ERROR
    await client.query('ROLLBACK');
    console.error('Receive stock error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// =====================================================
// POST /api/stock/issue
// Issue inventory (decrease stock quantity)
// =====================================================

/**
 * @swagger
 * /api/stock/issue:
 *   post:
 *     summary: Issue stock (decrease quantity)
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - warehouse_id
 *               - quantity
 *             properties:
 *               product_id:
 *                 type: integer
 *               warehouse_id:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock issued successfully
 *       400:
 *         description: Insufficient stock or validation error
 *       403:
 *         description: Admin only. A User JWT receives {"error":"Access denied. Insufficient permissions."}.
 */
router.post('/issue', authorizeUserRole('Admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    // STEP 1: EXTRACT REQUEST DATA
    const { product_id, warehouse_id, quantity, reason } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS
    if (!isRequired(product_id) || !isInteger(product_id)) {
      return res.status(400).json({ error: 'Valid product ID is required.' });
    }
    if (!isRequired(warehouse_id) || !isInteger(warehouse_id)) {
      return res.status(400).json({ error: 'Valid warehouse ID is required.' });
    }
    if (!isRequired(quantity) || !isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }
    
    // STEP 3: BEGIN TRANSACTION
    await client.query('BEGIN');
    
    // STEP 4: GET CURRENT STOCK LEVEL
    const stockCheck = await client.query(
      'SELECT id, quantity FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2',
      [product_id, warehouse_id]
    );
    
    if (stockCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Stock level not found for this product and warehouse.' });
    }
    
    const currentQuantity = stockCheck.rows[0].quantity;
    
    // STEP 5: CHECK IF SUFFICIENT STOCK IS AVAILABLE
    if (currentQuantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient stock available.',
        available: currentQuantity,
        requested: quantity
      });
    }
    
    // STEP 6: UPDATE STOCK LEVEL
    const newQuantity = currentQuantity - quantity;
    
    const updateResult = await client.query(
      `UPDATE stock_levels 
       SET quantity = $1, last_updated = CURRENT_TIMESTAMP, updated_by = $2
       WHERE product_id = $3 AND warehouse_id = $4
       RETURNING *`,
      [newQuantity, req.user.id, product_id, warehouse_id]
    );
    
    // STEP 7: CREATE STOCK MOVEMENT RECORD (negative quantity for issue)
    await client.query(
      `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reason, user_id)
       VALUES ($1, $2, 'issue', $3, $4, $5)`,
      [product_id, warehouse_id, -quantity, reason || 'Stock issued', req.user.id]
    );
    
    // STEP 8: COMMIT TRANSACTION
    await client.query('COMMIT');
    
    // STEP 9: RETURN SUCCESS RESPONSE
    return res.status(200).json({
      message: 'Stock issued successfully.',
      stock: withUnitPrice(updateResult.rows[0])
    });
    
  } catch (error) {
    // ROLLBACK ON ERROR
    await client.query('ROLLBACK');
    console.error('Issue stock error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// =====================================================
// POST /api/stock/adjust
// Adjust inventory (set to specific quantity)
// =====================================================

/**
 * @swagger
 * /api/stock/adjust:
 *   post:
 *     summary: Adjust stock to specific quantity
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - warehouse_id
 *               - new_quantity
 *             properties:
 *               product_id:
 *                 type: integer
 *               warehouse_id:
 *                 type: integer
 *               new_quantity:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock adjusted successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin only. A User JWT receives {"error":"Access denied. Insufficient permissions."}.
 */
router.post('/adjust', authorizeUserRole('Admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    // STEP 1: EXTRACT REQUEST DATA
    const { product_id, warehouse_id, new_quantity, reason } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS
    if (!isRequired(product_id) || !isInteger(product_id)) {
      return res.status(400).json({ error: 'Valid product ID is required.' });
    }
    if (!isRequired(warehouse_id) || !isInteger(warehouse_id)) {
      return res.status(400).json({ error: 'Valid warehouse ID is required.' });
    }
    if (!isRequired(new_quantity) || !isInteger(new_quantity) || new_quantity < 0) {
      return res.status(400).json({ error: 'New quantity must be a non-negative integer.' });
    }
    
    // STEP 3: BEGIN TRANSACTION
    await client.query('BEGIN');
    
    // STEP 4: GET CURRENT STOCK LEVEL
    const stockCheck = await client.query(
      'SELECT id, quantity FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2',
      [product_id, warehouse_id]
    );
    
    let currentQuantity = 0;
    let updatedStock;
    
    if (stockCheck.rows.length > 0) {
      currentQuantity = stockCheck.rows[0].quantity;
      
      // STEP 5A: UPDATE EXISTING STOCK LEVEL
      const updateResult = await client.query(
        `UPDATE stock_levels 
         SET quantity = $1, last_updated = CURRENT_TIMESTAMP, updated_by = $2
         WHERE product_id = $3 AND warehouse_id = $4
         RETURNING *`,
        [new_quantity, req.user.id, product_id, warehouse_id]
      );
      
      updatedStock = updateResult.rows[0];
    } else {
      // STEP 5B: CREATE NEW STOCK LEVEL RECORD
      const insertResult = await client.query(
        `INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [product_id, warehouse_id, new_quantity, req.user.id]
      );
      
      updatedStock = insertResult.rows[0];
    }
    
    // STEP 6: CALCULATE ADJUSTMENT AMOUNT
    const adjustmentAmount = new_quantity - currentQuantity;
    
    // STEP 7: CREATE STOCK MOVEMENT RECORD
    await client.query(
      `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reason, user_id)
       VALUES ($1, $2, 'adjust', $3, $4, $5)`,
      [product_id, warehouse_id, adjustmentAmount, reason || 'Stock adjustment', req.user.id]
    );
    
    // STEP 8: COMMIT TRANSACTION
    await client.query('COMMIT');
    
    // STEP 9: RETURN SUCCESS RESPONSE
    return res.status(200).json({
      message: 'Stock adjusted successfully.',
      stock: withUnitPrice(updatedStock),
      adjustment: adjustmentAmount
    });
    
  } catch (error) {
    // ROLLBACK ON ERROR
    await client.query('ROLLBACK');
    console.error('Adjust stock error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

module.exports = router;
