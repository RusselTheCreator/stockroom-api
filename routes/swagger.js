// =====================================================
// SWAGGER DOCUMENTATION CONFIGURATION
// OpenAPI 3.0 specification for StockRoom API
// =====================================================

const swaggerJsdoc = require('swagger-jsdoc');

// =====================================================
// SWAGGER DEFINITION
// Base API information and server configuration
// =====================================================
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'StockRoom API',
    version: '1.0.0',
    description: 'Production-ready inventory management REST API with JWT authentication and AI agent integration',
    contact: {
      name: 'API Support',
      email: 'support@stockroom.local'
    }
  },
  servers: [
    {
      url: 'http://localhost:3100',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token from /api/authentication/login'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['Admin', 'User'] },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          sku: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          unit: { type: 'string' },
          unit_price: { type: 'number' },
          reorder_level: { type: 'integer' },
          supplier_id: { type: 'integer' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Supplier: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      Warehouse: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          location: { type: 'string' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      StockLevel: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          product_id: { type: 'integer' },
          warehouse_id: { type: 'integer' },
          quantity: { type: 'integer' },
          last_updated: { type: 'string', format: 'date-time' }
        }
      },
      StockMovement: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          product_id: { type: 'integer' },
          warehouse_id: { type: 'integer' },
          movement_type: { type: 'string', enum: ['receive', 'issue', 'adjust'] },
          quantity: { type: 'integer' },
          reason: { type: 'string' },
          user_id: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  tags: [
    { name: 'Authentication', description: 'User registration and login' },
    { name: 'Products', description: 'Product management' },
    { name: 'Suppliers', description: 'Supplier management' },
    { name: 'Warehouses', description: 'Warehouse management' },
    { name: 'Stock', description: 'Stock level management and operations' },
    { name: 'Stock Movements', description: 'Inventory movement history' },
    { name: 'AI Agent', description: 'AI-powered inventory analysis' }
  ]
};

// =====================================================
// SWAGGER OPTIONS
// Files to scan for JSDoc annotations
// =====================================================
const swaggerOptions = {
  swaggerDefinition,
  apis: ['./routes/*.js', './index.js']
};

// =====================================================
// GENERATE SWAGGER SPECIFICATION
// =====================================================
const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
