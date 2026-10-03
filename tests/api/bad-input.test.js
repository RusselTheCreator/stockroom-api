// =====================================================
// API TESTS - BAD INPUT
// Confirmed validation defects must return 400
// =====================================================

const request = require('supertest');
const app = require('../../index');
const pool = require('../../database/db');

describe('Bad input returns 400', () => {
  let authToken;
  let warehouseId;

  beforeAll(async () => {
    const response = await request(app)
      .post('/api/authentication/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });
    authToken = response.body.jwtToken;

    const warehouse = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Bad Input Warehouse', location: 'Test Bay' });
    warehouseId = warehouse.body.warehouse.id;
  });

  afterAll(async () => {
    if (warehouseId) {
      await pool.query('DELETE FROM warehouses WHERE id = $1', [warehouseId]);
    }
    await pool.end();
  });

  test('malformed JSON returns 400 without the parser exception', async () => {
    const response = await request(app)
      .post('/api/authentication/login')
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid JSON in request body.');
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/SyntaxError|Unexpected|position|entity\.parse/i);
  });

  test.each([
    '/api/products/abc',
    '/api/suppliers/abc',
    '/api/warehouses/abc',
    '/api/stock/abc',
    '/api/stock-movements/abc'
  ])('GET %s returns 400 for a non-integer id', async (path) => {
    const response = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/integer/i);
    expect(JSON.stringify(response.body)).not.toMatch(/invalid input syntax|syntax error/i);
  });

  test('POST /api/warehouses rejects non-string name and location', async () => {
    const response = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 5, location: true });

    expect(response.status).toBe(400);
    expect(response.body.warehouse).toBeUndefined();
    expect(response.body.error).toMatch(/string/i);
  });

  test('PUT /api/warehouses rejects non-string name and location', async () => {
    const response = await request(app)
      .put(`/api/warehouses/${warehouseId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 5, location: true });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/string/i);

    const stored = await pool.query('SELECT name, location FROM warehouses WHERE id = $1', [warehouseId]);
    expect(stored.rows[0].name).toBe('Bad Input Warehouse');
    expect(stored.rows[0].location).toBe('Test Bay');
  });

  test('POST /api/agent/ask rejects a non-string question', async () => {
    const response = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: 5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/string/i);
    expect(response.body.details).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/trim/i);
  });

  test('POST /api/agent/reorder-advice rejects a non-integer product_id', async () => {
    const response = await request(app)
      .post('/api/agent/reorder-advice')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ product_id: 'abc' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/product_id/i);
    expect(response.body.details).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/invalid input syntax|postgres/i);
  });
});
