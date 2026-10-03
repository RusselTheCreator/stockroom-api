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
const { buildAskContext } = require('../services/askContext');
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
 *       400:
 *         description: Non-integer product_id or warehouse_id. Errors are 'product_id must be an integer.' or 'warehouse_id must be an integer.'.
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
 *     summary: Ask a natural-language question about application data
 *     description: >
 *       Answers from bounded rows (products, suppliers, warehouses, stock, recent movements).
 *       User records are admin-only and never include passwords. Purchase and sales orders
 *       are not tracked. Reorder advice is a separate endpoint.
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
 *                 description: Question about products, suppliers, warehouses, stock, movements, or (Admin) users
 *     responses:
 *       200:
 *         description: AI-generated answer grounded in selected rows
 *       400:
 *         description: Missing or non-string question. Missing/non-string values return 'Question must be a string.'; an empty string returns 'Question is required.'.
 *       403:
 *         description: User records requested by a non-Admin
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

    // STEP 3: LOAD ONLY THE TABLES THE QUESTION NEEDS
    // Admin may see users. Non-admins never receive user rows.
    // Orders are not a table in this application.
    const built = await buildAskContext(question.trim(), req.user && req.user.role);
    if (built.denied) {
      return res.status(built.status).json(built.body);
    }
    
    // STEP 4: GET AI PROVIDER INSTANCE
    const aiProvider = getAIProvider();
    
    // STEP 5: CALL AI PROVIDER TO ANSWER QUESTION
    console.log(`Using AI provider: ${aiProvider.name}`);
    const response = await aiProvider.answerQuestion(question.trim(), built.context);
    
    // STEP 6: RETURN AI-GENERATED ANSWER
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
