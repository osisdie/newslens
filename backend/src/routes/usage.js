const express = require('express');
const { query } = require('../db/init');

const router = express.Router();

// Get usage statistics
router.get('/stats', async (req, res) => {
  try {
    const { period = 'month' } = req.query; // 'day' or 'month'
    const userId = req.user.id;

    let startDate;
    if (period === 'day') {
      startDate = new Date().toISOString().split('T')[0];
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    const result = await query(
      `SELECT 
         SUM(api_calls) as total_api_calls,
         SUM(scrape_requests) as total_scrape_requests,
         COUNT(DISTINCT date) as active_days
       FROM usage_tracking
       WHERE user_id = $1 AND date >= $2`,
      [userId, startDate]
    );

    const stats = result.rows[0];

    // Get subscription status for limits
    const subResult = await query(
      `SELECT status FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       AND (current_period_end IS NULL OR current_period_end > NOW())`,
      [userId]
    );

    const isPaid = subResult.rows.length > 0;

    res.json({
      period,
      start_date: startDate,
      usage: {
        api_calls: parseInt(stats.total_api_calls || 0),
        scrape_requests: parseInt(stats.total_scrape_requests || 0),
        active_days: parseInt(stats.active_days || 0)
      },
      limits: {
        daily_api: parseInt(process.env.DAILY_API_LIMIT || 10000),
        monthly_api: parseInt(process.env.MONTHLY_API_LIMIT || 300000),
        daily_scrape: parseInt(process.env.DAILY_SCRAPE_LIMIT || 1000),
        monthly_scrape: parseInt(process.env.MONTHLY_SCRAPE_LIMIT || 30000)
      },
      subscription_tier: isPaid ? 'paid' : 'free'
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

// Get daily usage breakdown
router.get('/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.id;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const result = await query(
      `SELECT date, api_calls, scrape_requests
       FROM usage_tracking
       WHERE user_id = $1 AND date >= $2
       ORDER BY date DESC`,
      [userId, startDate.toISOString().split('T')[0]]
    );

    res.json({
      daily_usage: result.rows,
      days: parseInt(days)
    });
  } catch (error) {
    console.error('Get daily usage error:', error);
    res.status(500).json({ error: 'Failed to get daily usage' });
  }
});

module.exports = router;

