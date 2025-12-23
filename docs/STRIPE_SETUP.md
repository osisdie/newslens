# Stripe Setup Guide

This guide will help you set up Stripe for billing and subscription management.

## Step 1: Create a Stripe Account

1. Go to https://stripe.com and create an account
2. Complete the account setup (you can use test mode for development)

## Step 2: Get Your API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for production)
3. Add it to your `.env` file as `STRIPE_SECRET_KEY`

## Step 3: Create a Product and Price

1. Go to https://dashboard.stripe.com/products
2. Click **"Add product"**
3. Fill in the product details:
   - **Name**: "AI News Aggregator Monthly Subscription"
   - **Description**: "Monthly subscription for unlimited news sources and keywords"
   - **Pricing model**: Recurring
   - **Price**: Set your monthly price (e.g., $9.99)
   - **Billing period**: Monthly
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_`)
6. Add it to your `.env` file as `SUBSCRIPTION_PRICE_ID`

## Step 4: Set Up Webhooks

Webhooks allow Stripe to notify your server about payment events.

### For Local Development:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_`)
5. Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`

### For Production:

1. Go to https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Enter your webhook URL: `https://your-domain.com/api/billing/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. Click on the endpoint to view details
7. Copy the **Signing secret** (starts with `whsec_`)
8. Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`

## Step 5: Test Your Setup

### Test Checkout Flow:

1. Start your backend server
2. Register/login to your app
3. Navigate to billing page
4. Click "Subscribe Now"
5. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
6. Complete the checkout
7. Verify subscription status updates in your app

### Test Webhook Events:

1. Use Stripe Dashboard to send test webhook events
2. Or use Stripe CLI: `stripe trigger checkout.session.completed`
3. Check your server logs to verify webhook processing

## Test Cards

Stripe provides test cards for different scenarios:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

See full list: https://stripe.com/docs/testing

## Switching to Production

1. Get your **live** API keys from Stripe Dashboard
2. Update `STRIPE_SECRET_KEY` in production `.env`
3. Create a live product/price (or use the same Price ID if compatible)
4. Update `SUBSCRIPTION_PRICE_ID` if needed
5. Set up production webhook endpoint
6. Update `STRIPE_WEBHOOK_SECRET` with production webhook secret

## Troubleshooting

### Webhook not receiving events:
- Verify webhook URL is accessible
- Check webhook secret matches
- Ensure events are selected in Stripe Dashboard
- Check server logs for errors

### Subscription not updating:
- Verify webhook is configured correctly
- Check database connection
- Review server logs for webhook processing errors
- Test webhook manually using Stripe CLI

### Payment failing:
- Verify Stripe API keys are correct
- Check if using test keys with test cards
- Ensure Price ID exists and is active
- Review Stripe Dashboard for error details

## Additional Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Stripe Testing: https://stripe.com/docs/testing

