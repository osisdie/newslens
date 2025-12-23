require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const sourcesRoutes = require('./routes/sources');
const { router: billingRoutes, webhookHandler: billingWebhookHandler } = require('./routes/billing');
const usageRoutes = require('./routes/usage');
const favoritesRoutes = require('./routes/favorites');
const { initializeDatabase } = require('./db/init');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const { initializeScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : '*';
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Stripe webhook must come before express.json and without auth
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/news', authenticateToken, newsRoutes);
app.use('/api/sources', authenticateToken, sourcesRoutes);
app.use('/api/billing', authenticateToken, billingRoutes);
app.use('/api/usage', authenticateToken, usageRoutes);
app.use('/api/favorites', authenticateToken, favoritesRoutes);

// Error handling
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized');
    
    // Initialize scheduled tasks
    if (process.env.NODE_ENV !== 'test') {
      initializeScheduler();
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

