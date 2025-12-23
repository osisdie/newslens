const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool;

// Initialize database connection
function getPool() {
  if (!pool) {
    if (process.env.DATABASE_URL) {
      // PostgreSQL
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    } else {
      throw new Error('DATABASE_URL not set. Please configure database connection.');
    }
  }
  return pool;
}

// Initialize database schema
async function initializeDatabase() {
  const pool = getPool();
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (error) {
    // If tables already exist, that's okay (42P07 = duplicate_table)
    if (error.code === '42P07') {
      console.log('Database tables already exist, skipping initialization');
      return;
    }
    
    // Permission error - tables exist but user doesn't have permission
    if (error.code === '42501') {
      console.warn('⚠️  Permission error: Tables may already exist but user lacks permissions.');
      console.warn('   Attempting to verify tables exist...');
      
      try {
        // Check if tables exist by querying them
        const checkResult = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'subscriptions', 'news_sources')
        `);
        
        if (checkResult.rows.length >= 3) {
          console.log('✅ Database tables exist and are accessible');
          return;
        } else {
          console.error('❌ Some tables are missing. Please run as database owner:');
          console.error('   sudo -u postgres psql -d ai_news -f backend/src/db/schema.sql');
          throw new Error('Database tables missing and cannot be created due to permissions');
        }
      } catch (checkError) {
        console.error('Error checking tables:', checkError.message);
        throw error; // Throw original permission error
      }
    }
    
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Query helper
async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

module.exports = {
  getPool,
  initializeDatabase,
  query
};

