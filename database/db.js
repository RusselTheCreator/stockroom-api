// =====================================================
// DATABASE CONNECTION MODULE
// Exports a PostgreSQL connection pool using pg library
// =====================================================

const { Pool } = require('pg');
require('dotenv').config();

// =====================================================
// CREATE POSTGRESQL CONNECTION POOL
// Uses DATABASE_URL from environment variables
// SSL is configured for production compatibility
// =====================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// =====================================================
// TEST CONNECTION ON STARTUP
// Logs success or failure when module is first loaded
// =====================================================
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected successfully at', res.rows[0].now);
  }
});

// =====================================================
// EXPORT THE POOL FOR USE IN ROUTES
// Other modules will import this pool to run queries
// =====================================================
module.exports = pool;
