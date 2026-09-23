// =====================================================
// API INTEGRATION TESTS - AUTHENTICATION
// Tests for user registration and login endpoints
// =====================================================

const request = require('supertest');
const app = require('../../index');
const pool = require('../../database/db');

describe('Authentication API', () => {
  
  // CLEAN UP TEST USERS AFTER TESTS
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE 'testuser%'");
    await pool.end();
  });
  
  describe('POST /api/authentication/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/authentication/register')
        .send({
          username: 'testuser1',
          email: 'testuser1@test.com',
          password: 'password123',
          role: 'User'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('registered');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.username).toBe('testuser1');
      expect(response.body.user).not.toHaveProperty('password');
    });
    
    test('should reject registration with existing username', async () => {
      const response = await request(app)
        .post('/api/authentication/register')
        .send({
          username: 'testuser1',
          email: 'another@test.com',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
    
    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/authentication/register')
        .send({
          username: 'testuser2',
          email: 'invalid-email',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });
    
    test('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/authentication/register')
        .send({
          username: 'testuser3',
          email: 'test3@test.com',
          password: '123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });
  });
  
  describe('POST /api/authentication/login', () => {
    // CREATE A TEST USER BEFORE LOGIN TESTS
    beforeAll(async () => {
      await request(app)
        .post('/api/authentication/register')
        .send({
          username: 'logintest',
          email: 'logintest@test.com',
          password: 'password123'
        });
    });
    
    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/authentication/login')
        .send({
          username: 'logintest',
          password: 'password123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('successful');
      expect(response.body).toHaveProperty('jwtToken');
      expect(response.body.user.username).toBe('logintest');
    });
    
    test('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/authentication/login')
        .send({
          username: 'logintest',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
    
    test('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/authentication/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
    
    test('should reject login without credentials', async () => {
      const response = await request(app)
        .post('/api/authentication/login')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });
  
});
