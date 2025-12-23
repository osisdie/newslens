const express = require('express');
const { query } = require('../db/init');
const { checkUsageLimits, trackUsage } = require('../middleware/usageLimits');

const router = express.Router();

// Get favorites for user
router.get('/', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');

    const result = await query(
      `SELECT f.id as favorite_id, f.created_at,
              na.id, na.title, na.url, na.description, na.published_at,
              na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
              ns.base_url as source_url, sk.keyword
       FROM favorites f
       JOIN news_articles na ON f.article_id = na.id
       JOIN news_sources ns ON na.source_id = ns.id
       LEFT JOIN source_keywords sk ON na.keyword_id = sk.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT 200`,
      [req.user.id]
    );

    res.json({ favorites: result.rows });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Add favorite
router.post('/:articleId', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');
    const { articleId } = req.params;

    // Ensure article belongs to user
    const articleCheck = await query(
      `SELECT na.id
       FROM news_articles na
       JOIN news_sources ns ON na.source_id = ns.id
       WHERE na.id = $1 AND ns.user_id = $2`,
      [articleId, req.user.id]
    );

    if (articleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found for this user' });
    }

    const result = await query(
      `INSERT INTO favorites (user_id, article_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, article_id) DO UPDATE SET created_at = NOW()
       RETURNING id, created_at`,
      [req.user.id, articleId]
    );

    res.json({ favoriteId: result.rows[0].id });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove favorite
router.delete('/:articleId', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');
    const { articleId } = req.params;

    await query(
      `DELETE FROM favorites
       WHERE user_id = $1 AND article_id = $2`,
      [req.user.id, articleId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;


