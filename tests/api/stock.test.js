// =====================================================
// API INTEGRATION TESTS - STOCK OPERATIONS
// Tests for stock receive, issue, and adjust operations
// =====================================================

const request = require('supertest');
const app = require('../../index');
const pool = require('../../database/db');

describe('Stock Operations API', () => {
  let authToken;
  let testProductId;
  let testWarehouseId;
  
  // SETUP: LOGIN AND CREATE TEST DATA
  beforeAll(async () => {
    // LOGIN
    const loginResponse = await request(app)
      .post('/api/authentication/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });
    
    authToken = loginResponse.body.jwtToken;
    
    // CREATE TEST PRODUCT
    const productResponse = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sku: 'STOCK-TEST-001',
        name: 'Stock Test Product',
        unit: 'piece',
        unit_price: 10.00,
        reorder_level: 100
      });
    
    testProductId = productResponse.body.product.id;
    
    // CREATE TEST WAREHOUSE
    const warehouseResponse = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Warehouse',
        location: 'Test Location'
      });
    
    testWarehouseId = warehouseResponse.body.warehouse.id;
  });
  
  // CLEANUP
  afterAll(async () => {
    await pool.query('DELETE FROM stock_movements WHERE product_id = $1', [testProductId]);
    await pool.query('DELETE FROM stock_levels WHERE product_id = $1', [testProductId]);
    await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
    await pool.query('DELETE FROM warehouses WHERE id = $1', [testWarehouseId]);
  });
  
  describe('POST /api/stock/receive', () => {
    test('should receive stock successfully', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          quantity: 50,
          reason: 'Initial stock'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('received');
      expect(response.body.stock.quantity).toBe(50);
    });
    
    test('should add to existing stock', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          quantity: 30
        });
      
      expect(response.status).toBe(200);
      expect(response.body.stock.quantity).toBe(80);
    });
    
    test('should reject without auth', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          quantity: 10
        });
      
      expect(response.status).toBe(401);
    });
    
    test('should reject invalid quantity', async () => {
      const response = await request(app)
        .post('/api/stock/receive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          quantity: -10
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('POST /api/stock/issue', () => {
    test('should issue stock successfully', async () => {
      const response = await request(app)
        .post('/api/stock/issue')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          quantity: 20,
          reason: 'Order fulfillment'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('issued');
      expect(response.body.stock.quantity).toBe(60);
    });
    
    test('should reject insufficient stock', async () => {
      const response = await request(app)
        .post('/api/stock/issue')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          quantity: 1000
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient');
    });
  });
  
  describe('POST /api/stock/adjust', () => {
    test('should adjust stock to specific quantity', async () => {
      const response = await request(app)
        .post('/api/stock/adjust')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseId,
          new_quantity: 100,
          reason: 'Inventory correction'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('adjusted');
      expect(response.body.stock.quantity).toBe(100);
      expect(response.body.adjustment).toBe(40);
    });
  });
  
  describe('GET /api/stock', () => {
    test('should get all stock levels', async () => {
      const response = await request(app)
        .get('/api/stock')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stock');
      expect(Array.isArray(response.body.stock)).toBe(true);
    });
    
    test('should filter by low stock', async () => {
      const response = await request(app)
        .get('/api/stock?low_stock=true')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });
  });
  
});
