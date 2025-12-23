const jwt = require('jsonwebtoken');
const { query } = require('../db/init');

// Authenticate JWT token
async function authenticateToken(req, res, next) {
  console.log(`[Auth] ${req.method} ${req.path}`);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('[Auth] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const result = await query('SELECT id, email FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    
    console.log(`[Auth] Authenticated user ${req.user.id} (${req.user.email})`);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Check if user has active subscription
async function requireSubscription(req, res, next) {
  try {
    const result = await query(
      `SELECT status FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       AND (current_period_end IS NULL OR current_period_end > NOW())`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Active subscription required',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error checking subscription' });
  }
}

module.exports = {
  authenticateToken,
  requireSubscription
};

