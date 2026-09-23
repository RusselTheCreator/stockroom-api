// =====================================================
// DATABASE MIGRATION SCRIPT
// Applies the schema.sql file to the database
// Run with: npm run migrate
// =====================================================

const fs = require('fs');
const path = require('path');
const pool = require('./db');

// =====================================================
// RUN MIGRATION
// Reads and executes the schema.sql file
// =====================================================
async function migrate() {
  try {
    console.log('🔄 Starting database migration...');
    
    // READ THE SCHEMA FILE
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // EXECUTE THE SCHEMA SQL
    await pool.query(schema);
    
    console.log('✅ Database migration completed successfully!');
    console.log('📊 All tables, indexes, and seed data have been created.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// RUN THE MIGRATION
migrate();
