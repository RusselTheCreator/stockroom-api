// =====================================================
// PRODUCTS ROUTES
// Full CRUD operations for product management
// All routes require JWT authentication
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const apiRequestJWTCheck = require('../middleware/apiRequestJWTCheck');
const { isRequired, isPositiveNumber } = require('../utils/validation');

// APPLY JWT AUTHENTICATION TO ALL PRODUCT ROUTES
router.use(apiRequestJWTCheck);

// =====================================================
// GET /api/products
// Retrieve all products with optional filters
// =====================================================

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *         description: Filter to show only active products
 *     responses:
 *       200:
 *         description: List of products
 */
router.get('/', async (req, res) => {
  try {
    // STEP 1: GET QUERY PARAMETERS FOR FILTERING
    const { active_only } = req.query;
    
    // STEP 2: BUILD SQL QUERY WITH OPTIONAL FILTER
    let query = `
      SELECT p.*, s.name as supplier_name, u.username as created_by_username
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
    `;
    
    const queryParams = [];
    
    // STEP 3: ADD ACTIVE FILTER IF REQUESTED
    if (active_only === 'true') {
      query += ' WHERE p.is_active = true';
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    // STEP 4: EXECUTE QUERY
    const result = await pool.query(query, queryParams);
    
    // STEP 5: RETURN PRODUCTS LIST
    return res.status(200).json({
      message: 'Products retrieved successfully.',
      count: result.rows.length,
      products: result.rows
    });
    
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// GET /api/products/:id
// Retrieve a single product by ID
// =====================================================

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
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
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/:id', async (req, res) => {
  try {
    // STEP 1: GET PRODUCT ID FROM URL PARAMETERS
    const { id } = req.params;
    
    // STEP 2: QUERY DATABASE FOR PRODUCT WITH JOINS
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name, u.username as created_by_username
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );
    
    // STEP 3: CHECK IF PRODUCT EXISTS
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    // STEP 4: RETURN PRODUCT DATA
    return res.status(200).json({
      message: 'Product retrieved successfully.',
      product: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// POST /api/products
// Create a new product
// =====================================================

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sku
 *               - name
 *               - unit
 *               - unit_price
 *             properties:
 *               sku:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               unit:
 *                 type: string
 *               unit_price:
 *                 type: number
 *               reorder_level:
 *                 type: integer
 *               supplier_id:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', async (req, res) => {
  try {
    // STEP 1: EXTRACT PRODUCT DATA FROM REQUEST BODY
    const {
      sku,
      name,
      description,
      unit,
      unit_price,
      reorder_level = 0,
      supplier_id,
      is_active = true
    } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS
    if (!isRequired(sku)) {
      return res.status(400).json({ error: 'SKU is required.' });
    }
    if (!isRequired(name)) {
      return res.status(400).json({ error: 'Product name is required.' });
    }
    if (!isRequired(unit)) {
      return res.status(400).json({ error: 'Unit is required.' });
    }
    if (!isRequired(unit_price) || !isPositiveNumber(unit_price)) {
      return res.status(400).json({ error: 'Valid unit price is required.' });
    }
    if (!isPositiveNumber(reorder_level)) {
      return res.status(400).json({ error: 'Reorder level must be a positive number.' });
    }
    
    // STEP 3: CHECK IF SKU ALREADY EXISTS
    const skuCheck = await pool.query(
      'SELECT id FROM products WHERE sku = $1',
      [sku]
    );
    
    if (skuCheck.rows.length > 0) {
      return res.status(400).json({ error: 'SKU already exists.' });
    }
    
    // STEP 4: IF SUPPLIER ID PROVIDED, VERIFY IT EXISTS
    if (supplier_id) {
      const supplierCheck = await pool.query(
        'SELECT id FROM suppliers WHERE id = $1',
        [supplier_id]
      );
      
      if (supplierCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Supplier not found.' });
      }
    }
    
    // STEP 5: INSERT NEW PRODUCT INTO DATABASE
    const result = await pool.query(
      `INSERT INTO products 
       (sku, name, description, unit, unit_price, reorder_level, supplier_id, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [sku, name, description, unit, unit_price, reorder_level, supplier_id, is_active, req.user.id]
    );
    
    // STEP 6: RETURN SUCCESS RESPONSE WITH NEW PRODUCT
    return res.status(201).json({
      message: 'Product created successfully.',
      product: result.rows[0]
    });
    
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// PUT /api/products/:id
// Update an existing product
// =====================================================

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Products]
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
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.put('/:id', async (req, res) => {
  try {
    // STEP 1: GET PRODUCT ID FROM URL
    const { id } = req.params;
    
    // STEP 2: EXTRACT UPDATE DATA FROM REQUEST BODY
    const {
      sku,
      name,
      description,
      unit,
      unit_price,
      reorder_level,
      supplier_id,
      is_active
    } = req.body;
    
    // STEP 3: CHECK IF PRODUCT EXISTS
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );
    
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    // STEP 4: VALIDATE UPDATED VALUES IF PROVIDED
    if (unit_price !== undefined && !isPositiveNumber(unit_price)) {
      return res.status(400).json({ error: 'Unit price must be a positive number.' });
    }
    if (reorder_level !== undefined && !isPositiveNumber(reorder_level)) {
      return res.status(400).json({ error: 'Reorder level must be a positive number.' });
    }
    
    // STEP 5: IF SKU IS BEING CHANGED, CHECK FOR DUPLICATES
    if (sku) {
      const skuCheck = await pool.query(
        'SELECT id FROM products WHERE sku = $1 AND id != $2',
        [sku, id]
      );
      
      if (skuCheck.rows.length > 0) {
        return res.status(400).json({ error: 'SKU already exists.' });
      }
    }
    
    // STEP 6: IF SUPPLIER ID PROVIDED, VERIFY IT EXISTS
    if (supplier_id) {
      const supplierCheck = await pool.query(
        'SELECT id FROM suppliers WHERE id = $1',
        [supplier_id]
      );
      
      if (supplierCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Supplier not found.' });
      }
    }
    
    // STEP 7: BUILD UPDATE QUERY DYNAMICALLY
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (sku !== undefined) {
      updates.push(`sku = $${paramCount++}`);
      values.push(sku);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (unit !== undefined) {
      updates.push(`unit = $${paramCount++}`);
      values.push(unit);
    }
    if (unit_price !== undefined) {
      updates.push(`unit_price = $${paramCount++}`);
      values.push(unit_price);
    }
    if (reorder_level !== undefined) {
      updates.push(`reorder_level = $${paramCount++}`);
      values.push(reorder_level);
    }
    if (supplier_id !== undefined) {
      updates.push(`supplier_id = $${paramCount++}`);
      values.push(supplier_id);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // STEP 8: ADD ID AS FINAL PARAMETER
    values.push(id);
    
    // STEP 9: EXECUTE UPDATE QUERY
    const result = await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    // STEP 10: RETURN UPDATED PRODUCT
    return res.status(200).json({
      message: 'Product updated successfully.',
      product: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// =====================================================
// DELETE /api/products/:id
// Delete a product (soft delete by setting is_active = false)
// =====================================================

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
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
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete('/:id', async (req, res) => {
  try {
    // STEP 1: GET PRODUCT ID FROM URL
    const { id } = req.params;
    
    // STEP 2: CHECK IF PRODUCT EXISTS
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );
    
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    // STEP 3: SOFT DELETE - SET IS_ACTIVE TO FALSE
    await pool.query(
      'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    // STEP 4: RETURN SUCCESS RESPONSE
    return res.status(200).json({
      message: 'Product deleted successfully.'
    });
    
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
