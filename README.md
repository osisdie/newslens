# AI News Aggregator - iOS/Web App

A news aggregation application that allows users to track news from multiple sources based on their interests and keywords. Available on iOS and Web.

## Features

### Core Features
- **Multi-source News Aggregation**: Input news source websites and keywords to filter relevant articles
- **Smart Filtering**: Each source can have multiple keywords for targeted news discovery
- **Latest First**: News sorted by publication date (newest first)
- **News Analysis**: Each article tagged with:
  - Source and publication date
  - Fake news detection rate
  - Clickbait headline rate
  - Phishing detection rate

### Subscription Tiers
- **Free Tier**: 
  - 3 news source links
  - 3 keywords per link
- **Paid Tier**: 
  - Unlimited news source links
  - Unlimited keywords per link

### Billing Features
- Monthly subscription management
- Billing status and history
- Auto-renewal control (can stop auto-renew, no refunds)

### Authentication
- Login from web or iOS app
- Secure authentication system

## Tech Stack

### Frontend
- React Native (iOS + Web support)
- React Navigation
- AsyncStorage for local data

### Backend
- Node.js + Express
- PostgreSQL (or SQLite for development)
- JWT authentication
- News scraping with Puppeteer/Cheerio

### Infrastructure
- Low-cost cloud hosting (Railway/Render/Vercel)
- Usage quota limits to prevent billing spikes
- Daily and monthly usage tracking

## Project Structure

```
react-ai-news/
├── mobile/                 # React Native iOS app
├── web/                    # Web version (React)
├── backend/                # Node.js API server
├── shared/                 # Shared types and utilities
└── infrastructure/         # Deployment configs
```

## Getting Started

### Prerequisites
- **Node.js 20** (required - see [docs/SETUP_NODE.md](./docs/SETUP_NODE.md) to set as default)
- React Native CLI
- PostgreSQL (or SQLite for dev)
  - **WSL users**: Run `bash backend/scripts/install-postgresql-wsl.sh` for first-time setup
- iOS development tools (Xcode for iOS)

### Installation

1. Clone the repository
2. **Set up Node.js 20** (if not already default):
   ```bash
   npm run setup-node  # Sets Node.js 20 as default
   npm run setup-nvm   # Auto-loads nvm in your shell
   ```
3. Install dependencies (see [docs/INSTALL.md](./docs/INSTALL.md) for detailed instructions):
   ```bash
   # Install backend
   cd backend && npm install && cd ..
   
   # Install web
   cd web && npm install && cd ..
   
   # Install mobile (requires --legacy-peer-deps for Expo)
   cd mobile && npm install --legacy-peer-deps && cd ..
   ```
   
   **Note**: Due to React version differences between workspaces, install each separately. See [INSTALL.md](./INSTALL.md) for details.

3. Set up environment variables (see `backend/.env.example`)

4. Set up database:
   ```bash
   cd backend
   npm run create-db  # Creates DB and initializes schema
   # OR if DB already exists:
   npm run migrate     # Just initializes schema
   ```
   
   See [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md) for troubleshooting.

5. Start the backend:
   ```bash
   cd backend && npm run dev
   ```

6. Start the mobile app:
   ```bash
   cd mobile && npm run ios
   ```

7. Start the web app:
   ```bash
   cd web && npm start
   ```

## Environment Variables

### Backend

Copy `backend/.env.example` to `backend/.env` and configure:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens (generate with: `openssl rand -base64 32`)
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SUBSCRIPTION_PRICE_ID` - Stripe price ID for monthly subscription

**Optional (with defaults):**
- `PORT` - Server port (default: 3000)
- Usage quota limits (DAILY_API_LIMIT, MONTHLY_API_LIMIT, etc.)

See `backend/.env.example` for complete list with detailed comments.

For Stripe setup instructions, see [docs/STRIPE_SETUP.md](./docs/STRIPE_SETUP.md).

### Mobile/Web

Optional environment variables (defaults to `http://localhost:3000/api`):
- `EXPO_PUBLIC_API_URL` (mobile)
- `VITE_API_URL` (web)

## License

MIT

