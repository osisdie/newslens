#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Initializes the database schema (tables, indexes, etc.)
 * 
 * Usage:
 *   npm run migrate
 *   or
 *   node src/db/migrate.js
 */

require('dotenv').config();
const { initializeDatabase } = require('./init');

async function migrate() {
  try {
    console.log('🔄 Initializing database schema...');
    await initializeDatabase();
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };

