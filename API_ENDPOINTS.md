# StockRoom API - Complete Endpoint Reference

## Base URL
`http://localhost:3100`

## Response Codes
- `200` - Success (GET, PUT, DELETE)
- `201` - Created (POST)
- `400` - Bad Request / Validation Error
- `401` - Unauthorized (No token)
- `403` - Forbidden (Invalid token or insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication Endpoints (Public)

### Register New User
```http
POST /api/authentication/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "password123",
  "role": "User"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully.",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "role": "User",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Login
```http
POST /api/authentication/login
Content-Type: application/json

{
  "username": "john",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful.",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "role": "User"
  },
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Products Endpoints (JWT Required)

**All requests require:** `Authorization: Bearer <token>`

`unit_price` is a JSON number on list, get, create, and update (the `products.unit_price` column stays `DECIMAL`). `12.50` is returned as `12.5`, not `"12.50"`.

**Admin only:** `POST /api/products`, `DELETE /api/products/:id`. A User JWT gets **403**:

```json
{ "error": "Access denied. Insufficient permissions." }
```

The row is not created or changed. GET and PUT stay open to any valid JWT.

### List All Products
```http
GET /api/products
GET /api/products?active_only=true
```

**Response (200):**
```json
{
  "message": "Products retrieved successfully.",
  "count": 3,
  "products": [
    {
      "id": 1,
      "sku": "WIDGET-001",
      "name": "Standard Widget",
      "description": "High-quality standard widget",
      "unit": "piece",
      "unit_price": 12.5,
      "reorder_level": 100,
      "supplier_id": 1,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "supplier_name": "TechParts Inc"
    }
  ]
}
```

### Get Product by ID
```http
GET /api/products/:id
```

### Create Product
```http
POST /api/products
Content-Type: application/json

{
  "sku": "WIDGET-002",
  "name": "Premium Widget",
  "description": "Premium quality widget",
  "unit": "piece",
  "unit_price": 29.99,
  "reorder_level": 50,
  "supplier_id": 1,
  "is_active": true
}
```

### Update Product
```http
PUT /api/products/:id
Content-Type: application/json

{
  "name": "Updated Widget Name",
  "unit_price": 34.99
}
```

### Delete Product
```http
DELETE /api/products/:id
```

---

## Suppliers Endpoints (JWT Required)

**Admin only:** `POST /api/suppliers` and `DELETE /api/suppliers/:id`. User JWT gets **403** `{ "error": "Access denied. Insufficient permissions." }` and the row is unchanged. GET and PUT accept any valid JWT.

### List All Suppliers
```http
GET /api/suppliers
```

### Get Supplier by ID
```http
GET /api/suppliers/:id
```

### Create Supplier
```http
POST /api/suppliers
Content-Type: application/json

{
  "name": "Acme Supplies",
  "email": "sales@acme.com",
  "phone": "+1-555-0100",
  "address": "123 Supply St, City, State 12345",
  "is_active": true
}
```

### Update Supplier
```http
PUT /api/suppliers/:id
Content-Type: application/json

{
  "email": "newsales@acme.com",
  "phone": "+1-555-0101"
}
```

### Delete Supplier
```http
DELETE /api/suppliers/:id
```

---

## Warehouses Endpoints (JWT Required)

**Admin only:** `POST /api/warehouses` and `DELETE /api/warehouses/:id`. User JWT gets **403** `{ "error": "Access denied. Insufficient permissions." }` and the row is unchanged. GET and PUT accept any valid JWT.

### List All Warehouses
```http
GET /api/warehouses
```

### Get Warehouse by ID
```http
GET /api/warehouses/:id
```

### Create Warehouse
```http
POST /api/warehouses
Content-Type: application/json

{
  "name": "Central Warehouse",
  "location": "100 Storage Way, Warehouse City, TX 75001",
  "is_active": true
}
```

### Update Warehouse
```http
PUT /api/warehouses/:id
Content-Type: application/json

{
  "name": "Updated Warehouse Name"
}
```

### Delete Warehouse
```http
DELETE /api/warehouses/:id
```

---

## Stock Endpoints (JWT Required)

GET accepts any valid JWT. `POST /api/stock/receive`, `POST /api/stock/issue`, and `POST /api/stock/adjust` are **Admin only**. A User JWT gets **403** `{ "error": "Access denied. Insufficient permissions." }` and quantities are not changed. If a stock payload includes `unit_price` (or a value derived from it), that field is a JSON number.

### List All Stock Levels
```http
GET /api/stock
GET /api/stock?product_id=1
GET /api/stock?warehouse_id=1
GET /api/stock?low_stock=true
```

**Response (200):**
```json
{
  "message": "Stock levels retrieved successfully.",
  "count": 5,
  "stock": [
    {
      "id": 1,
      "product_id": 1,
      "warehouse_id": 1,
      "quantity": 150,
      "sku": "WIDGET-001",
      "product_name": "Standard Widget",
      "unit": "piece",
      "reorder_level": 100,
      "warehouse_name": "Main Warehouse",
      "last_updated": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Stock Level by ID
```http
GET /api/stock/:id
```

### Receive Stock (Increase Inventory)
```http
POST /api/stock/receive
Content-Type: application/json

{
  "product_id": 1,
  "warehouse_id": 1,
  "quantity": 100,
  "reason": "Purchase order #12345"
}
```

**Response (200):**
```json
{
  "message": "Stock received successfully.",
  "stock": {
    "id": 1,
    "product_id": 1,
    "warehouse_id": 1,
    "quantity": 250,
    "last_updated": "2024-01-01T00:00:00.000Z"
  }
}
```

### Issue Stock (Decrease Inventory)
```http
POST /api/stock/issue
Content-Type: application/json

{
  "product_id": 1,
  "warehouse_id": 1,
  "quantity": 50,
  "reason": "Customer order #67890"
}
```

**Error (400) - Insufficient Stock:**
```json
{
  "error": "Insufficient stock available.",
  "available": 10,
  "requested": 50
}
```

### Adjust Stock (Set to Specific Quantity)
```http
POST /api/stock/adjust
Content-Type: application/json

{
  "product_id": 1,
  "warehouse_id": 1,
  "new_quantity": 200,
  "reason": "Physical inventory count"
}
```

**Response (200):**
```json
{
  "message": "Stock adjusted successfully.",
  "stock": {
    "id": 1,
    "product_id": 1,
    "warehouse_id": 1,
    "quantity": 200
  },
  "adjustment": 50
}
```

---

## Stock Movements Endpoints (JWT Required)

### List All Movements
```http
GET /api/stock-movements
GET /api/stock-movements?product_id=1
GET /api/stock-movements?warehouse_id=1
GET /api/stock-movements?movement_type=receive
GET /api/stock-movements?limit=50
```

**Response (200):**
```json
{
  "message": "Stock movements retrieved successfully.",
  "count": 10,
  "movements": [
    {
      "id": 5,
      "product_id": 1,
      "warehouse_id": 1,
      "movement_type": "receive",
      "quantity": 100,
      "reason": "Purchase order",
      "user_id": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "sku": "WIDGET-001",
      "product_name": "Standard Widget",
      "warehouse_name": "Main Warehouse",
      "user_username": "admin"
    }
  ]
}
```

### Get Movement by ID
```http
GET /api/stock-movements/:id
```

### Get Product Movement History
```http
GET /api/stock-movements/product/:product_id/history
```

### Get Warehouse Movement History
```http
GET /api/stock-movements/warehouse/:warehouse_id/history
```

---

## AI Agent Endpoints (JWT Required)

### Get Reorder Advice
```http
POST /api/agent/reorder-advice
Content-Type: application/json

{
  "product_id": 1,
  "warehouse_id": 1,
  "low_stock_only": true
}
```

**Response (200):**
```json
{
  "message": "Reorder advice generated successfully.",
  "items_analyzed": 3,
  "provider": "mock",
  "advice": [
    {
      "product_id": 1,
      "product_name": "Standard Widget",
      "sku": "WIDGET-001",
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "current_quantity": 40,
      "reorder_level": 100,
      "suggested_order_quantity": 160,
      "priority": "MEDIUM",
      "reason": "Stock below reorder level (40 < 100)"
    }
  ],
  "summary": "1 product(s) need reordering"
}
```

### Ask AI Question
```http
POST /api/agent/ask
Content-Type: application/json

{
  "question": "Which suppliers do we have?"
}
```

Any valid JWT can ask about products, suppliers, warehouses, stock levels, and recent stock movements. Context is a bounded set of matching rows plus counts, not a dump of movement history and not a fixed five-number summary.

User questions are admin-only. A non-Admin asking only about users receives **403** with `User records are admin-only` and no user rows. Password hashes are never included.

This application does not track purchase or sales orders. An orders question is answered with that fact and does not invent orders.

**Response (200, mock provider, shape varies with the question):**
```json
{
  "message": "Question answered successfully.",
  "provider": "mock",
  "question": "Which suppliers do we have?",
  "answer": "Based on the current application data. suppliers (count 2; TechParts Inc, Global Components) This is a mock response for testing.",
  "context_used": {
    "topics": ["suppliers"],
    "suppliers": {
      "count": 2,
      "returned": 2,
      "limit": 25,
      "rows": []
    }
  }
}
```

### Get AI Provider Status
```http
GET /api/agent/status
```

**Response (200):**
```json
{
  "message": "AI provider status retrieved.",
  "provider": "mock",
  "available_providers": ["openai", "anthropic", "bedrock", "mock"],
  "configuration": {
    "openai_configured": false,
    "anthropic_configured": false,
    "bedrock_configured": false
  }
}
```

---

## System Endpoints

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67
}
```

### API Information
```http
GET /
```

**Response (200):**
```json
{
  "name": "StockRoom API",
  "version": "1.0.0",
  "description": "Production-ready inventory management REST API",
  "documentation": "/api/docs",
  "health": "/health",
  "endpoints": {
    "authentication": "/api/authentication",
    "products": "/api/products",
    "suppliers": "/api/suppliers",
    "warehouses": "/api/warehouses",
    "stock": "/api/stock",
    "stockMovements": "/api/stock-movements",
    "agent": "/api/agent"
  }
}
```

### Swagger Documentation
```http
GET /api/docs
```

Interactive Swagger UI for testing all endpoints.

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "error": "Invalid or expired token."
}
```

### 404 Not Found
```json
{
  "error": "Endpoint not found.",
  "path": "/api/invalid",
  "method": "GET"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error.",
  "message": "Error details here"
}
```

---

## Testing the API

### Using cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3100/api/authentication/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.jwtToken')

# Use token to get products
curl -X GET http://localhost:3100/api/products \
  -H "Authorization: Bearer $TOKEN"
```

### Using HTTPie

```bash
# Login and save token
http POST localhost:3100/api/authentication/login \
  username=admin password=admin123

# Use token
http GET localhost:3100/api/products \
  "Authorization: Bearer TOKEN_HERE"
```

### Using Swagger UI

1. Navigate to http://localhost:3100/api/docs
2. Click "Authorize" button
3. Enter JWT token from login
4. Test all endpoints interactively

---

## Complete Test Commands

```bash
# Run all tests
npm run test:all

# Individual test suites
npm run test:unit      # Unit tests (validation, AI provider)
npm run test:api       # API integration tests (auth, products, stock)
npm run test:functional # End-to-end workflow tests
npm run test:e2e       # Playwright E2E tests
```

---

**API Version:** 1.0.0  
**Last Updated:** 2024
