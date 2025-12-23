# Database Setup Guide

This guide explains how to set up the PostgreSQL database for the AI News Aggregator.

## Quick Setup

The easiest way is to use the provided script:

```bash
cd backend
npm run create-db
```

This will:
1. Create the database if it doesn't exist
2. Initialize all tables and schema

## Manual Setup Methods

### Method 1: Using psql Command Line

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ai_news;

# Exit psql
\q

# Then initialize schema
cd backend
npm run migrate
```

### Method 2: Using createdb Command

```bash
# Create database
createdb -U postgres ai_news

# Then initialize schema
cd backend
npm run migrate
```

### Method 3: Using SQL File

```bash
# Connect and create
psql -U postgres -c "CREATE DATABASE ai_news;"

# Then initialize schema
cd backend
npm run migrate
```

## Cloud Database Setup

### Supabase

1. Go to https://supabase.com and create a project
2. The database is automatically created
3. Copy the connection string from Settings > Database
4. Update `DATABASE_URL` in `.env`
5. Run `npm run migrate` to initialize schema

### Neon

1. Go to https://neon.tech and create a project
2. The database is automatically created
3. Copy the connection string from the dashboard
4. Update `DATABASE_URL` in `.env`
5. Run `npm run migrate` to initialize schema

### Railway

1. Add PostgreSQL service in Railway
2. The database is automatically created
3. Copy the connection string from the service variables
4. Update `DATABASE_URL` in `.env`
5. Run `npm run migrate` to initialize schema

### Render

1. Create PostgreSQL database in Render dashboard
2. The database is automatically created
3. Copy the connection string from the database settings
4. Update `DATABASE_URL` in `.env`
5. Run `npm run migrate` to initialize schema

## Troubleshooting

### Error: "Cannot create a database when multi-database mode is disabled"

This error occurs when using database management tools (like DBeaver, pgAdmin, or cloud database UIs) that restrict database creation.

**Solutions:**

1. **Use command line** (recommended):
   ```bash
   psql -U postgres -c "CREATE DATABASE ai_news;"
   ```

2. **Use the setup script**:
   ```bash
   cd backend
   npm run create-db
   ```

3. **For cloud databases**: The database is usually already created. Just:
   - Copy the connection string
   - Update `DATABASE_URL` in `.env`
   - Run `npm run migrate`

### Error: "permission denied to create database"

You need superuser privileges to create databases.

**Solutions:**

1. **Use a superuser account** (like `postgres`):
   ```bash
   psql -U postgres -c "CREATE DATABASE ai_news;"
   ```

2. **Grant privileges** (if you have superuser access):
   ```sql
   ALTER USER your_user CREATEDB;
   ```

3. **For cloud databases**: Use the provided connection string which has the right permissions

### Error: "database does not exist"

Make sure the database name in `DATABASE_URL` matches the created database:

```bash
# Check existing databases
psql -U postgres -l

# Or using SQL
psql -U postgres -c "\l"
```

### Error: "connection refused"

1. **Check PostgreSQL is running**:
   ```bash
   # Linux/Mac
   sudo systemctl status postgresql
   # or
   brew services list
   
   # Windows
   # Check Services panel
   ```

2. **Check connection details** in `DATABASE_URL`:
   - Host: `localhost` or your server IP
   - Port: Usually `5432`
   - Username and password: Correct credentials

### Error: "password authentication failed"

1. **Check password** in `DATABASE_URL`
2. **Reset password** if needed:
   ```sql
   ALTER USER your_user PASSWORD 'new_password';
   ```

## Verify Setup

After setup, verify the database is working:

```bash
cd backend

# Test connection
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()').then(r => {console.log('✅ Connected:', r.rows[0]); pool.end();}).catch(e => {console.error('❌ Error:', e.message); process.exit(1);})"

# Check tables
psql $DATABASE_URL -c "\dt"
```

## Database Schema

The schema includes these tables:
- `users` - User accounts
- `subscriptions` - Subscription status
- `billing_history` - Payment history
- `news_sources` - User's news source URLs
- `source_keywords` - Keywords for each source
- `news_articles` - Scraped news articles
- `usage_tracking` - Usage statistics

See `src/db/schema.sql` for the complete schema.

## Next Steps

After database setup:
1. ✅ Database created
2. ✅ Schema initialized
3. ⏭️ Start the backend server: `npm run dev`
4. ⏭️ Test the API endpoints

