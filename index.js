// =====================================================
// STOCKROOM API - MAIN APPLICATION FILE
// Production-ready inventory management REST API
// =====================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// IMPORT MIDDLEWARE
const logger = require('./middleware/logger');

// IMPORT ROUTES
const authenticationRoutes = require('./routes/authentication');
const productsRoutes = require('./routes/products');
const suppliersRoutes = require('./routes/suppliers');
const warehousesRoutes = require('./routes/warehouses');
const stockRoutes = require('./routes/stock');
const stockMovementsRoutes = require('./routes/stock-movements');
const agentRoutes = require('./routes/agent');

// IMPORT SWAGGER
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./routes/swagger');

// =====================================================
// CREATE EXPRESS APPLICATION
// =====================================================
const app = express();
const PORT = process.env.PORT || 3100;

// =====================================================
// MIDDLEWARE SETUP
// =====================================================

// ENABLE CORS FOR ALL ORIGINS
app.use(cors());

// PARSE JSON REQUEST BODIES
app.use(express.json());

// REJECT MALFORMED JSON WITH 400 (do not leak the parser exception)
app.use((error, req, res, next) => {
  if (error && (error.type === 'entity.parse.failed' || (error instanceof SyntaxError && error.status === 400))) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  return next(error);
});

// LOG ALL REQUESTS
app.use(logger);

// =====================================================
// HEALTH CHECK ENDPOINT
// Returns server status - no authentication required
// =====================================================

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is running
 */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// =====================================================
// API ROUTES MOUNTING
// All business logic routes mounted under /api prefix
// =====================================================

// AUTHENTICATION ROUTES (PUBLIC)
app.use('/api/authentication', authenticationRoutes);

// PRODUCTS ROUTES (JWT REQUIRED)
app.use('/api/products', productsRoutes);

// SUPPLIERS ROUTES (JWT REQUIRED)
app.use('/api/suppliers', suppliersRoutes);

// WAREHOUSES ROUTES (JWT REQUIRED)
app.use('/api/warehouses', warehousesRoutes);

// STOCK ROUTES (JWT REQUIRED)
app.use('/api/stock', stockRoutes);

// STOCK MOVEMENTS ROUTES (JWT REQUIRED)
app.use('/api/stock-movements', stockMovementsRoutes);

// AI AGENT ROUTES (JWT REQUIRED)
app.use('/api/agent', agentRoutes);

// =====================================================
// SWAGGER API DOCUMENTATION
// Interactive API documentation at /api/docs
// =====================================================
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'StockRoom API Docs',
  customCss: '.swagger-ui .topbar { display: none }'
}));

// =====================================================
// ROOT ENDPOINT
// API information and links
// =====================================================
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'StockRoom API',
    version: '1.0.0',
    description: 'Production-ready inventory management REST API',
    documentation: '/api/docs',
    health: '/health',
    endpoints: {
      authentication: '/api/authentication',
      products: '/api/products',
      suppliers: '/api/suppliers',
      warehouses: '/api/warehouses',
      stock: '/api/stock',
      stockMovements: '/api/stock-movements',
      agent: '/api/agent'
    }
  });
});

// =====================================================
// 404 HANDLER
// Returns error for undefined routes
// =====================================================
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found.',
    path: req.path,
    method: req.method
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// Catches all unhandled errors
// =====================================================
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error.',
    message: error.message 
  });
});

// =====================================================
// START SERVER
// Listen on configured port
// =====================================================
app.listen(PORT, () => {
  console.log('=====================================================');
  console.log('  📦 STOCKROOM API SERVER');
  console.log('=====================================================');
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  🌍 Health check: http://localhost:${PORT}/health`);
  console.log(`  📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`  🤖 AI Provider: ${process.env.AI_PROVIDER || 'mock'}`);
  console.log('=====================================================');
});

module.exports = app;
