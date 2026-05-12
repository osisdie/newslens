#!/usr/bin/env node

/**
 * Database Creation Script
 * 
 * This script helps create the database if it doesn't exist.
 * 
 * Usage:
 *   node scripts/create-db.js
 * 
 * Or with custom connection:
 *   DATABASE_URL="postgresql://user:pass@host:5432/postgres" node scripts/create-db.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

async function createDatabase() {
  // Parse DATABASE_URL to get connection details
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set in .env file');
    console.error('Please set DATABASE_URL in backend/.env');
    process.exit(1);
  }

  try {
    // Parse the URL to extract database name
    const url = new URL(databaseUrl.replace('postgresql://', 'http://'));
    const dbName = url.pathname.slice(1); // Remove leading '/'
    const user = url.username;
    const password = url.password;
    const host = url.hostname;
    const port = url.port || 5432;

    console.log(`📦 Creating database: ${dbName}`);
    console.log(`🔗 Connecting to: ${host}:${port}`);

    // Connect to default 'postgres' database to create new database
    const adminUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
    const adminPool = new Pool({
      connectionString: adminUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Check if database exists
    const checkResult = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkResult.rows.length > 0) {
      console.log(`✅ Database '${dbName}' already exists`);
      await adminPool.end();
      return;
    }

    // Create database
    await adminPool.query(`CREATE DATABASE ${dbName}`);
    console.log(`✅ Database '${dbName}' created successfully!`);
    
    await adminPool.end();

    // Now initialize schema
    console.log(`\n📋 Initializing database schema...`);
    const { initializeDatabase } = require('../src/db/init');
    await initializeDatabase();
    console.log(`✅ Database schema initialized!`);

  } catch (error) {
    if (error.code === '3D000') {
      console.error(`❌ Database '${dbName}' does not exist and could not be created.`);
      console.error('Make sure you have CREATE DATABASE privileges.');
    } else if (error.code === '28P01') {
      console.error('❌ Authentication failed. Check your DATABASE_URL credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Could not connect to database server.');
      console.error('Make sure PostgreSQL is running and the connection details are correct.');
    } else {
      console.error('❌ Error:', error.message);
      console.error('Full error:', error);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('\n✨ Database setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createDatabase };

