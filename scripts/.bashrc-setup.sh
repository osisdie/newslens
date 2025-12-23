#!/bin/bash

# Script to add nvm auto-loading to your shell configuration
# This ensures Node.js 20 is automatically used when you open a terminal

echo "🔧 Setting up nvm auto-loading in shell configuration..."

# Detect shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_FILE="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_FILE="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    echo "⚠️  Could not detect shell. Defaulting to ~/.bashrc"
    SHELL_FILE="$HOME/.bashrc"
    SHELL_NAME="bash"
fi

echo "📝 Detected shell: $SHELL_NAME"
echo "📄 Configuration file: $SHELL_FILE"

# Check if nvm setup already exists
if grep -q "NVM_DIR" "$SHELL_FILE" 2>/dev/null; then
    echo "✅ nvm configuration already exists in $SHELL_FILE"
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping update."
        exit 0
    fi
    # Remove old nvm configuration
    sed -i '/# NVM Configuration/,/# End NVM Configuration/d' "$SHELL_FILE"
fi

# Add nvm configuration
echo "" >> "$SHELL_FILE"
echo "# NVM Configuration - Auto-load nvm and use Node.js 20" >> "$SHELL_FILE"
echo "export NVM_DIR=\"\$HOME/.nvm\"" >> "$SHELL_FILE"
echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"" >> "$SHELL_FILE"
echo "[ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\"" >> "$SHELL_FILE"
echo "" >> "$SHELL_FILE"
echo "# Auto-use Node.js 20 if available" >> "$SHELL_FILE"
echo "if command -v nvm &> /dev/null; then" >> "$SHELL_FILE"
echo "    nvm use 20 2>/dev/null || nvm use default 2>/dev/null" >> "$SHELL_FILE"
echo "fi" >> "$SHELL_FILE"
echo "# End NVM Configuration" >> "$SHELL_FILE"

echo "✅ Added nvm configuration to $SHELL_FILE"
echo ""
echo "🔄 To apply changes, run:"
echo "   source $SHELL_FILE"
echo ""
echo "Or open a new terminal window."

