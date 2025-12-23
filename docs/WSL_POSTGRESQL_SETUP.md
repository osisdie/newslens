# PostgreSQL Installation Guide for WSL

This guide helps you install and configure PostgreSQL on Windows Subsystem for Linux (WSL) for the first time.

## Quick Installation

Run the automated installation script:

```bash
cd backend/scripts
chmod +x install-postgresql-wsl.sh
./install-postgresql-wsl.sh
```

Or from the backend directory:

```bash
cd backend
bash scripts/install-postgresql-wsl.sh
```

## Manual Installation

### Step 1: Update Package List

```bash
sudo apt-get update
```

### Step 2: Install PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
```

This installs:
- PostgreSQL server
- PostgreSQL client tools (psql, etc.)
- Additional PostgreSQL utilities

### Step 3: Start PostgreSQL Service

```bash
sudo service postgresql start
```

### Step 4: Enable Auto-Start (Optional)

```bash
sudo systemctl enable postgresql
```

### Step 5: Verify Installation

```bash
# Check version
psql --version

# Check service status
sudo service postgresql status

# Test connection
sudo -u postgres psql -c "SELECT version();"
```

## Initial Configuration

### Set Password for postgres User

```bash
# Connect as postgres user
sudo -u postgres psql

# In psql, set password
ALTER USER postgres PASSWORD 'your_password';

# Exit psql
\q
```

### Create a Development User (Optional)

```bash
sudo -u postgres psql

# Create user
CREATE USER ainews WITH PASSWORD 'your_password';

# Grant privileges
ALTER USER ainews CREATEDB;

# Exit
\q
```

## Configure Database Connection

Update `backend/.env` with your connection string:

```bash
# Using postgres user
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ai_news

# Or using custom user
DATABASE_URL=postgresql://ainews:your_password@localhost:5432/ai_news
```

## Create Database

After installation, create the database:

```bash
cd backend
npm run create-db
```

Or manually:

```bash
# Create database
sudo -u postgres createdb ai_news

# Or using psql
sudo -u postgres psql -c "CREATE DATABASE ai_news;"

# Then initialize schema
cd backend
npm run migrate
```

## Common Issues & Solutions

### Issue: "service: command not found"

**Solution**: Use systemctl instead:

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

### Issue: "Could not connect to server"

**Solution 1**: Check if PostgreSQL is running:

```bash
sudo service postgresql status
# If not running:
sudo service postgresql start
```

**Solution 2**: Check PostgreSQL configuration:

```bash
# Find PostgreSQL version
psql --version

# Edit postgresql.conf (replace X.X with your version)
sudo nano /etc/postgresql/X.X/main/postgresql.conf

# Ensure this line exists:
listen_addresses = 'localhost'

# Edit pg_hba.conf
sudo nano /etc/postgresql/X.X/main/pg_hba.conf

# Ensure local connections are allowed:
# local   all             all                                     peer
# host    all             all             127.0.0.1/32            md5

# Restart PostgreSQL
sudo service postgresql restart
```

### Issue: "Peer authentication failed"

**Solution**: This happens when trying to connect without sudo. Use:

```bash
# Connect as postgres user
sudo -u postgres psql

# Or specify user in connection string
psql -U postgres -h localhost
```

### Issue: "Password authentication failed"

**Solution**: Reset the password:

```bash
sudo -u postgres psql

# Reset password
ALTER USER postgres PASSWORD 'new_password';

# Exit
\q
```

### Issue: PostgreSQL won't start

**Solution**: Check logs and fix issues:

```bash
# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Check if port 5432 is in use
sudo netstat -tulpn | grep 5432

# Try starting with verbose output
sudo -u postgres /usr/lib/postgresql/*/bin/postgres -D /var/lib/postgresql/*/main
```

### Issue: "Permission denied" when creating database

**Solution**: Grant CREATEDB privilege:

```bash
sudo -u postgres psql

# Grant privilege
ALTER USER your_username CREATEDB;

# Or use postgres superuser
sudo -u postgres createdb ai_news
```

## Useful PostgreSQL Commands

### Service Management

```bash
# Start
sudo service postgresql start

# Stop
sudo service postgresql stop

# Restart
sudo service postgresql restart

# Status
sudo service postgresql status
```

### Database Operations

```bash
# Connect to PostgreSQL
psql -U postgres

# List databases
psql -U postgres -l
# Or in psql: \l

# Connect to specific database
psql -U postgres -d ai_news

# List tables
psql -U postgres -d ai_news -c "\dt"

# Run SQL file
psql -U postgres -d ai_news -f schema.sql

# Backup database
pg_dump -U postgres ai_news > backup.sql

# Restore database
psql -U postgres ai_news < backup.sql
```

### Inside psql

```sql
-- List databases
\l

-- Connect to database
\c ai_news

-- List tables
\dt

-- Describe table
\d table_name

-- List users
\du

-- Exit
\q
```

## WSL-Specific Notes

### Starting PostgreSQL on WSL Boot

PostgreSQL doesn't automatically start when WSL boots. To auto-start:

**Option 1**: Add to `.bashrc` or `.zshrc`:

```bash
# Add to ~/.bashrc
if [ -f /etc/init.d/postgresql ]; then
    sudo service postgresql start > /dev/null 2>&1
fi
```

**Option 2**: Use systemd (if enabled in WSL):

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Accessing PostgreSQL from Windows

If you want to access PostgreSQL from Windows applications:

1. Edit `postgresql.conf`:
   ```bash
   sudo nano /etc/postgresql/*/main/postgresql.conf
   # Set: listen_addresses = '*'
   ```

2. Edit `pg_hba.conf`:
   ```bash
   sudo nano /etc/postgresql/*/main/pg_hba.conf
   # Add: host all all 0.0.0.0/0 md5
   ```

3. Get WSL IP:
   ```bash
   hostname -I
   ```

4. Use WSL IP in connection string from Windows

### Performance Tips

1. **Increase shared_buffers** (if you have enough RAM):
   ```bash
   sudo nano /etc/postgresql/*/main/postgresql.conf
   # Set: shared_buffers = '256MB'
   ```

2. **Enable connection pooling** (for production)

3. **Regular maintenance**:
   ```bash
   sudo -u postgres psql -d ai_news -c "VACUUM ANALYZE;"
   ```

## Next Steps

After PostgreSQL is installed and configured:

1. ✅ PostgreSQL installed and running
2. ✅ Database user configured
3. ⏭️ Update `backend/.env` with `DATABASE_URL`
4. ⏭️ Run `cd backend && npm run create-db`
5. ⏭️ Start backend server: `npm run dev`

## Additional Resources

- PostgreSQL Documentation: https://www.postgresql.org/docs/
- WSL Documentation: https://docs.microsoft.com/en-us/windows/wsl/
- PostgreSQL on Ubuntu: https://www.postgresql.org/download/linux/ubuntu/

## Troubleshooting Checklist

- [ ] PostgreSQL service is running: `sudo service postgresql status`
- [ ] Can connect: `sudo -u postgres psql -c "SELECT 1;"`
- [ ] Port 5432 is listening: `sudo netstat -tulpn | grep 5432`
- [ ] DATABASE_URL is correct in `.env`
- [ ] User has CREATEDB privilege (if creating database)
- [ ] Firewall allows localhost connections (usually not needed in WSL)

If you still have issues, check the PostgreSQL logs:

```bash
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

