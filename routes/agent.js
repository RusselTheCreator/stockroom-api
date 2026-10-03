// =====================================================
// AI AGENT ROUTES
// Intelligent inventory analysis using pluggable AI providers
// Provides reorder advice and Q&A capabilities
// All routes require JWT authentication
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const apiRequestJWTCheck = require('../middleware/apiRequestJWTCheck');
const { getAIProvider } = require('../services/aiProvider');
const { isIntegerId } = require('../utils/validation');

// APPLY JWT AUTHENTICATION TO ALL AGENT ROUTES
router.use(apiRequestJWTCheck);

// =====================================================
// POST /api/agent/reorder-advice
// Get AI-powered reorder recommendations
// =====================================================

/**
 * @swagger
 * /api/agent/reorder-advice:
 *   post:
 *     summary: Get AI-powered reorder recommendations
 *     tags: [AI Agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: integer
 *                 description: Optional filter by product ID
 *               warehouse_id:
 *                 type: integer
 *                 description: Optional filter by warehouse ID
 *               low_stock_only:
 *                 type: boolean
 *                 default: true
 *                 description: Only analyze items below reorder level
 *     responses:
 *       200:
 *         description: Reorder recommendations
 *       500:
 *         description: AI provider error
 */
router.post('/reorder-advice', async (req, res) => {
  try {
    // STEP 1: EXTRACT FILTER PARAMETERS FROM REQUEST
    const { product_id, warehouse_id, low_stock_only = true } = req.body;

    if (product_id !== undefined && product_id !== null && !isIntegerId(product_id)) {
      return res.status(400).json({ error: 'product_id must be an integer.' });
    }
    if (warehouse_id !== undefined && warehouse_id !== null && !isIntegerId(warehouse_id)) {
      return res.status(400).json({ error: 'warehouse_id must be an integer.' });
    }
    
    // STEP 2: BUILD QUERY TO GET STOCK DATA
    let query = `
      SELECT 
        sl.id,
        sl.product_id,
        p.sku,
        p.name as product_name,
        p.unit,
        p.reorder_level,
        sl.warehouse_id,
        w.name as warehouse_name,
        w.location as warehouse_location,
        sl.quantity
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      INNER JOIN warehouses w ON sl.warehouse_id = w.id
      WHERE p.is_active = true AND w.is_active = true
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
    
    if (low_stock_only) {
      query += ` AND sl.quantity < p.reorder_level`;
    }
    
    query += ' ORDER BY sl.quantity ASC';
    
    // STEP 4: EXECUTE QUERY TO GET STOCK DATA
    const result = await pool.query(query, queryParams);
    
    // STEP 5: CHECK IF ANY DATA TO ANALYZE
    if (result.rows.length === 0) {
      return res.status(200).json({
        message: 'No items need reordering based on current filters.',
        advice: [],
        provider: process.env.AI_PROVIDER || 'mock'
      });
    }
    
    // STEP 6: GET AI PROVIDER INSTANCE
    const aiProvider = getAIProvider();
    
    // STEP 7: CALL AI PROVIDER TO GENERATE ADVICE
    console.log(`Using AI provider: ${aiProvider.name}`);
    const advice = await aiProvider.generateReorderAdvice(result.rows);
    
    // STEP 8: RETURN AI-GENERATED ADVICE
    return res.status(200).json({
      message: 'Reorder advice generated successfully.',
      items_analyzed: result.rows.length,
      ...advice
    });
    
  } catch (error) {
    console.error('Reorder advice error:', error);
    return res.status(500).json({ 
      error: 'Error generating reorder advice.',
      details: error.message 
    });
  }
});

// =====================================================
// POST /api/agent/ask
// Ask AI agent a question about inventory
// =====================================================

/**
 * @swagger
 * /api/agent/ask:
 *   post:
 *     summary: Ask AI agent a question about inventory
 *     tags: [AI Agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: Your inventory question
 *     responses:
 *       200:
 *         description: AI-generated answer
 *       400:
 *         description: Missing question
 *       500:
 *         description: AI provider error
 */
router.post('/ask', async (req, res) => {
  try {
    // STEP 1: EXTRACT QUESTION FROM REQUEST
    const { question } = req.body;
    
    // STEP 2: VALIDATE QUESTION IS A NON-EMPTY STRING
    if (typeof question !== 'string') {
      return res.status(400).json({ error: 'Question must be a string.' });
    }
    if (question.trim() === '') {
      return res.status(400).json({ error: 'Question is required.' });
    }
    
    // STEP 3: GATHER INVENTORY CONTEXT FOR AI
    
    // GET TOTAL PRODUCTS COUNT
    const productsResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = true'
    );
    const totalProducts = parseInt(productsResult.rows[0].count);
    
    // GET TOTAL WAREHOUSES COUNT
    const warehousesResult = await pool.query(
      'SELECT COUNT(*) as count FROM warehouses WHERE is_active = true'
    );
    const totalWarehouses = parseInt(warehousesResult.rows[0].count);
    
    // GET LOW STOCK COUNT
    const lowStockResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE sl.quantity < p.reorder_level AND p.is_active = true
    `);
    const lowStockCount = parseInt(lowStockResult.rows[0].count);
    
    // GET TOTAL STOCK VALUE (approximate)
    const stockValueResult = await pool.query(`
      SELECT SUM(sl.quantity * p.unit_price) as total_value
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE p.is_active = true
    `);
    const totalStockValue = parseFloat(stockValueResult.rows[0].total_value || 0);
    
    // GET RECENT MOVEMENTS COUNT
    const movementsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM stock_movements
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    const recentMovements = parseInt(movementsResult.rows[0].count);
    
    // GET TOP 10 PRODUCTS BY QUANTITY
    const topProductsResult = await pool.query(`
      SELECT 
        p.name,
        p.sku,
        SUM(sl.quantity) as total_quantity,
        p.unit
      FROM stock_levels sl
      INNER JOIN products p ON sl.product_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.sku, p.unit
      ORDER BY total_quantity DESC
      LIMIT 10
    `);
    
    // STEP 4: BUILD CONTEXT OBJECT FOR AI
    const context = {
      total_products: totalProducts,
      total_warehouses: totalWarehouses,
      low_stock_count: lowStockCount,
      total_stock_value: totalStockValue.toFixed(2),
      recent_movements_7days: recentMovements,
      top_products: topProductsResult.rows
    };
    
    // STEP 5: GET AI PROVIDER INSTANCE
    const aiProvider = getAIProvider();
    
    // STEP 6: CALL AI PROVIDER TO ANSWER QUESTION
    console.log(`Using AI provider: ${aiProvider.name}`);
    const response = await aiProvider.answerQuestion(question, context);
    
    // STEP 7: RETURN AI-GENERATED ANSWER
    return res.status(200).json({
      message: 'Question answered successfully.',
      ...response
    });
    
  } catch (error) {
    console.error('Ask agent error:', error);
    return res.status(500).json({ 
      error: 'Error processing question.',
      details: error.message 
    });
  }
});

// =====================================================
// GET /api/agent/status
// Get current AI provider configuration
// =====================================================

/**
 * @swagger
 * /api/agent/status:
 *   get:
 *     summary: Get AI provider status
 *     tags: [AI Agent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI provider information
 */
router.get('/status', async (req, res) => {
  try {
    // STEP 1: GET CURRENT AI PROVIDER
    const aiProvider = getAIProvider();
    
    // STEP 2: RETURN PROVIDER INFO
    return res.status(200).json({
      message: 'AI provider status retrieved.',
      provider: aiProvider.name,
      available_providers: ['openai', 'anthropic', 'bedrock', 'mock'],
      configuration: {
        openai_configured: !!process.env.OPENAI_API_KEY,
        anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
        bedrock_configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      }
    });
    
  } catch (error) {
    console.error('Agent status error:', error);
    return res.status(500).json({ error: 'Error retrieving agent status.' });
  }
});

module.exports = router;
