#!/bin/bash

# Fix PostgreSQL database permissions
# This script grants necessary permissions to the database user

set -e

echo "🔧 Fixing PostgreSQL Database Permissions"
echo "=========================================="
echo ""

# Get database connection details from .env
if [ ! -f .env ]; then
    echo "❌ .env file not found in backend directory"
    echo "   Please create backend/.env with DATABASE_URL"
    exit 1
fi

# Parse DATABASE_URL
DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env"
    exit 1
fi

# Extract components from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')

if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "❌ Could not parse DATABASE_URL"
    echo "   Format should be: postgresql://user:password@host:port/database"
    exit 1
fi

echo "📋 Database: $DB_NAME"
echo "👤 User: $DB_USER"
echo ""

# Connect as postgres superuser to grant permissions
echo "Please enter PostgreSQL superuser password (usually 'postgres' user):"
read -s POSTGRES_PASSWORD

echo ""
echo "🔐 Granting permissions..."

# Create SQL commands
SQL_COMMANDS="
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO $DB_USER;

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Grant future table permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

-- Make user owner of existing tables (if needed)
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO $DB_USER';
    END LOOP;
END
\$\$;
"

# Execute using psql
PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d $DB_NAME -c "$SQL_COMMANDS"

if [ $? -eq 0 ]; then
    echo "✅ Permissions granted successfully!"
    echo ""
    echo "You can now run: npm run dev"
else
    echo "❌ Failed to grant permissions"
    echo ""
    echo "Manual fix:"
    echo "1. Connect as postgres user:"
    echo "   sudo -u postgres psql -d $DB_NAME"
    echo ""
    echo "2. Run these commands:"
    echo "   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    echo "   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    echo "   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
    exit 1
fi

