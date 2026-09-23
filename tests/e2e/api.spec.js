// =====================================================
// PLAYWRIGHT E2E TESTS
// Browser-based API testing
// =====================================================

const { test, expect } = require('@playwright/test');

test.describe('StockRoom API E2E Tests', () => {
  
  test('health endpoint returns ok status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('timestamp');
  });
  
  test('swagger documentation is accessible', async ({ page }) => {
    await page.goto('/api/docs');
    
    // WAIT FOR SWAGGER UI TO LOAD
    await page.waitForSelector('.swagger-ui', { timeout: 10000 });
    
    // CHECK THAT API TITLE IS PRESENT
    const title = await page.textContent('.title');
    expect(title).toContain('StockRoom API');
  });
  
  test('authentication flow works', async ({ request }) => {
    // REGISTER NEW USER
    const timestamp = Date.now();
    const registerResponse = await request.post('/api/authentication/register', {
      data: {
        username: `e2euser${timestamp}`,
        email: `e2euser${timestamp}@test.com`,
        password: 'password123',
        role: 'User'
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const registerData = await registerResponse.json();
    expect(registerData.user.username).toBe(`e2euser${timestamp}`);
    
    // LOGIN WITH NEW USER
    const loginResponse = await request.post('/api/authentication/login', {
      data: {
        username: `e2euser${timestamp}`,
        password: 'password123'
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('jwtToken');
    expect(loginData.user.username).toBe(`e2euser${timestamp}`);
    
    // USE TOKEN TO ACCESS PROTECTED ENDPOINT
    const productsResponse = await request.get('/api/products', {
      headers: {
        'Authorization': `Bearer ${loginData.jwtToken}`
      }
    });
    
    expect(productsResponse.ok()).toBeTruthy();
    const productsData = await productsResponse.json();
    expect(productsData).toHaveProperty('products');
  });
  
  test('unauthorized access is rejected', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.error).toContain('token');
  });
  
  test('ai agent status endpoint works', async ({ request }) => {
    // LOGIN FIRST
    const loginResponse = await request.post('/api/authentication/login', {
      data: {
        username: 'admin',
        password: 'admin123'
      }
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.jwtToken;
    
    // GET AGENT STATUS
    const statusResponse = await request.get('/api/agent/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(statusResponse.ok()).toBeTruthy();
    const statusData = await statusResponse.json();
    expect(statusData.provider).toBe('mock');
    expect(statusData.available_providers).toContain('openai');
    expect(statusData.available_providers).toContain('anthropic');
  });
  
  test('root endpoint returns API information', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.name).toBe('StockRoom API');
    expect(data).toHaveProperty('endpoints');
    expect(data.endpoints).toHaveProperty('products');
  });
  
  test('404 for undefined routes', async ({ request }) => {
    const response = await request.get('/api/nonexistent');
    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data.error).toContain('not found');
  });
  
});
