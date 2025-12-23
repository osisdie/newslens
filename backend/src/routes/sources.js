const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/init');
const { checkUsageLimits, trackUsage } = require('../middleware/usageLimits');

const router = express.Router();

// Get all sources for user
router.get('/', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');

    const result = await query(
      `SELECT ns.id, ns.base_url, ns.created_at,
              COALESCE(json_agg(
                json_build_object('id', sk.id, 'keyword', sk.keyword, 'created_at', sk.created_at)
                ORDER BY sk.created_at
              ) FILTER (WHERE sk.id IS NOT NULL), '[]') as keywords
       FROM news_sources ns
       LEFT JOIN source_keywords sk ON ns.id = sk.source_id
       WHERE ns.user_id = $1
       GROUP BY ns.id, ns.base_url, ns.created_at
       ORDER BY ns.created_at DESC`,
      [req.user.id]
    );

    res.json({ sources: result.rows });
  } catch (error) {
    console.error('Get sources error:', error);
    res.status(500).json({ error: 'Failed to get sources' });
  }
});

// Create new source
router.post('/', [
  body('base_url').isURL().withMessage('Valid URL required'),
  body('keywords').isArray().withMessage('Keywords must be an array'),
  body('keywords.*').isString().trim().notEmpty()
], checkUsageLimits, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await trackUsage(req.user.id, 'api');

    const { base_url, keywords } = req.body;

    // Check subscription limits
    const subResult = await query(
      `SELECT status FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       AND (current_period_end IS NULL OR current_period_end > NOW())`,
      [req.user.id]
    );

    const isPaid = subResult.rows.length > 0;

    // Check source count limit
    const sourceCount = await query(
      'SELECT COUNT(*) as count FROM news_sources WHERE user_id = $1',
      [req.user.id]
    );

    const currentSourceCount = parseInt(sourceCount.rows[0].count);
    if (!isPaid && currentSourceCount >= 3) {
      return res.status(403).json({
        error: 'Free tier limit: Maximum 3 sources allowed',
        code: 'SOURCE_LIMIT_REACHED'
      });
    }

    // Check if source already exists
    const existing = await query(
      'SELECT id FROM news_sources WHERE user_id = $1 AND base_url = $2',
      [req.user.id, base_url]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Source already exists' });
    }

    // Create source
    const sourceResult = await query(
      'INSERT INTO news_sources (user_id, base_url) VALUES ($1, $2) RETURNING id',
      [req.user.id, base_url]
    );

    const sourceId = sourceResult.rows[0].id;

    // Add keywords
    const uniqueKeywords = [...new Set(keywords)];
    if (uniqueKeywords.length > 0) {
      // Check keyword limit per source
      if (!isPaid && uniqueKeywords.length > 3) {
        await query('DELETE FROM news_sources WHERE id = $1', [sourceId]);
        return res.status(403).json({
          error: 'Free tier limit: Maximum 3 keywords per source',
          code: 'KEYWORD_LIMIT_REACHED'
        });
      }

      for (const keyword of uniqueKeywords) {
        await query(
          'INSERT INTO source_keywords (source_id, keyword) VALUES ($1, $2)',
          [sourceId, keyword]
        );
      }
    }

    // Fetch created source with keywords
    const createdSource = await query(
      `SELECT ns.id, ns.base_url, ns.created_at,
              COALESCE(json_agg(
                json_build_object('id', sk.id, 'keyword', sk.keyword, 'created_at', sk.created_at)
                ORDER BY sk.created_at
              ) FILTER (WHERE sk.id IS NOT NULL), '[]') as keywords
       FROM news_sources ns
       LEFT JOIN source_keywords sk ON ns.id = sk.source_id
       WHERE ns.id = $1
       GROUP BY ns.id, ns.base_url, ns.created_at`,
      [sourceId]
    );

    res.status(201).json({ source: createdSource.rows[0] });
  } catch (error) {
    console.error('Create source error:', error);
    res.status(500).json({ error: 'Failed to create source' });
  }
});

// Update source keywords
router.put('/:sourceId/keywords', [
  body('keywords').isArray().withMessage('Keywords must be an array'),
  body('keywords.*').isString().trim().notEmpty()
], checkUsageLimits, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await trackUsage(req.user.id, 'api');

    const { sourceId } = req.params;
    const { keywords } = req.body;

    // Verify source belongs to user
    const sourceCheck = await query(
      'SELECT id FROM news_sources WHERE id = $1 AND user_id = $2',
      [sourceId, req.user.id]
    );

    if (sourceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Check subscription
    const subResult = await query(
      `SELECT status FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' 
       AND (current_period_end IS NULL OR current_period_end > NOW())`,
      [req.user.id]
    );

    const isPaid = subResult.rows.length > 0;

    // Check keyword limit
    const uniqueKeywords = [...new Set(keywords)];
    if (!isPaid && uniqueKeywords.length > 3) {
      return res.status(403).json({
        error: 'Free tier limit: Maximum 3 keywords per source',
        code: 'KEYWORD_LIMIT_REACHED'
      });
    }

    // Delete existing keywords
    await query('DELETE FROM source_keywords WHERE source_id = $1', [sourceId]);

    // Add new keywords
    for (const keyword of uniqueKeywords) {
      await query(
        'INSERT INTO source_keywords (source_id, keyword) VALUES ($1, $2)',
        [sourceId, keyword]
      );
    }

    // Remove articles that lost their keywords (due to keyword table reset)
    // so the next scrape will repopulate with the new keyword set.
    await query('DELETE FROM news_articles WHERE source_id = $1', [sourceId]);

    // Fetch updated source
    const updatedSource = await query(
      `SELECT ns.id, ns.base_url, ns.created_at,
              COALESCE(json_agg(
                json_build_object('id', sk.id, 'keyword', sk.keyword, 'created_at', sk.created_at)
                ORDER BY sk.created_at
              ) FILTER (WHERE sk.id IS NOT NULL), '[]') as keywords
       FROM news_sources ns
       LEFT JOIN source_keywords sk ON ns.id = sk.source_id
       WHERE ns.id = $1
       GROUP BY ns.id, ns.base_url, ns.created_at`,
      [sourceId]
    );

    res.json({ source: updatedSource.rows[0] });
  } catch (error) {
    console.error('Update keywords error:', error);
    res.status(500).json({ error: 'Failed to update keywords' });
  }
});

// Delete source
router.delete('/:sourceId', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');

    const { sourceId } = req.params;

    // Verify source belongs to user
    const sourceCheck = await query(
      'SELECT id FROM news_sources WHERE id = $1 AND user_id = $2',
      [sourceId, req.user.id]
    );

    if (sourceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Delete source (cascade will delete keywords and articles)
    await query('DELETE FROM news_sources WHERE id = $1', [sourceId]);

    res.json({ message: 'Source deleted' });
  } catch (error) {
    console.error('Delete source error:', error);
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

module.exports = router;

