#!/bin/bash

# Setup Node.js 20 for this project
# Run this script to ensure Node.js 20 is set as default

echo "🔧 Setting up Node.js 20 for AI News Aggregator project..."

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if nvm is available
if ! command -v nvm &> /dev/null; then
    echo "❌ nvm is not loaded. Please install nvm first:"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    exit 1
fi

# Install Node.js 20 if not already installed
if ! nvm list 20 &> /dev/null || [ -z "$(nvm list 20 | grep -v 'N/A')" ]; then
    echo "📥 Installing Node.js 20..."
    nvm install 20
fi

# Use Node.js 20
echo "🔄 Switching to Node.js 20..."
nvm use 20

# Set as default
echo "⚙️  Setting Node.js 20 as default..."
nvm alias default 20

# Verify
NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

if [[ $NODE_VERSION == v20* ]]; then
    echo "✅ Successfully set Node.js 20 as default!"
    echo ""
    echo "💡 To make this permanent, add to your ~/.bashrc or ~/.zshrc:"
    echo "   export NVM_DIR=\"\$HOME/.nvm\""
    echo "   [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\""
    echo "   [ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\""
else
    echo "⚠️  Warning: Node.js version is not v20.x.x"
    echo "   Current version: $NODE_VERSION"
fi

