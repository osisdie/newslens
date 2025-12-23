const express = require('express');
const { query } = require('../db/init');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Get subscription status
router.get('/subscription', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, status, stripe_subscription_id, stripe_customer_id,
              current_period_start, current_period_end, auto_renew, created_at
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        subscription: {
          status: 'free',
          auto_renew: false
        }
      });
    }

    res.json({ subscription: result.rows[0] });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Create subscription checkout session
router.post('/checkout', async (req, res) => {
  try {
    // Get or create Stripe customer
    let customerId;
    const subResult = await query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );

    if (subResult.rows.length > 0 && subResult.rows[0].stripe_customer_id) {
      customerId = subResult.rows[0].stripe_customer_id;
    } else {
      const userResult = await query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const customer = await stripe.customers.create({
        email: userResult.rows[0].email
      });
      customerId = customer.id;

      // Update subscription record
      await query(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, status)
         VALUES ($1, $2, 'free')
         ON CONFLICT DO NOTHING`,
        [req.user.id, customerId]
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${req.body.success_url || 'http://localhost:3001/success'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: req.body.cancel_url || 'http://localhost:3001/cancel',
      metadata: {
        user_id: req.user.id.toString()
      }
    });

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get billing history
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT id, amount, currency, status, billing_date, stripe_payment_intent_id, created_at
       FROM billing_history
       WHERE user_id = $1
       ORDER BY billing_date DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json({
      history: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({ error: 'Failed to get billing history' });
  }
});

// Cancel auto-renewal
router.post('/cancel-auto-renew', async (req, res) => {
  try {
    // Get latest subscription for user
    const subResult = await query(
      `SELECT id, stripe_subscription_id, status 
       FROM subscriptions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.user.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscription = subResult.rows[0];

    // Cancel auto-renewal in Stripe if we have a subscription id
    if (subscription.stripe_subscription_id) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }

    // Update database and return updated row
    const updated = await query(
      `UPDATE subscriptions 
       SET auto_renew = false 
       WHERE id = $1 
       RETURNING id, status, auto_renew, stripe_subscription_id, current_period_end`,
      [subscription.id]
    );

    res.json({
      message: 'Auto-renewal cancelled. Subscription will remain active until the end of the current period.',
      subscription: updated.rows[0]
    });
  } catch (error) {
    console.error('Cancel auto-renew error:', error);
    res.status(500).json({ error: 'Failed to cancel auto-renewal' });
  }
});

// Re-enable auto-renewal
router.post('/enable-auto-renew', async (req, res) => {
  try {
    // Get latest subscription for user
    const subResult = await query(
      `SELECT id, stripe_subscription_id, status 
       FROM subscriptions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.user.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscription = subResult.rows[0];

    // Re-enable auto-renewal in Stripe if we have a subscription id
    if (subscription.stripe_subscription_id) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: false
      });
    }

    // Update database and return updated row
    const updated = await query(
      `UPDATE subscriptions 
       SET auto_renew = true 
       WHERE id = $1 
       RETURNING id, status, auto_renew, stripe_subscription_id, current_period_end`,
      [subscription.id]
    );

    res.json({
      message: 'Auto-renewal enabled',
      subscription: updated.rows[0]
    });
  } catch (error) {
    console.error('Enable auto-renew error:', error);
    res.status(500).json({ error: 'Failed to enable auto-renewal' });
  }
});

// Webhook handler (exported, mounted separately without auth/body parser)
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const userId = parseInt(session.metadata.user_id);
        
        if (session.mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          
          await query(
            `UPDATE subscriptions 
             SET status = 'active', 
                 stripe_subscription_id = $1,
                 current_period_start = to_timestamp($2),
                 current_period_end = to_timestamp($3),
                 auto_renew = true
             WHERE user_id = $4`,
            [
              subscription.id,
              subscription.current_period_start,
              subscription.current_period_end,
              userId
            ]
          );
        }
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const subResult = await query(
            'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
            [sub.id]
          );

          if (subResult.rows.length > 0) {
            await query(
              `INSERT INTO billing_history 
               (user_id, subscription_id, amount, currency, status, stripe_payment_intent_id)
               VALUES ($1, (SELECT id FROM subscriptions WHERE stripe_subscription_id = $2), $3, $4, 'paid', $5)`,
              [
                subResult.rows[0].user_id,
                sub.id,
                invoice.amount_paid / 100, // Convert from cents
                invoice.currency.toUpperCase(),
                invoice.payment_intent
              ]
            );

            // Update subscription period
            await query(
              `UPDATE subscriptions 
               SET current_period_start = to_timestamp($1),
                   current_period_end = to_timestamp($2)
               WHERE stripe_subscription_id = $3`,
              [sub.current_period_start, sub.current_period_end, sub.id]
            );
          }
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object;
        await query(
          `UPDATE subscriptions 
           SET status = 'expired', auto_renew = false
           WHERE stripe_subscription_id = $1`,
          [deletedSub.id]
        );
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

module.exports = {
  router,
  webhookHandler
};

