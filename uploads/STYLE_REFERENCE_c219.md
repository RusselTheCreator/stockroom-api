# Style reference from RusselTheCreator/usercrud-api

Match this project's conventions closely.

## Stack
- Node.js + Express 5
- PostgreSQL via `pg` Pool (`DATABASE_URL`, SSL rejectUnauthorized:false)
- JWT (`jsonwebtoken`) + bcryptjs
- cors, dotenv
- swagger-jsdoc + swagger-ui-express at `/api/docs`

## Layout
```
index.js                 # app entry: cors, json, logger, mount routes, swagger, listen
database/db.js           # pg Pool export
middleware/logger.js     # log method + url
middleware/apiRequestJWTCheck.js  # Bearer JWT -> req.user
middleware/authorizeUserRole.js   # role gate
routes/authentication.js # register + login
routes/users.js          # CRUD (adapt to products/suppliers/stock)
routes/swagger.js        # openapi 3.0 specs
.env.example
README.md
```

## Code style (critical)
- VERY verbose uppercase comments explaining each step (match usercrud-api tone)
- `const express = require('express'); const router = express.Router();`
- Validation before DB; SQL with `$1` placeholders
- JSON responses like `{ message: "...", ... }` or `{ error: "..." }`
- Status codes: 200/201 success, 400 validation, 401 no token, 403 bad token, 404 missing, 500 errors
- Swagger JSDoc blocks above every route
- JWT on protected routes; auth routes public
- Roles: Admin / User (or InventoryManager / User)

## Auth endpoints pattern
- POST /api/authentication/register
- POST /api/authentication/login → `{ message, user, jwtToken }`
