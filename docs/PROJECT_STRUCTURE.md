# Project Structure

```
react-ai-news/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── db/            # Database initialization and schema
│   │   ├── middleware/    # Auth, error handling, usage limits
│   │   ├── routes/        # API routes (auth, news, sources, billing, usage)
│   │   ├── services/      # News scraping, analysis, scheduler
│   │   └── server.js      # Main server file
│   ├── package.json
│   └── .env.example      # Environment variables template
│
├── mobile/                 # React Native iOS app
│   ├── src/
│   │   ├── context/       # Auth context
│   │   ├── screens/       # App screens (Login, News, Sources, Billing, Profile)
│   │   └── services/      # API client
│   ├── App.js
│   ├── app.json
│   └── package.json
│
├── web/                    # React web app
│   ├── src/
│   │   ├── components/    # Layout components
│   │   ├── context/       # Auth context
│   │   ├── pages/         # Web pages (Login, News, Sources, Billing, Profile)
│   │   └── services/      # API client
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── infrastructure/         # Deployment configurations
│   ├── Dockerfile         # Docker container config
│   ├── docker-compose.yml # Local development with PostgreSQL
│   ├── railway.json       # Railway deployment
│   ├── render.yaml        # Render deployment
│   ├── vercel.json        # Vercel deployment
│   └── README.md          # Infrastructure docs
│
├── README.md              # Main project documentation
├── SETUP.md               # Setup instructions
├── .gitignore            # Git ignore rules
└── package.json           # Root workspace config
```

## Key Features Implemented

### Backend
- ✅ User authentication (JWT)
- ✅ News source management with keyword filtering
- ✅ News scraping from Yahoo News and Google News
- ✅ News analysis (fake news, clickbait, phishing detection)
- ✅ Subscription management (Stripe integration)
- ✅ Billing history and auto-renewal control
- ✅ Usage tracking and quota limits
- ✅ Scheduled news scraping (every 6 hours)

### Mobile (React Native)
- ✅ Login/Register screens
- ✅ News feed with analysis ratings
- ✅ Source management
- ✅ Billing/subscription management
- ✅ Profile screen

### Web (React)
- ✅ Responsive web interface
- ✅ Same features as mobile app
- ✅ Modern UI with Vite

### Infrastructure
- ✅ Docker support
- ✅ Railway deployment config
- ✅ Render deployment config
- ✅ Vercel deployment config
- ✅ Usage quota limits to prevent billing spikes

## Database Schema

- `users` - User accounts
- `subscriptions` - Subscription status and Stripe info
- `billing_history` - Payment history
- `news_sources` - User's news source URLs
- `source_keywords` - Keywords for each source
- `news_articles` - Scraped news articles with analysis
- `usage_tracking` - Daily/monthly usage statistics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### News Sources
- `GET /api/sources` - Get all sources
- `POST /api/sources` - Add new source
- `PUT /api/sources/:id/keywords` - Update keywords
- `DELETE /api/sources/:id` - Delete source

### News
- `GET /api/news` - Get news articles
- `GET /api/news/:id` - Get single article
- `POST /api/news/scrape/:sourceId` - Trigger scraping

### Billing
- `GET /api/billing/subscription` - Get subscription status
- `POST /api/billing/checkout` - Create checkout session
- `GET /api/billing/history` - Get billing history
- `POST /api/billing/cancel-auto-renew` - Cancel auto-renewal
- `POST /api/billing/enable-auto-renew` - Enable auto-renewal
- `POST /api/billing/webhook` - Stripe webhook handler

### Usage
- `GET /api/usage/stats` - Get usage statistics
- `GET /api/usage/daily` - Get daily usage breakdown

## Subscription Tiers

### Free Tier
- 3 news source links
- 3 keywords per source
- All other features available

### Paid Tier
- Unlimited news source links
- Unlimited keywords per source
- Monthly subscription via Stripe

## Usage Limits (Configurable)

- Daily API limit: 10,000 requests
- Monthly API limit: 300,000 requests
- Daily scrape limit: 1,000 requests
- Monthly scrape limit: 30,000 requests

These limits help prevent unexpected hosting costs.

