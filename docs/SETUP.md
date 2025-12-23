# Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or use a cloud provider)
- Stripe account (for billing features)
- For iOS development: Xcode and CocoaPods

## Quick Start

### 1. Clone and Install

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install mobile dependencies
cd mobile && npm install && cd ..

# Install web dependencies
cd web && npm install && cd ..
```

### 2. Install PostgreSQL (If Not Installed)

#### For WSL Users (First Time Setup)

If you're using WSL and don't have PostgreSQL installed:

```bash
cd backend/scripts
chmod +x install-postgresql-wsl.sh
./install-postgresql-wsl.sh
```

Or:

```bash
cd backend
bash scripts/install-postgresql-wsl.sh
```

See [backend/WSL_POSTGRESQL_SETUP.md](./backend/WSL_POSTGRESQL_SETUP.md) for detailed instructions and troubleshooting.

#### For Other Linux/Mac Users

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Then proceed to Database Setup below
```

### 3. Database Setup

#### Option A: Automatic Setup (Recommended)

```bash
cd backend
npm run create-db
```

This script will:
- Create the database if it doesn't exist
- Initialize all tables and schema automatically

#### Option B: Manual Setup - Local PostgreSQL

```bash
# Using command line
psql -U postgres -c "CREATE DATABASE ai_news;"

# Or using createdb
createdb -U postgres ai_news

# Then initialize schema
cd backend
npm run migrate
```

**Note**: If you get "Cannot create a database when multi-database mode is disabled" error, use the command line method above or see [DATABASE_SETUP.md](./backend/DATABASE_SETUP.md) for troubleshooting.

#### Option D: Cloud Database (Recommended for Production)

Use one of these free tier options (database is auto-created):
- **Supabase**: https://supabase.com (free tier available)
- **Neon**: https://neon.tech (free tier available)
- **Railway**: Includes PostgreSQL with $5 credit/month
- **Render**: Free tier available

For cloud databases:
1. Create a project/database in the provider
2. Copy the connection string
3. Update `DATABASE_URL` in `.env`
4. Run `npm run migrate` to initialize schema

See [backend/DATABASE_SETUP.md](./backend/DATABASE_SETUP.md) for detailed instructions.

### 4. Environment Variables

#### Backend

Create `backend/.env` from `backend/.env.example`:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and configure all required variables. The `.env.example` file contains detailed comments for each variable.

**Required variables:**
- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: A random secret string (generate with: `openssl rand -base64 32`)
- `STRIPE_SECRET_KEY`: Your Stripe secret key (see [STRIPE_SETUP.md](./backend/STRIPE_SETUP.md))
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret
- `SUBSCRIPTION_PRICE_ID`: Your Stripe price ID for monthly subscription

**Optional variables** (have defaults):
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `JWT_EXPIRES_IN`: Token expiration (default: 7d)
- Usage quota limits (DAILY_API_LIMIT, MONTHLY_API_LIMIT, etc.)

See `backend/.env.example` for complete list with descriptions.

#### Mobile

Create `mobile/.env` (optional, defaults to localhost):

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

#### Web

Create `web/.env` (optional, defaults to localhost):

```
VITE_API_URL=http://localhost:3000/api
```

### 5. Initialize Database

**Option 1: Automatic (creates DB + schema)**
```bash
cd backend
npm run create-db
```

**Option 2: Manual (if DB already exists)**
```bash
cd backend
npm run migrate
```

The database will also auto-initialize on first server start if tables don't exist.

### 6. Start Development Servers

#### Terminal 1: Backend
```bash
cd backend
npm run dev
```

#### Terminal 2: Web App
```bash
cd web
npm start
```

#### Terminal 3: Mobile App (iOS)
```bash
cd mobile
npm run ios
```

## Stripe Setup

See the detailed guide: [backend/STRIPE_SETUP.md](./backend/STRIPE_SETUP.md)

Quick steps:
1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Create a product and price for monthly subscription
4. Set up webhook endpoint (see STRIPE_SETUP.md for details)
5. Add webhook events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`

## Deployment

### Railway (Recommended)

1. Connect your GitHub repo to Railway
2. Add PostgreSQL service
3. Set environment variables
4. Deploy

See `infrastructure/README.md` for more details.

### Other Options

- **Render**: Use `infrastructure/render.yaml`
- **Vercel**: Use `infrastructure/vercel.json`
- **Docker**: Use `infrastructure/Dockerfile` and `docker-compose.yml`

## Testing

### Backend API

```bash
cd backend
npm test
```

### Manual Testing

1. Register a new user
2. Add a news source (e.g., https://tw.news.yahoo.com/)
3. Add keywords (e.g., "AI", "Technology")
4. Trigger news scraping via API: `POST /api/news/scrape/:sourceId`
5. View news articles: `GET /api/news`

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Ensure database exists

### Stripe Webhook Issues

- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`
- Verify webhook secret matches

### Mobile App Issues

- Clear Expo cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Next Steps

- Configure news scraping schedule (default: every 6 hours)
- Adjust usage quotas in environment variables
- Set up monitoring and alerts
- Customize news analysis algorithms

