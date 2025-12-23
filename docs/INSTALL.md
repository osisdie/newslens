# Installation Guide

## Quick Install

Due to React version conflicts between workspaces, install dependencies separately:

```bash
# Install backend dependencies
cd backend
npm install
cd ..

# Install web dependencies
cd web
npm install
cd ..

# Install mobile dependencies (requires --legacy-peer-deps for Expo)
cd mobile
npm install --legacy-peer-deps
cd ..
```

## Alternative: Install All at Once

If you want to install from the root, use:

```bash
npm install --legacy-peer-deps
```

This will install all workspace dependencies but may have some peer dependency warnings.

## Why Separate Installation?

The mobile app (React Native/Expo) and web app (React) have different React version requirements:
- **Mobile**: Uses React 18.2.0 (required by Expo 49)
- **Web**: Uses React ^18.2.0 (more flexible)

Installing separately avoids version conflicts and ensures each app gets the correct dependencies.

## Verify Installation

After installation, verify each workspace:

```bash
# Backend
cd backend && npm list --depth=0 && cd ..

# Web
cd web && npm list --depth=0 && cd ..

# Mobile
cd mobile && npm list --depth=0 && cd ..
```

## Troubleshooting

### If you see peer dependency errors:

1. **For mobile**: Always use `--legacy-peer-deps` flag
   ```bash
   cd mobile && npm install --legacy-peer-deps
   ```

2. **For web/backend**: Standard install should work
   ```bash
   cd web && npm install
   cd ../backend && npm install
   ```

### Clear cache if needed:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules
rm -rf mobile/node_modules
rm -rf web/node_modules
rm -rf backend/node_modules

# Then reinstall using the separate method above
```

