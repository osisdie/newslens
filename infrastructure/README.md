# Infrastructure Deployment

This directory contains configuration files for deploying the AI News Aggregator to various low-cost cloud providers.

## Deployment Options

### 1. Railway (Recommended for simplicity)
- Free tier: $5 credit/month
- Easy PostgreSQL integration
- Automatic deployments from Git

**Setup:**
1. Connect your GitHub repo to Railway
2. Add PostgreSQL service
3. Set environment variables from `.env.example`
4. Deploy

### 2. Render
- Free tier available (with limitations)
- PostgreSQL add-on available
- Auto-deploy from Git

**Setup:**
1. Create new Web Service on Render
2. Connect GitHub repo
3. Use `render.yaml` config
4. Add PostgreSQL database
5. Set environment variables

### 3. Vercel
- Free tier with generous limits
- Serverless functions
- Good for API-only deployment

**Setup:**
1. Connect GitHub repo to Vercel
2. Use `vercel.json` config
3. Set environment variables
4. Add external PostgreSQL (e.g., Supabase free tier)

### 4. Docker Compose (Local/Production)
For self-hosting or local development:

```bash
cd infrastructure
docker-compose up -d
```

## Environment Variables

Required environment variables (see `backend/.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `STRIPE_SECRET_KEY` - Stripe API key for billing
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `SUBSCRIPTION_PRICE_ID` - Stripe price ID for monthly subscription

## Usage Quotas

The application includes built-in quota limits to prevent unexpected billing:

- Daily API limit: 10,000 requests (configurable)
- Monthly API limit: 300,000 requests (configurable)
- Daily scrape limit: 1,000 requests (configurable)
- Monthly scrape limit: 30,000 requests (configurable)

These can be adjusted via environment variables.

## Database

PostgreSQL is required. Options:
- Railway PostgreSQL (included)
- Render PostgreSQL (add-on)
- Supabase (free tier available)
- Neon (free tier available)
- Self-hosted PostgreSQL

## Cost Optimization

1. **Use free tiers** where possible
2. **Set quota limits** to prevent billing spikes
3. **Monitor usage** via `/api/usage/stats` endpoint
4. **Use connection pooling** for database
5. **Enable caching** for frequently accessed data
6. **Schedule scrapes** during off-peak hours

## Monitoring

- Health check endpoint: `/health`
- Usage stats: `/api/usage/stats`
- Daily usage: `/api/usage/daily`

