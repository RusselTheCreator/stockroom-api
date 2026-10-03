// =====================================================
// SUPPLIERS ROUTES
// Full CRUD operations for supplier management
// All routes require JWT authentication
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const apiRequestJWTCheck = require('../middleware/apiRequestJWTCheck');
const authorizeUserRole = require('../middleware/authorizeUserRole');
const { isRequired, isValidEmail, isIntegerId } = require('../utils/validation');

// APPLY JWT AUTHENTICATION TO ALL SUPPLIER ROUTES
router.use(apiRequestJWTCheck);

// REJECT NON-INTEGER PATH IDS BEFORE THEY HIT POSTGRES
router.param('id', (req, res, next, id) => {
  if (!isIntegerId(id)) {
    return res.status(400).json({ error: 'Invalid id. Must be an integer.' });
  }
  return next();
});

// =====================================================
// GET /api/suppliers
// Retrieve all suppliers
// =====================================================

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: Get all suppliers
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suppliers
 */
router.get('/', async (req, res) => {
  try {
    // STEP 1: QUERY ALL SUPPLIERS WITH CREATOR INFO
    const result = await pool.query(
      `SELECT s.*, u.username as created_by_username
       FROM suppliers s
       LEFT JOIN users u ON s.created_by = u.id
       ORDER BY s.created_at DESC`
    );
    
    // STEP 2: RETURN SUPPLIERS LIST
    return res.status(200).json({
      message: 'Suppliers retrieved successfully.',
      count: result.rows.length,
      suppliers: result.rows
    });
    
  } catch (error) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/suppliers/:id
// Retrieve a single supplier by ID
// =====================================================

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     tags: [Suppliers]
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
 *         description: Supplier details
 *       404:
 *         description: Supplier not found
 */
router.get('/:id', async (req, res) => {
  try {
    // STEP 1: GET SUPPLIER ID FROM URL
    const { id } = req.params;
    
    // STEP 2: QUERY DATABASE FOR SUPPLIER
    const result = await pool.query(
      `SELECT s.*, u.username as created_by_username
       FROM suppliers s
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [id]
    );
    
    // STEP 3: CHECK IF SUPPLIER EXISTS
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    
    // STEP 4: RETURN SUPPLIER DATA
    return res.status(200).json({
      message: 'Supplier retrieved successfully.',
      supplier: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get supplier error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// POST /api/suppliers
// Create a new supplier
// =====================================================

/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     summary: Create a new supplier
 *     tags: [Suppliers]
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
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Supplier created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', authorizeUserRole('Admin'), async (req, res) => {
  try {
    // STEP 1: EXTRACT SUPPLIER DATA FROM REQUEST BODY
    const { name, email, phone, address, is_active = true } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS
    if (!isRequired(name)) {
      return res.status(400).json({ error: 'Supplier name is required.' });
    }
    
    // STEP 3: VALIDATE EMAIL FORMAT IF PROVIDED
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    
    // STEP 4: INSERT NEW SUPPLIER INTO DATABASE
    const result = await pool.query(
      `INSERT INTO suppliers (name, email, phone, address, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone, address, is_active, req.user.id]
    );
    
    // STEP 5: RETURN SUCCESS RESPONSE
    return res.status(201).json({
      message: 'Supplier created successfully.',
      supplier: result.rows[0]
    });
    
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// PUT /api/suppliers/:id
// Update an existing supplier
// =====================================================

/**
 * @swagger
 * /api/suppliers/{id}:
 *   put:
 *     summary: Update a supplier
 *     tags: [Suppliers]
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
 *         description: Supplier updated successfully
 *       404:
 *         description: Supplier not found
 */
router.put('/:id', async (req, res) => {
  try {
    // STEP 1: GET SUPPLIER ID FROM URL
    const { id } = req.params;
    
    // STEP 2: EXTRACT UPDATE DATA FROM REQUEST BODY
    const { name, email, phone, address, is_active } = req.body;
    
    // STEP 3: CHECK IF SUPPLIER EXISTS
    const supplierCheck = await pool.query(
      'SELECT id FROM suppliers WHERE id = $1',
      [id]
    );
    
    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    
    // STEP 4: VALIDATE EMAIL IF PROVIDED
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    
    // STEP 5: BUILD UPDATE QUERY DYNAMICALLY
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      values.push(address);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    // STEP 6: EXECUTE UPDATE QUERY
    const result = await pool.query(
      `UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    // STEP 7: RETURN UPDATED SUPPLIER
    return res.status(200).json({
      message: 'Supplier updated successfully.',
      supplier: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update supplier error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// DELETE /api/suppliers/:id
// Delete a supplier (soft delete)
// =====================================================

/**
 * @swagger
 * /api/suppliers/{id}:
 *   delete:
 *     summary: Delete a supplier
 *     tags: [Suppliers]
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
 *         description: Supplier deleted successfully
 *       404:
 *         description: Supplier not found
 */
router.delete('/:id', authorizeUserRole('Admin'), async (req, res) => {
  try {
    // STEP 1: GET SUPPLIER ID FROM URL
    const { id } = req.params;
    
    // STEP 2: CHECK IF SUPPLIER EXISTS
    const supplierCheck = await pool.query(
      'SELECT id FROM suppliers WHERE id = $1',
      [id]
    );
    
    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    
    // STEP 3: SOFT DELETE - SET IS_ACTIVE TO FALSE
    await pool.query(
      'UPDATE suppliers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    // STEP 4: RETURN SUCCESS RESPONSE
    return res.status(200).json({
      message: 'Supplier deleted successfully.'
    });
    
  } catch (error) {
    console.error('Delete supplier error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
