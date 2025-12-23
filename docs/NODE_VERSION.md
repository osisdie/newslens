# Node.js Version Requirements

## Minimum Version

This project requires **Node.js 18+** for full functionality.

## Current Status

If you're seeing syntax errors like "Unexpected token '.'", you're likely using Node.js 12 or earlier, which doesn't support:
- Optional chaining (`?.`)
- Nullish coalescing (`??`)
- Other ES2020+ features

## Check Your Node.js Version

```bash
node --version
```

## Upgrade Node.js

### Using nvm (Recommended)

```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 18
nvm install 18

# Use Node.js 18
nvm use 18

# Set as default
nvm alias default 18
```

### Using nvm on WSL

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install and use Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

### Direct Download

Download Node.js 18+ from: https://nodejs.org/

## Verify Installation

```bash
node --version  # Should show v18.x.x or higher
npm --version
```

## Why Node.js 18+?

Many dependencies require Node.js 16+ or 18+:
- `cheerio@1.1.2` requires Node.js >=20.18.1
- `express-rate-limit@7.x` requires Node.js >=16
- `pg@8.x` requires Node.js >=16
- Modern JavaScript features improve code quality

## Temporary Workaround

If you must use Node.js 12 temporarily, the code has been updated to avoid optional chaining, but you may still encounter issues with:
- Package compatibility
- Performance
- Security updates

**Strongly recommended**: Upgrade to Node.js 18+ for best experience.

