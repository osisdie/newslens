#!/bin/bash

# Quick script to load nvm in current shell session
# Run: source scripts/load-nvm.sh

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Use Node.js 20
nvm use 20 2>/dev/null || nvm use default 2>/dev/null

echo "✅ nvm loaded"
echo "📦 Node.js version: $(node --version)"
echo "📍 Node.js path: $(which node)"

