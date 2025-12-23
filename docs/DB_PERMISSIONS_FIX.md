# Fixing Database Permission Errors

## Error: "must be owner of table users"

This error occurs when the database user doesn't have permission to modify tables that were created by a different user (usually the `postgres` superuser).

## Quick Fix

### Option 1: Use the Fix Script (Recommended)

```bash
cd backend
npm run fix-permissions
```

This script will:
- Parse your DATABASE_URL from `.env`
- Grant necessary permissions to your database user
- Make the user owner of existing tables

### Option 2: Manual Fix via psql

```bash
# Connect as postgres superuser
sudo -u postgres psql -d ai_news

# Or if you have postgres password:
psql -U postgres -d ai_news
```

Then run these SQL commands (replace `your_user` with your actual database user):

```sql
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO your_user;

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

-- Grant future table permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO your_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO your_user;

-- Make user owner of existing tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO your_user';
    END LOOP;
END
$$;
```

### Option 3: Recreate Database with Correct User

If you want to start fresh:

```bash
# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE ai_news;"
sudo -u postgres psql -c "CREATE DATABASE ai_news OWNER your_user;"

# Then initialize schema
cd backend
npm run migrate
```

## Find Your Database User

Your database user is in your `DATABASE_URL` in `backend/.env`:

```bash
# Example DATABASE_URL:
# postgresql://myuser:mypassword@localhost:5432/ai_news
#                    ^^^^^^
#                    This is your database user
```

Or check it:

```bash
cd backend
grep DATABASE_URL .env
```

## Verify Permissions

After fixing, verify permissions:

```bash
psql $DATABASE_URL -c "\dp"
```

You should see your user listed with permissions on all tables.

## Common Scenarios

### Scenario 1: Tables Created by postgres User

**Problem**: You created the database/tables as `postgres` user, but your app uses a different user.

**Solution**: Use Option 2 above to grant permissions or change ownership.

### Scenario 2: Cloud Database (Supabase, Neon, etc.)

**Problem**: Cloud databases usually create tables with a specific owner.

**Solution**: 
- Check your cloud provider's documentation
- Usually the connection user already has permissions
- If not, contact support or use their admin panel

### Scenario 3: Fresh Installation

**Problem**: First time setup, tables don't exist yet.

**Solution**: 
- Make sure your database user has `CREATEDB` privilege
- Run: `npm run create-db` (creates DB and initializes schema)
- Or: `npm run migrate` (just initializes schema if DB exists)

## Prevention

To avoid this issue in the future:

1. **Create database with correct owner**:
   ```bash
   sudo -u postgres psql -c "CREATE DATABASE ai_news OWNER your_user;"
   ```

2. **Or grant CREATEDB to your user**:
   ```sql
   ALTER USER your_user CREATEDB;
   ```

3. **Then create tables as that user**:
   ```bash
   psql -U your_user -d ai_news -f backend/src/db/schema.sql
   ```

## Troubleshooting

### Still Getting Permission Errors?

1. **Check current user**:
   ```bash
   psql $DATABASE_URL -c "SELECT current_user;"
   ```

2. **Check table owners**:
   ```bash
   psql $DATABASE_URL -c "\dt+"
   ```

3. **Check user privileges**:
   ```sql
   SELECT grantee, privilege_type 
   FROM information_schema.role_table_grants 
   WHERE table_name = 'users';
   ```

### Error: "permission denied for schema public"

Run as postgres:
```sql
GRANT USAGE ON SCHEMA public TO your_user;
GRANT CREATE ON SCHEMA public TO your_user;
```

### Error: "permission denied for sequence"

Run as postgres:
```sql
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO your_user;
```

## After Fixing

Once permissions are fixed, restart your server:

```bash
cd backend
npm run dev
```

The server should now start without permission errors!

