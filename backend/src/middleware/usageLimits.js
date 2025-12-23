const { query } = require('../db/init');

// Check usage limits based on subscription tier
async function checkUsageLimits(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Get user's subscription status
    const subResult = await query(
      `SELECT status FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       AND (current_period_end IS NULL OR current_period_end > NOW())`,
      [userId]
    );

    const isPaid = subResult.rows.length > 0;

    // Get today's usage
    const todayUsage = await query(
      'SELECT api_calls, scrape_requests FROM usage_tracking WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const todayApiCalls = (todayUsage.rows[0] && todayUsage.rows[0].api_calls) || 0;
    const todayScrapes = (todayUsage.rows[0] && todayUsage.rows[0].scrape_requests) || 0;

    // Get monthly usage
    const monthlyUsage = await query(
      `SELECT SUM(api_calls) as total_api, SUM(scrape_requests) as total_scrapes 
       FROM usage_tracking 
       WHERE user_id = $1 AND date >= $2`,
      [userId, monthStart]
    );

    const monthlyApiCalls = parseInt((monthlyUsage.rows[0] && monthlyUsage.rows[0].total_api) || 0);
    const monthlyScrapes = parseInt((monthlyUsage.rows[0] && monthlyUsage.rows[0].total_scrapes) || 0);

    // Check limits
    const dailyApiLimit = parseInt(process.env.DAILY_API_LIMIT || 10000);
    const monthlyApiLimit = parseInt(process.env.MONTHLY_API_LIMIT || 300000);
    const dailyScrapeLimit = parseInt(process.env.DAILY_SCRAPE_LIMIT || 1000);
    const monthlyScrapeLimit = parseInt(process.env.MONTHLY_SCRAPE_LIMIT || 30000);

    if (todayApiCalls >= dailyApiLimit) {
      return res.status(429).json({
        error: 'Daily API limit reached',
        limit: dailyApiLimit,
        used: todayApiCalls
      });
    }

    if (monthlyApiCalls >= monthlyApiLimit) {
      return res.status(429).json({
        error: 'Monthly API limit reached',
        limit: monthlyApiLimit,
        used: monthlyApiCalls
      });
    }

    // Attach usage info to request
    req.usage = {
      isPaid,
      todayApiCalls,
      todayScrapes,
      monthlyApiCalls,
      monthlyScrapes,
      limits: {
        dailyApi: dailyApiLimit,
        monthlyApi: monthlyApiLimit,
        dailyScrape: dailyScrapeLimit,
        monthlyScrape: monthlyScrapeLimit
      }
    };

    next();
  } catch (error) {
    console.error('Error checking usage limits:', error);
    return res.status(500).json({ error: 'Error checking usage limits' });
  }
}

// Track API usage
async function trackUsage(userId, type = 'api') {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    if (type === 'api') {
      await query(
        `INSERT INTO usage_tracking (user_id, date, api_calls) 
         VALUES ($1, $2, 1)
         ON CONFLICT (user_id, date) 
         DO UPDATE SET api_calls = usage_tracking.api_calls + 1`,
        [userId, today]
      );
    } else if (type === 'scrape') {
      await query(
        `INSERT INTO usage_tracking (user_id, date, scrape_requests) 
         VALUES ($1, $2, 1)
         ON CONFLICT (user_id, date) 
         DO UPDATE SET scrape_requests = usage_tracking.scrape_requests + 1`,
        [userId, today]
      );
    }
  } catch (error) {
    console.error('Error tracking usage:', error);
    // Don't throw - usage tracking failure shouldn't break the request
  }
}

module.exports = {
  checkUsageLimits,
  trackUsage
};

