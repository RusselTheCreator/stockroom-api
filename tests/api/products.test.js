// =====================================================
// API INTEGRATION TESTS - PRODUCTS
// Tests for product CRUD endpoints
// =====================================================

const request = require('supertest');
const app = require('../../index');
const pool = require('../../database/db');

describe('Products API', () => {
  let authToken;
  let userToken;
  let createdProductId;
  
  // LOGIN BEFORE TESTS TO GET AUTH TOKEN
  beforeAll(async () => {
    // USE SEEDED ADMIN USER
    const response = await request(app)
      .post('/api/authentication/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });
    
    authToken = response.body.jwtToken;

    const userResponse = await request(app)
      .post('/api/authentication/login')
      .send({
        username: 'user',
        password: 'user123'
      });
    userToken = userResponse.body.jwtToken;
  });
  
  // CLEAN UP TEST PRODUCTS
  afterAll(async () => {
    await pool.query("DELETE FROM products WHERE sku LIKE 'TEST-%'");
  });
  
  describe('POST /api/products', () => {
    test('should create a new product with auth', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: 'TEST-001',
          name: 'Test Product',
          description: 'A test product',
          unit: 'piece',
          unit_price: 19.99,
          reorder_level: 50
        });
      
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('created');
      expect(response.body.product.sku).toBe('TEST-001');
      expect(typeof response.body.product.unit_price).toBe('number');
      expect(response.body.product.unit_price).toBe(19.99);
      createdProductId = response.body.product.id;
    });

    test('should reject product creation for a User and leave no row', async () => {
      const before = await pool.query('SELECT id FROM products WHERE sku = $1', ['TEST-USER-403']);
      expect(before.rows.length).toBe(0);

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sku: 'TEST-USER-403',
          name: 'Forbidden Product',
          unit: 'piece',
          unit_price: 12.50
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Access denied. Insufficient permissions.' });

      const after = await pool.query('SELECT id FROM products WHERE sku = $1', ['TEST-USER-403']);
      expect(after.rows.length).toBe(0);
    });
    
    test('should reject product creation without auth', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          sku: 'TEST-002',
          name: 'Test Product 2',
          unit: 'piece',
          unit_price: 29.99
        });
      
      expect(response.status).toBe(401);
    });
    
    test('should reject duplicate SKU', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: 'TEST-001',
          name: 'Duplicate SKU Product',
          unit: 'piece',
          unit_price: 9.99
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });
  
  describe('GET /api/products', () => {
    test('should get all products with auth', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
      const widget = response.body.products.find(product => product.sku === 'WIDGET-001');
      expect(widget).toBeDefined();
      expect(typeof widget.unit_price).toBe('number');
      expect(widget.unit_price).toBe(12.5);
    });
    
    test('should reject without auth', async () => {
      const response = await request(app)
        .get('/api/products');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/products/:id', () => {
    test('should get product by ID', async () => {
      const response = await request(app)
        .get(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.product.id).toBe(createdProductId);
    });
    
    test('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/999999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('PUT /api/products/:id', () => {
    test('should update product', async () => {
      const response = await request(app)
        .put(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test Product',
          unit_price: 24.99
        });
      
      expect(response.status).toBe(200);
      expect(response.body.product.name).toBe('Updated Test Product');
      expect(typeof response.body.product.unit_price).toBe('number');
      expect(response.body.product.unit_price).toBe(24.99);
    });
  });
  
  describe('DELETE /api/products/:id', () => {
    test('should reject delete for a User and leave the row unchanged', async () => {
      const before = await pool.query(
        'SELECT sku, name, is_active, unit_price, updated_at FROM products WHERE id = $1',
        [createdProductId]
      );
      expect(before.rows.length).toBe(1);

      const response = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Access denied. Insufficient permissions.' });

      const after = await pool.query(
        'SELECT sku, name, is_active, unit_price, updated_at FROM products WHERE id = $1',
        [createdProductId]
      );
      expect(after.rows).toEqual(before.rows);
    });

    test('should soft delete product', async () => {
      const response = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });
  });
  
});
