#!/usr/bin/env bash
#
# End-to-end subscription test:
#   free -> checkout -> active -> cancel auto-renew -> still active -> immediate cancel -> expired
#
# Prereqs:
#   1. backend running on :3000, web on :3001
#   2. ./scripts/stripe listen --forward-to localhost:3000/api/billing/webhook ... is running
#   3. backend/.env has STRIPE_SECRET_KEY, SUBSCRIPTION_PRICE_ID, STRIPE_WEBHOOK_SECRET set
#
# Usage:  ./scripts/test_subscription_flow.sh [test_email]

set -euo pipefail

API="${API:-http://localhost:3000/api}"
EMAIL="${1:-flow-$(date +%s)@example.com}"
PASSWORD="${TEST_USER_PASSWORD:-ChangeMe123!}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STRIPE_BIN="$PROJECT_ROOT/scripts/stripe"
DB_NAME="${DB_NAME:-ai_news}"

# Pull STRIPE_SECRET_KEY from root .env (single source of truth)
STRIPE_SECRET_KEY="$(grep -E '^STRIPE_SECRET_KEY=' "$PROJECT_ROOT/.env" | cut -d= -f2-)"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
err() { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

# 1. Register a fresh user (free tier by default)
say "1. Register $EMAIL"
REG=$(curl -sS -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$REG" | grep -oE '"token":"[^"]+"' | head -1 | cut -d'"' -f4)
[ -n "$TOKEN" ] || err "register failed: $REG"
ok "token=${TOKEN:0:30}..."

AUTH="Authorization: Bearer $TOKEN"

# 2. Assert default state is 'free'
say "2. Confirm initial subscription = free"
STATUS=$(curl -sS "$API/billing/subscription" -H "$AUTH" | grep -oE '"status":"[^"]+"' | head -1 | cut -d'"' -f4)
[ "$STATUS" = "free" ] && ok "status=free" || err "expected free, got: $STATUS"

# 3. Create a checkout session
say "3. POST /billing/checkout -> get Stripe-hosted URL"
CHECKOUT=$(curl -sS -X POST "$API/billing/checkout" -H "$AUTH" -H "Content-Type: application/json" -d '{}')
CHECKOUT_URL=$(echo "$CHECKOUT" | grep -oE '"checkout_url":"[^"]+"' | cut -d'"' -f4)
SESSION_ID=$(echo "$CHECKOUT" | grep -oE '"session_id":"[^"]+"' | cut -d'"' -f4)
[ -n "$CHECKOUT_URL" ] || err "no checkout_url: $CHECKOUT"
ok "session=$SESSION_ID"
echo "    URL: $CHECKOUT_URL"
echo
echo "  >> Open the URL above in a browser and pay with test card:"
echo "     4242 4242 4242 4242   any future date / any CVC / any ZIP"
echo "  >> When you're back at the success page, press ENTER here to continue..."
read -r _

# 4. Poll DB until webhook flips status -> active
say "4. Waiting for checkout.session.completed webhook"
for i in $(seq 1 30); do
  STATUS=$(curl -sS "$API/billing/subscription" -H "$AUTH" | grep -oE '"status":"[^"]+"' | head -1 | cut -d'"' -f4)
  [ "$STATUS" = "active" ] && break
  sleep 2
done
[ "$STATUS" = "active" ] && ok "status=active" || err "still $STATUS after 60s -- check 'stripe listen' output + backend log"

# Capture DB row snapshot (for the cancel step we need stripe_subscription_id)
SUB_ID=$(PGPASSWORD=password psql -h localhost -U postgres -d "$DB_NAME" -t -A -c \
  "SELECT stripe_subscription_id FROM subscriptions WHERE user_id=(SELECT id FROM users WHERE email='$EMAIL') ORDER BY created_at DESC LIMIT 1")
ok "stripe_subscription_id=$SUB_ID"

# 5. Soft cancel (cancel_at_period_end=true). Sub remains active.
say "5. POST /billing/cancel-auto-renew (graceful)"
curl -sS -X POST "$API/billing/cancel-auto-renew" -H "$AUTH" > /dev/null
ROW=$(curl -sS "$API/billing/subscription" -H "$AUTH")
echo "  $ROW"
echo "$ROW" | grep -q '"auto_renew":false' && ok "auto_renew=false (graceful cancel queued)" || err "auto_renew did not flip"
echo "$ROW" | grep -q '"status":"active"' && ok "still active until period_end (correct -- this is graceful cancel)"

# 6. Immediate cancel via Stripe CLI -> fires customer.subscription.deleted
say "6. Immediate cancel via Stripe API (forces deletion; webhook fires)"
"$STRIPE_BIN" --api-key "$STRIPE_SECRET_KEY" delete "/v1/subscriptions/$SUB_ID" > /dev/null
ok "Stripe sub deleted; waiting for webhook to flip DB"
for i in $(seq 1 15); do
  STATUS=$(curl -sS "$API/billing/subscription" -H "$AUTH" | grep -oE '"status":"[^"]+"' | head -1 | cut -d'"' -f4)
  [ "$STATUS" = "expired" ] && break
  sleep 2
done
[ "$STATUS" = "expired" ] && ok "status=expired (webhook customer.subscription.deleted handled)" || err "DB still $STATUS"

say "Done. Inspect:"
echo "  - DB:    PGPASSWORD=password psql -h localhost -U postgres -d ai_news -c \"SELECT * FROM subscriptions WHERE user_id=(SELECT id FROM users WHERE email='$EMAIL');\""
echo "  - Stripe Dashboard: https://dashboard.stripe.com/test/subscriptions"
echo "  - Stripe events:    https://dashboard.stripe.com/test/events"
echo "  - billing_history:  PGPASSWORD=password psql -h localhost -U postgres -d ai_news -c \"SELECT * FROM billing_history WHERE user_id=(SELECT id FROM users WHERE email='$EMAIL');\""
