// =====================================================
// WAREHOUSES ROUTES
// Full CRUD operations for warehouse management
// All routes require JWT authentication
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const apiRequestJWTCheck = require('../middleware/apiRequestJWTCheck');
const authorizeUserRole = require('../middleware/authorizeUserRole');
const { isRequired, isIntegerId } = require('../utils/validation');

// APPLY JWT AUTHENTICATION TO ALL WAREHOUSE ROUTES
router.use(apiRequestJWTCheck);

// REJECT NON-INTEGER PATH IDS BEFORE THEY HIT POSTGRES
router.param('id', (req, res, next, id) => {
  if (!isIntegerId(id)) {
    return res.status(400).json({ error: 'Invalid id. Must be an integer.' });
  }
  return next();
});

// =====================================================
// GET /api/warehouses
// Retrieve all warehouses
// =====================================================

/**
 * @swagger
 * /api/warehouses:
 *   get:
 *     summary: Get all warehouses
 *     tags: [Warehouses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of warehouses
 */
router.get('/', async (req, res) => {
  try {
    // STEP 1: QUERY ALL WAREHOUSES WITH CREATOR INFO
    const result = await pool.query(
      `SELECT w.*, u.username as created_by_username
       FROM warehouses w
       LEFT JOIN users u ON w.created_by = u.id
       ORDER BY w.created_at DESC`
    );
    
    // STEP 2: RETURN WAREHOUSES LIST
    return res.status(200).json({
      message: 'Warehouses retrieved successfully.',
      count: result.rows.length,
      warehouses: result.rows
    });
    
  } catch (error) {
    console.error('Get warehouses error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/warehouses/:id
// Retrieve a single warehouse by ID
// =====================================================

/**
 * @swagger
 * /api/warehouses/{id}:
 *   get:
 *     summary: Get warehouse by ID
 *     tags: [Warehouses]
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
 *         description: Warehouse details
 *       404:
 *         description: Warehouse not found
 */
router.get('/:id', async (req, res) => {
  try {
    // STEP 1: GET WAREHOUSE ID FROM URL
    const { id } = req.params;
    
    // STEP 2: QUERY DATABASE FOR WAREHOUSE
    const result = await pool.query(
      `SELECT w.*, u.username as created_by_username
       FROM warehouses w
       LEFT JOIN users u ON w.created_by = u.id
       WHERE w.id = $1`,
      [id]
    );
    
    // STEP 3: CHECK IF WAREHOUSE EXISTS
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found.' });
    }
    
    // STEP 4: RETURN WAREHOUSE DATA
    return res.status(200).json({
      message: 'Warehouse retrieved successfully.',
      warehouse: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get warehouse error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// POST /api/warehouses
// Create a new warehouse
// =====================================================

/**
 * @swagger
 * /api/warehouses:
 *   post:
 *     summary: Create a new warehouse
 *     tags: [Warehouses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Warehouse created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', authorizeUserRole('Admin'), async (req, res) => {
  try {
    // STEP 1: EXTRACT WAREHOUSE DATA FROM REQUEST BODY
    const { name, location, is_active = true } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS (must be strings; do not coerce numbers or booleans)
    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'Warehouse name must be a string.' });
    }
    if (!isRequired(name)) {
      return res.status(400).json({ error: 'Warehouse name is required.' });
    }
    if (typeof location !== 'string') {
      return res.status(400).json({ error: 'Warehouse location must be a string.' });
    }
    if (!isRequired(location)) {
      return res.status(400).json({ error: 'Warehouse location is required.' });
    }
    
    // STEP 3: INSERT NEW WAREHOUSE INTO DATABASE
    const result = await pool.query(
      `INSERT INTO warehouses (name, location, is_active, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, location, is_active, req.user.id]
    );
    
    // STEP 4: RETURN SUCCESS RESPONSE
    return res.status(201).json({
      message: 'Warehouse created successfully.',
      warehouse: result.rows[0]
    });
    
  } catch (error) {
    console.error('Create warehouse error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// PUT /api/warehouses/:id
// Update an existing warehouse
// =====================================================

/**
 * @swagger
 * /api/warehouses/{id}:
 *   put:
 *     summary: Update a warehouse
 *     tags: [Warehouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Warehouse updated successfully
 *       404:
 *         description: Warehouse not found
 */
router.put('/:id', async (req, res) => {
  try {
    // STEP 1: GET WAREHOUSE ID FROM URL
    const { id } = req.params;
    
    // STEP 2: EXTRACT UPDATE DATA FROM REQUEST BODY
    const { name, location, is_active } = req.body;

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'Warehouse name must be a string.' });
    }
    if (location !== undefined && typeof location !== 'string') {
      return res.status(400).json({ error: 'Warehouse location must be a string.' });
    }
    
    // STEP 3: CHECK IF WAREHOUSE EXISTS
    const warehouseCheck = await pool.query(
      'SELECT id FROM warehouses WHERE id = $1',
      [id]
    );
    
    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found.' });
    }
    
    // STEP 4: BUILD UPDATE QUERY DYNAMICALLY
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    // STEP 5: EXECUTE UPDATE QUERY
    const result = await pool.query(
      `UPDATE warehouses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    // STEP 6: RETURN UPDATED WAREHOUSE
    return res.status(200).json({
      message: 'Warehouse updated successfully.',
      warehouse: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update warehouse error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// DELETE /api/warehouses/:id
// Delete a warehouse (soft delete)
// =====================================================

/**
 * @swagger
 * /api/warehouses/{id}:
 *   delete:
 *     summary: Delete a warehouse
 *     tags: [Warehouses]
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
 *         description: Warehouse deleted successfully
 *       404:
 *         description: Warehouse not found
 */
router.delete('/:id', authorizeUserRole('Admin'), async (req, res) => {
  try {
    // STEP 1: GET WAREHOUSE ID FROM URL
    const { id } = req.params;
    
    // STEP 2: CHECK IF WAREHOUSE EXISTS
    const warehouseCheck = await pool.query(
      'SELECT id FROM warehouses WHERE id = $1',
      [id]
    );
    
    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found.' });
    }
    
    // STEP 3: SOFT DELETE - SET IS_ACTIVE TO FALSE
    await pool.query(
      'UPDATE warehouses SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    // STEP 4: RETURN SUCCESS RESPONSE
    return res.status(200).json({
      message: 'Warehouse deleted successfully.'
    });
    
  } catch (error) {
    console.error('Delete warehouse error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
