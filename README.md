# StockRoom API

> **GitHub Repository:** [RusselTheCreator/stockroom-api](https://github.com/RusselTheCreator/stockroom-api)  
> This is the canonical public repository. Also available in Origin at `tmp-29967f0bc0f4cd7d`.

Production-ready inventory management REST API with JWT authentication and AI agent integration.

## Features

- ✅ **Complete CRUD Operations** for Products, Suppliers, Warehouses, Stock Levels
- 🔐 **JWT Authentication** with role-based access control (Admin/User)
- 📦 **Inventory Management** - Receive, Issue, and Adjust stock with audit trail
- 🤖 **AI Agent Integration** - Pluggable AI providers (OpenAI, Anthropic, AWS Bedrock, Mock)
- 📊 **Stock Movement History** - Complete audit log of all inventory changes
- 📚 **Interactive API Documentation** - Swagger UI at `/api/docs`
- ✅ **Comprehensive Test Suite** - Unit, Integration, Functional, and E2E tests
- 🔍 **Low Stock Monitoring** - Automatic reorder recommendations

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: PostgreSQL 16
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **API Documentation**: Swagger (OpenAPI 3.0)
- **AI Providers**: OpenAI, Anthropic Claude, AWS Bedrock
- **Testing**: Jest, Supertest, Playwright

## Project Structure

```
stockroom-api/
├── database/
│   ├── db.js                 # PostgreSQL connection pool
│   ├── migrate.js            # Database migration script
│   └── schema.sql            # Complete database schema
├── middleware/
│   ├── logger.js             # Request logging middleware
│   ├── apiRequestJWTCheck.js # JWT authentication middleware
│   └── authorizeUserRole.js  # Role-based authorization
├── routes/
│   ├── authentication.js     # Register & login endpoints
│   ├── products.js           # Product CRUD operations
│   ├── suppliers.js          # Supplier CRUD operations
│   ├── warehouses.js         # Warehouse CRUD operations
│   ├── stock.js              # Stock level management
│   ├── stock-movements.js    # Movement history endpoints
│   ├── agent.js              # AI agent endpoints
│   └── swagger.js            # Swagger/OpenAPI configuration
├── services/
│   ├── aiProvider.js         # AI provider abstraction layer
│   └── askContext.js         # Question-specific context for /api/agent/ask
├── utils/
│   └── validation.js         # Input validation helpers
├── tests/
│   ├── unit/                 # Unit tests
│   ├── api/                  # API integration tests
│   ├── functional/           # End-to-end workflow tests
│   └── e2e/                  # Playwright E2E tests
├── index.js                  # Main application entry point
├── package.json              # Dependencies and scripts
├── docker-compose.yml        # PostgreSQL container setup
└── .env.example              # Environment variables template
```

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- Docker and Docker Compose (for PostgreSQL)
- npm or yarn

### 2. Clone and Install

```bash
# Clone repository
git clone <your-repo-url>
cd stockroom-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Configure Environment

Edit `.env` file with your settings:

```env
PORT=3100
NODE_ENV=development
DATABASE_URL=postgresql://stockroom:stockroom_secret@localhost:5432/stockroom
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1h
AI_PROVIDER=mock
```

### 4. Start Database

```bash
# Start PostgreSQL container
docker compose up -d

# Wait for database to be ready
# Run database migrations
npm run migrate
```

### 5. Start Server

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3100`

### 6. Access API Documentation

Open your browser to:
- **Swagger UI**: http://localhost:3100/api/docs
- **Health Check**: http://localhost:3100/health
- **API Info**: http://localhost:3100

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3100 | Server port |
| `NODE_ENV` | No | development | Environment (development/production) |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | No | 1h | JWT token expiration |
| `AI_PROVIDER` | No | mock | AI provider (openai/anthropic/bedrock/mock) |
| `OPENAI_API_KEY` | Conditional | - | Required when AI_PROVIDER=openai |
| `ANTHROPIC_API_KEY` | Conditional | - | Required when AI_PROVIDER=anthropic |
| `AWS_ACCESS_KEY_ID` | Conditional | - | Required when AI_PROVIDER=bedrock |
| `AWS_SECRET_ACCESS_KEY` | Conditional | - | Required when AI_PROVIDER=bedrock |
| `AWS_REGION` | No | us-east-1 | AWS region for Bedrock |

## API Endpoints

### Authentication (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/authentication/register` | Register new user |
| POST | `/api/authentication/login` | Login and receive JWT |

### Products (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/products` | Create new product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product (soft delete) |

### Suppliers (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suppliers` | List all suppliers |
| GET | `/api/suppliers/:id` | Get supplier by ID |
| POST | `/api/suppliers` | Create new supplier |
| PUT | `/api/suppliers/:id` | Update supplier |
| DELETE | `/api/suppliers/:id` | Delete supplier |

### Warehouses (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/warehouses` | List all warehouses |
| GET | `/api/warehouses/:id` | Get warehouse by ID |
| POST | `/api/warehouses` | Create new warehouse |
| PUT | `/api/warehouses/:id` | Update warehouse |
| DELETE | `/api/warehouses/:id` | Delete warehouse |

### Stock Levels (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stock` | List all stock levels |
| GET | `/api/stock/:id` | Get stock level by ID |
| POST | `/api/stock/receive` | Receive inventory (increase) |
| POST | `/api/stock/issue` | Issue inventory (decrease) |
| POST | `/api/stock/adjust` | Adjust to specific quantity |

### Stock Movements (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stock-movements` | List all movements |
| GET | `/api/stock-movements/:id` | Get movement by ID |
| GET | `/api/stock-movements/product/:id/history` | Product history |
| GET | `/api/stock-movements/warehouse/:id/history` | Warehouse history |

### AI Agent (JWT Required)

`POST /api/agent/ask` answers natural-language questions from live application data. The handler picks the relevant tables, loads a bounded set of rows plus total counts, and sends that context to the configured provider. It does not answer every question from a fixed five-number inventory summary. `POST /api/agent/reorder-advice` is unchanged: it still analyzes stock that is below reorder level.

Any valid JWT can ask about:

- **Products** — name, SKU, unit, price, reorder level, supplier
- **Suppliers** — name and contact details
- **Warehouses** — name and location
- **Stock** — quantities on hand, low stock, and approximate stock value
- **Movements** — the most recent stock movements plus the total movement count, not the full history

**Users are admin-only.** An Admin can ask who the accounts are (username, email, role, active flag). Password hashes and password fields are never loaded, never sent to the model, and never returned in `context_used`. A non-Admin token that asks only about users receives **403** (`User records are admin-only`) and no user rows. If the question also asks about inventory, user rows are omitted and the answer says user records are admin-only.

**Orders are not tracked.** There is no orders table. Questions about purchase orders or sales orders are answered with the statement that this application does not track purchase or sales orders. The agent does not invent orders.

The mock provider (`AI_PROVIDER=mock`) needs no API keys. It echoes the selected names and counts so answers can be checked against the database. AWS Bedrock, when configured, calls the model through the Converse API.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/reorder-advice` | Get AI reorder recommendations |
| POST | `/api/agent/ask` | Ask about products, suppliers, warehouses, stock, movements, or (Admin) users |
| GET | `/api/agent/status` | Get AI provider status |

## Usage Examples

### 1. Register and Login

```bash
# Register new user
curl -X POST http://localhost:3100/api/authentication/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "password123",
    "role": "User"
  }'

# Login
curl -X POST http://localhost:3100/api/authentication/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "password123"
  }'
# Returns: { "jwtToken": "eyJhbG...", "user": {...} }
```

### 2. Create Product (with JWT)

```bash
curl -X POST http://localhost:3100/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "WIDGET-001",
    "name": "Standard Widget",
    "description": "High-quality widget",
    "unit": "piece",
    "unit_price": 12.50,
    "reorder_level": 100
  }'
```

### 3. Receive Stock

```bash
curl -X POST http://localhost:3100/api/stock/receive \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "warehouse_id": 1,
    "quantity": 150,
    "reason": "Purchase order #1234"
  }'
```

### 4. Get AI Reorder Advice

```bash
curl -X POST http://localhost:3100/api/agent/reorder-advice \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "low_stock_only": true
  }'
```

## AI Provider Configuration

The API supports multiple AI providers for intelligent inventory analysis.

### Mock Provider (Default - No API Key Required)

```env
AI_PROVIDER=mock
```

Returns deterministic responses for testing without external API calls. Ask answers echo the bounded rows selected for the question (names and counts) and do not require AWS or other provider keys.

### OpenAI (GPT-4)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
```

Uses GPT-4 for advanced inventory analysis and recommendations.

### Anthropic (Claude)

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
```

Uses Claude 3 Sonnet for inventory intelligence.

### AWS Bedrock (Claude via AWS)

```env
AI_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

Uses Claude through AWS Bedrock service.

## Testing

The project includes a comprehensive test suite covering all layers.

### Run All Tests

```bash
npm test
# or
npm run test:all
```

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# API integration tests
npm run test:api

# Functional workflow tests
npm run test:functional

# Playwright E2E tests
npm run test:e2e
```

### Test Requirements

- PostgreSQL database must be running
- Set `AI_PROVIDER=mock` for tests (no real API keys needed)
- Database will be seeded with test data

### Test Coverage

```bash
npm run test:unit
# Generates coverage report in ./coverage/
```

## Database Schema

### Users Table
- User accounts with authentication
- Roles: Admin, User
- Passwords hashed with bcrypt

### Products Table
- SKU, name, description
- Unit price and reorder level
- Supplier relationship

### Suppliers Table
- Contact information
- Active/inactive status

### Warehouses Table
- Location information
- Active/inactive status

### Stock Levels Table
- Current inventory quantities
- Unique constraint on product-warehouse pair
- Non-negative quantity constraint

### Stock Movements Table
- Append-only audit log
- Types: receive, issue, adjust
- Tracks user, timestamp, reason

## Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Role-based access control
- ✅ Input validation on all endpoints
- ✅ Parameterized SQL queries (SQL injection protection)
- ✅ CORS enabled for cross-origin requests
- ✅ Token expiration (configurable)

## Production Deployment

### Before Deploying

1. **Change JWT Secret**: Use a strong random key
2. **Use Production Database**: Not the seeded demo data
3. **Enable SSL**: Configure `DATABASE_URL` with SSL
4. **Set NODE_ENV=production**
5. **Configure AI Provider**: Set up real API keys if using AI features
6. **Review CORS**: Restrict to specific origins
7. **Enable Rate Limiting**: Add rate limiting middleware
8. **Set Up Monitoring**: Log aggregation and error tracking

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3100
DATABASE_URL=postgresql://user:password@host:5432/dbname?ssl=true
JWT_SECRET=<strong-random-secret-at-least-32-chars>
JWT_EXPIRES_IN=1h
AI_PROVIDER=openai
OPENAI_API_KEY=<your-production-key>
```

### Deployment Platforms

The API can be deployed to:
- **Docker**: Use provided docker-compose.yml
- **Heroku**: Supports PostgreSQL add-on
- **AWS**: EC2 + RDS or ECS + Aurora
- **Google Cloud**: Cloud Run + Cloud SQL
- **Azure**: App Service + PostgreSQL

## Troubleshooting

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker compose ps

# View PostgreSQL logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### Migration Errors

```bash
# Drop and recreate database
docker compose down -v
docker compose up -d
npm run migrate
```

### JWT Token Issues

- Ensure `JWT_SECRET` is set in `.env`
- Check token hasn't expired (default 1 hour)
- Verify token format: `Bearer <token>`

### AI Provider Errors

- Verify API keys are correctly set
- Check provider is set correctly (`openai`, `anthropic`, `bedrock`, or `mock`)
- Use `mock` provider for testing without API keys

## Development

### Code Style

- Verbose uppercase comments explaining each step
- Parameterized SQL queries ($1, $2 placeholders)
- Consistent error handling and status codes
- Swagger JSDoc on every route

### Adding New Endpoints

1. Create route handler in `routes/` folder
2. Add JWT middleware if protected
3. Add Swagger JSDoc comments
4. Write tests in `tests/api/`
5. Update this README

### Database Changes

1. Modify `database/schema.sql`
2. Run `npm run migrate` to apply changes
3. Update tests as needed

## License

MIT

## Support

For issues, questions, or contributions, please contact the development team.

## Seeded Demo Data

The schema includes demo data for testing:

**Users:**
- Username: `admin` / Password: `admin123` (Role: Admin)
- Username: `user` / Password: `user123` (Role: User)

**Sample Products:**
- Standard Widget (SKU: WIDGET-001)
- Premium Gadget (SKU: GADGET-001)
- Replacement Part (SKU: PART-123)

**Warehouses:**
- Main Warehouse
- Distribution Center

Use these credentials to test the API immediately after setup!

---

**Built with ❤️ using Node.js + Express + PostgreSQL**
