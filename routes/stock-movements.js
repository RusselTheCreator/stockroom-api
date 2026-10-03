// =====================================================
// STOCK MOVEMENTS ROUTES
// View audit log of all inventory changes
// Append-only historical records
// All routes require JWT authentication
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const apiRequestJWTCheck = require('../middleware/apiRequestJWTCheck');
const { isIntegerId } = require('../utils/validation');

// APPLY JWT AUTHENTICATION TO ALL STOCK MOVEMENT ROUTES
router.use(apiRequestJWTCheck);

// REJECT NON-INTEGER PATH IDS BEFORE THEY HIT POSTGRES
router.param('id', (req, res, next, id) => {
  if (!isIntegerId(id)) {
    return res.status(400).json({ error: 'Invalid id. Must be an integer.' });
  }
  return next();
});

// =====================================================
// GET /api/stock-movements
// Retrieve all stock movements with filters
// =====================================================

/**
 * @swagger
 * /api/stock-movements:
 *   get:
 *     summary: Get all stock movements
 *     tags: [Stock Movements]
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
 *         name: movement_type
 *         schema:
 *           type: string
 *           enum: [receive, issue, adjust]
 *         description: Filter by movement type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: List of stock movements
 */
router.get('/', async (req, res) => {
  try {
    // STEP 1: GET QUERY PARAMETERS FOR FILTERING
    const { product_id, warehouse_id, movement_type, limit = 100 } = req.query;
    
    // STEP 2: BUILD BASE QUERY WITH JOINS
    let query = `
      SELECT 
        sm.*,
        p.sku, p.name as product_name, p.unit,
        w.name as warehouse_name,
        u.username as user_username
      FROM stock_movements sm
      INNER JOIN products p ON sm.product_id = p.id
      INNER JOIN warehouses w ON sm.warehouse_id = w.id
      INNER JOIN users u ON sm.user_id = u.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    // STEP 3: ADD FILTERS IF PROVIDED
    if (product_id) {
      query += ` AND sm.product_id = $${paramCount++}`;
      queryParams.push(product_id);
    }
    
    if (warehouse_id) {
      query += ` AND sm.warehouse_id = $${paramCount++}`;
      queryParams.push(warehouse_id);
    }
    
    if (movement_type) {
      query += ` AND sm.movement_type = $${paramCount++}`;
      queryParams.push(movement_type);
    }
    
    // STEP 4: ADD ORDER AND LIMIT
    query += ` ORDER BY sm.created_at DESC LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit) || 100);
    
    // STEP 5: EXECUTE QUERY
    const result = await pool.query(query, queryParams);
    
    // STEP 6: RETURN MOVEMENTS LIST
    return res.status(200).json({
      message: 'Stock movements retrieved successfully.',
      count: result.rows.length,
      movements: result.rows
    });
    
  } catch (error) {
    console.error('Get stock movements error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/stock-movements/:id
// Retrieve a single stock movement by ID
// =====================================================

/**
 * @swagger
 * /api/stock-movements/{id}:
 *   get:
 *     summary: Get stock movement by ID
 *     tags: [Stock Movements]
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
 *         description: Stock movement details
 *       404:
 *         description: Movement not found
 */
router.get('/:id', async (req, res) => {
  try {
    // STEP 1: GET MOVEMENT ID FROM URL
    const { id } = req.params;
    
    // STEP 2: QUERY DATABASE WITH JOINS
    const result = await pool.query(
      `SELECT 
        sm.*,
        p.sku, p.name as product_name, p.unit,
        w.name as warehouse_name, w.location as warehouse_location,
        u.username as user_username, u.email as user_email
       FROM stock_movements sm
       INNER JOIN products p ON sm.product_id = p.id
       INNER JOIN warehouses w ON sm.warehouse_id = w.id
       INNER JOIN users u ON sm.user_id = u.id
       WHERE sm.id = $1`,
      [id]
    );
    
    // STEP 3: CHECK IF MOVEMENT EXISTS
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock movement not found.' });
    }
    
    // STEP 4: RETURN MOVEMENT DATA
    return res.status(200).json({
      message: 'Stock movement retrieved successfully.',
      movement: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get stock movement error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/stock-movements/product/:product_id/history
// Get complete movement history for a specific product
// =====================================================

/**
 * @swagger
 * /api/stock-movements/product/{product_id}/history:
 *   get:
 *     summary: Get movement history for a product
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product movement history
 */
router.get('/product/:product_id/history', async (req, res) => {
  try {
    // STEP 1: GET PRODUCT ID FROM URL
    const { product_id } = req.params;
    
    // STEP 2: VERIFY PRODUCT EXISTS
    const productCheck = await pool.query(
      'SELECT id, sku, name FROM products WHERE id = $1',
      [product_id]
    );
    
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    // STEP 3: GET ALL MOVEMENTS FOR THIS PRODUCT
    const result = await pool.query(
      `SELECT 
        sm.*,
        w.name as warehouse_name,
        u.username as user_username
       FROM stock_movements sm
       INNER JOIN warehouses w ON sm.warehouse_id = w.id
       INNER JOIN users u ON sm.user_id = u.id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC`,
      [product_id]
    );
    
    // STEP 4: RETURN MOVEMENT HISTORY
    return res.status(200).json({
      message: 'Product movement history retrieved successfully.',
      product: productCheck.rows[0],
      count: result.rows.length,
      movements: result.rows
    });
    
  } catch (error) {
    console.error('Get product history error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/stock-movements/warehouse/:warehouse_id/history
// Get complete movement history for a specific warehouse
// =====================================================

/**
 * @swagger
 * /api/stock-movements/warehouse/{warehouse_id}/history:
 *   get:
 *     summary: Get movement history for a warehouse
 *     tags: [Stock Movements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: warehouse_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Warehouse movement history
 */
router.get('/warehouse/:warehouse_id/history', async (req, res) => {
  try {
    // STEP 1: GET WAREHOUSE ID FROM URL
    const { warehouse_id } = req.params;
    
    // STEP 2: VERIFY WAREHOUSE EXISTS
    const warehouseCheck = await pool.query(
      'SELECT id, name, location FROM warehouses WHERE id = $1',
      [warehouse_id]
    );
    
    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found.' });
    }
    
    // STEP 3: GET ALL MOVEMENTS FOR THIS WAREHOUSE
    const result = await pool.query(
      `SELECT 
        sm.*,
        p.sku, p.name as product_name,
        u.username as user_username
       FROM stock_movements sm
       INNER JOIN products p ON sm.product_id = p.id
       INNER JOIN users u ON sm.user_id = u.id
       WHERE sm.warehouse_id = $1
       ORDER BY sm.created_at DESC`,
      [warehouse_id]
    );
    
    // STEP 4: RETURN MOVEMENT HISTORY
    return res.status(200).json({
      message: 'Warehouse movement history retrieved successfully.',
      warehouse: warehouseCheck.rows[0],
      count: result.rows.length,
      movements: result.rows
    });
    
  } catch (error) {
    console.error('Get warehouse history error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
