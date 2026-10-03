// =====================================================
// FUNCTIONAL TESTS - COMPLETE INVENTORY FLOW
// End-to-end business workflow tests
// =====================================================

const request = require('supertest');
const app = require('../../index');
const pool = require('../../database/db');

describe('Complete Inventory Flow', () => {
  let authToken;
  let userId;
  let productId;
  let supplierId;
  let warehouseId;
  
  // CLEANUP AFTER ALL TESTS
  afterAll(async () => {
    if (productId) {
      await pool.query('DELETE FROM stock_movements WHERE product_id = $1', [productId]);
      await pool.query('DELETE FROM stock_levels WHERE product_id = $1', [productId]);
      await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    }
    if (supplierId) {
      await pool.query('DELETE FROM suppliers WHERE id = $1', [supplierId]);
    }
    if (warehouseId) {
      await pool.query('DELETE FROM warehouses WHERE id = $1', [warehouseId]);
    }
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });
  
  describe('Full workflow from registration to inventory management', () => {
    
    test('Step 1: Register new user', async () => {
      const response = await request(app)
        .post('/api/authentication/register')
        .send({
          username: 'flowtest',
          email: 'flowtest@test.com',
          password: 'password123',
          role: 'User'
        });
      
      expect(response.status).toBe(201);
      userId = response.body.user.id;
    });
    
    test('Step 2: Login to get JWT token', async () => {
      const response = await request(app)
        .post('/api/authentication/login')
        .send({
          username: 'flowtest',
          password: 'password123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jwtToken');
      authToken = response.body.jwtToken;
    });
    
    test('Step 3: Create a supplier', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Flow Test Supplier',
          email: 'supplier@test.com',
          phone: '+1-555-0199'
        });
      
      expect(response.status).toBe(201);
      supplierId = response.body.supplier.id;
    });
    
    test('Step 4: Create a warehouse', async () => {
      const response = await request(app)
        .post('/api/warehouses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Flow Test Warehouse',
          location: 'Test City, State 12345'
        });
      
      expect(response.status).toBe(201);
      warehouseId = response.body.warehouse.id;
    });
    
    test('Step 5: Create a product', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: 'FLOW-TEST-001',
          name: 'Flow Test Product',
          description: 'Product for functional test',
          unit: 'box',
          unit_price: 25.50,
          reorder_level: 50,
          supplier_id: supplierId
        });
      
      expect(response.status).toBe(201);
      productId = response.body.product.id;
    });
    
    test('Step 6: Receive initial stock', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: 100,
          reason: 'Initial inventory'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.stock.quantity).toBe(100);
    });
    
    test('Step 7: Check stock levels', async () => {
      const response = await request(app)
        .get(`/api/stock?product_id=${productId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.stock.length).toBeGreaterThan(0);
      expect(response.body.stock[0].quantity).toBe(100);
    });
    
    test('Step 8: Ask AI agent about inventory', async () => {
      const response = await request(app)
        .post('/api/agent/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question: 'What is the total inventory value?'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('answer');
      expect(response.body.provider).toBe('mock');
    });
    
    test('Step 9: Issue stock', async () => {
      const response = await request(app)
        .post('/api/stock/issue')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: 60,
          reason: 'Customer order'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.stock.quantity).toBe(40);
    });
    
    test('Step 10: Check if reorder is needed', async () => {
      const response = await request(app)
        .post('/api/agent/reorder-advice')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('advice');
      // Product should be below reorder level (40 < 50)
      expect(response.body.advice.length).toBeGreaterThan(0);
    });
    
    test('Step 11: View movement history', async () => {
      const response = await request(app)
        .get(`/api/stock-movements/product/${productId}/history`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.movements.length).toBe(2); // receive + issue
      expect(response.body.movements[0].movement_type).toBe('issue');
      expect(response.body.movements[1].movement_type).toBe('receive');
    });
    
    test('Step 12: Adjust stock after physical count', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          new_quantity: 45,
          reason: 'Physical inventory count adjustment'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.stock.quantity).toBe(45);
      expect(response.body.adjustment).toBe(5);
    });
    
  });
  
});
