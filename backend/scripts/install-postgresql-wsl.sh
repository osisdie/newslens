#!/bin/bash

# PostgreSQL Installation Script for WSL (Windows Subsystem for Linux)
# This script installs and configures PostgreSQL on WSL Ubuntu/Debian

set -e  # Exit on error

echo "🐘 PostgreSQL Installation Script for WSL"
echo "=========================================="
echo ""

# Check if running on WSL
if [ -f /proc/version ] && grep -qi microsoft /proc/version; then
    echo "✅ WSL environment detected"
else
    echo "⚠️  Warning: This script is designed for WSL, but WSL not detected"
    echo "   Continuing anyway..."
fi

# Check if PostgreSQL is already installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is already installed"
    psql --version
    echo ""
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping installation. Run database setup with: npm run create-db"
        exit 0
    fi
fi

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo "❌ Cannot detect Linux distribution"
    exit 1
fi

echo "📦 Detected OS: $OS $OS_VERSION"
echo ""

# Update package list
echo "🔄 Updating package list..."
sudo apt-get update -qq

# Install PostgreSQL
echo "📥 Installing PostgreSQL..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    sudo apt-get install -y postgresql postgresql-contrib
else
    echo "❌ Unsupported distribution: $OS"
    echo "   Please install PostgreSQL manually for your distribution"
    exit 1
fi

# Get PostgreSQL version
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
echo "✅ PostgreSQL $PG_VERSION installed successfully"
echo ""

# Start PostgreSQL service
echo "🚀 Starting PostgreSQL service..."
sudo service postgresql start

# Enable PostgreSQL to start on boot
echo "⚙️  Configuring PostgreSQL to start on boot..."
sudo systemctl enable postgresql

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Check if PostgreSQL is running
if sudo service postgresql status | grep -q "active (running)"; then
    echo "✅ PostgreSQL service is running"
else
    echo "⚠️  Warning: PostgreSQL service may not be running"
    echo "   Try: sudo service postgresql start"
fi

echo ""
echo "🔐 Setting up PostgreSQL user..."

# Set password for postgres user
echo "Please set a password for the 'postgres' user (or press Enter for no password):"
read -s POSTGRES_PASSWORD
echo ""

if [ -n "$POSTGRES_PASSWORD" ]; then
    echo "Setting password for postgres user..."
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || true
fi

# Create a new user for development (optional)
echo ""
read -p "Create a new PostgreSQL user for development? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter username (default: ainews): " DB_USER
    DB_USER=${DB_USER:-ainews}
    
    read -p "Enter password for $DB_USER: " -s DB_PASSWORD
    echo ""
    
    if [ -n "$DB_PASSWORD" ]; then
        echo "Creating user $DB_USER..."
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User may already exist"
        sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null || true
        echo "✅ User $DB_USER created"
    fi
fi

echo ""
echo "📋 PostgreSQL Installation Summary"
echo "=================================="
echo "✅ PostgreSQL installed: $(psql --version)"
echo "✅ Service status: $(sudo service postgresql status | grep -oP 'active \(running\)' || echo 'Check manually')"
echo ""
echo "📝 Connection Information:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Default user: postgres"
echo ""
echo "🔧 Useful Commands:"
echo "   Start service:    sudo service postgresql start"
echo "   Stop service:     sudo service postgresql stop"
echo "   Restart service:  sudo service postgresql restart"
echo "   Check status:     sudo service postgresql status"
echo "   Connect:          psql -U postgres"
echo ""
echo "📚 Next Steps:"
echo "   1. Update DATABASE_URL in backend/.env"
echo "   2. Run: cd backend && npm run create-db"
echo ""

# Test connection
echo "🧪 Testing PostgreSQL connection..."
if sudo -u postgres psql -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ PostgreSQL connection test successful!"
else
    echo "⚠️  Warning: Could not connect to PostgreSQL"
    echo "   Try: sudo service postgresql restart"
fi

echo ""
echo "✨ Installation complete!"
echo ""
echo "💡 Tip: If you have issues connecting, you may need to:"
echo "   1. Edit /etc/postgresql/$PG_VERSION/main/postgresql.conf"
echo "   2. Set: listen_addresses = 'localhost'"
echo "   3. Edit /etc/postgresql/$PG_VERSION/main/pg_hba.conf"
echo "   4. Ensure local connections are allowed"
echo "   5. Restart: sudo service postgresql restart"

