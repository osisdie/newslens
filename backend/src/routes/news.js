const express = require('express');
const { query } = require('../db/init');
const { checkUsageLimits, trackUsage } = require('../middleware/usageLimits');
const { scrapeNews } = require('../services/newsScraper');
const { analyzeNews } = require('../services/newsAnalyzer');

const router = express.Router();

// Get news articles for user
router.get('/', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');

    const { sourceId, keywordId, limit = 50, offset = 0 } = req.query;

    let newsQuery = `
      SELECT na.id, na.title, na.url, na.description, na.author, na.published_at, 
             na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
             ns.base_url as source_url,
             sk.keyword
      FROM news_articles na
      JOIN news_sources ns ON na.source_id = ns.id
      LEFT JOIN source_keywords sk ON na.keyword_id = sk.id
      WHERE ns.user_id = $1
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (sourceId) {
      newsQuery += ` AND na.source_id = $${paramIndex}`;
      params.push(sourceId);
      paramIndex++;
    }

    if (keywordId) {
      newsQuery += ` AND na.keyword_id = $${paramIndex}`;
      params.push(keywordId);
      paramIndex++;
    }

    newsQuery += ` ORDER BY na.published_at DESC NULLS LAST, na.scraped_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(newsQuery, params);

    res.json({
      articles: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get news error:', error);
    res.status(500).json({ error: 'Failed to get news' });
  }
});

// Trigger news scraping for a source
router.post('/scrape/:sourceId', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'scrape');

    const { sourceId } = req.params;

    // Verify source belongs to user
    const sourceResult = await query(
      `SELECT ns.id, ns.base_url, 
              COALESCE(json_agg(sk.keyword) FILTER (WHERE sk.keyword IS NOT NULL), '[]') as keywords
       FROM news_sources ns
       LEFT JOIN source_keywords sk ON ns.id = sk.source_id
       WHERE ns.id = $1 AND ns.user_id = $2
       GROUP BY ns.id, ns.base_url`,
      [sourceId, req.user.id]
    );

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    const source = sourceResult.rows[0];
    const keywords = source.keywords || [];

    if (keywords.length === 0) {
      return res.status(400).json({ error: 'No keywords configured for this source' });
    }

    // Scrape news for each keyword
    const scrapedArticles = [];
    for (const keyword of keywords) {
      try {
        const keywordResult = await query(
          'SELECT id FROM source_keywords WHERE source_id = $1 AND keyword = $2',
          [sourceId, keyword]
        );

        if (keywordResult.rows.length === 0) continue;

        const keywordId = keywordResult.rows[0].id;
        const articles = await scrapeNews(source.base_url, keyword);

        // Save articles
        for (const article of articles) {
          // Check if article already exists
          const existing = await query(
            'SELECT id FROM news_articles WHERE source_id = $1 AND url = $2',
            [sourceId, article.url]
          );

          if (existing.rows.length === 0) {
            // Analyze article
            const analysis = await analyzeNews(article);

            const insertResult = await query(
              `INSERT INTO news_articles 
               (source_id, keyword_id, title, url, description, author, published_at, 
                fake_news_rate, clickbait_rate, phishing_rate, analyzed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
               RETURNING id`,
              [
                sourceId,
                keywordId,
                article.title,
                article.url,
                article.description,
                article.author || null,
                article.publishedAt,
                analysis.fakeNewsRate,
                analysis.clickbaitRate,
                analysis.phishingRate
              ]
            );

            scrapedArticles.push({
              id: insertResult.rows[0].id,
              ...article,
              ...analysis
            });
          }
        }
      } catch (error) {
        console.error(`Error scraping keyword ${keyword}:`, error);
        // Continue with other keywords
      }
    }

    res.json({
      message: 'Scraping completed',
      articlesScraped: scrapedArticles.length,
      articles: scrapedArticles
    });
  } catch (error) {
    console.error('Scrape news error:', error);
    res.status(500).json({ error: 'Failed to scrape news' });
  }
});

// Trigger news scraping for all of a user's sources
router.post('/scrape', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'scrape');

    console.log(`[Scrape] Starting scrape for user ${req.user.id}`);

    const sourcesResult = await query(
      `SELECT ns.id as source_id, ns.base_url,
              COALESCE(
                json_agg(json_build_object('id', sk.id, 'keyword', sk.keyword))
                FILTER (WHERE sk.id IS NOT NULL),
                '[]'
              ) as keywords
       FROM news_sources ns
       LEFT JOIN source_keywords sk ON ns.id = sk.source_id
       WHERE ns.user_id = $1
       GROUP BY ns.id, ns.base_url`,
      [req.user.id]
    );

    const sources = sourcesResult.rows || [];
    console.log(`[Scrape] Found ${sources.length} source(s) for user ${req.user.id}`);
    
    if (sources.length === 0) {
      return res.status(400).json({ error: 'No sources configured for this user' });
    }

    const scrapedArticles = [];

    for (const source of sources) {
      const keywords = source.keywords || [];
      console.log(`[Scrape] Processing source ${source.source_id} (${source.base_url}) with ${keywords.length} keyword(s)`);
      
      if (keywords.length === 0) {
        console.log(`[Scrape] Skipping source ${source.source_id} - no keywords`);
        continue;
      }

      for (const keyword of keywords) {
        try {
          console.log(`[Scrape] Scraping keyword "${keyword.keyword}" from ${source.base_url}`);
          const articles = await scrapeNews(source.base_url, keyword.keyword);
          console.log(`[Scrape] Found ${articles.length} article(s) for keyword "${keyword.keyword}"`);

          for (const article of articles) {
            const existing = await query(
              'SELECT id, keyword_id FROM news_articles WHERE source_id = $1 AND url = $2',
              [source.source_id, article.url]
            );

            if (existing.rows.length === 0) {
              // New article - insert it
              const analysis = await analyzeNews(article);

              const insertResult = await query(
                `INSERT INTO news_articles 
                 (source_id, keyword_id, title, url, description, author, published_at, 
                  fake_news_rate, clickbait_rate, phishing_rate, analyzed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                 RETURNING id`,
                [
                  source.source_id,
                  keyword.id,
                  article.title,
                  article.url,
                  article.description,
                  article.author || null,
                  article.publishedAt,
                  analysis.fakeNewsRate,
                  analysis.clickbaitRate,
                  analysis.phishingRate
                ]
              );

              scrapedArticles.push({
                id: insertResult.rows[0].id,
                ...article,
                ...analysis
              });
              console.log(`[Scrape] Saved new article: "${article.title.substring(0, 50)}..." for keyword "${keyword.keyword}"`);
            } else {
              // Article exists - update keyword_id and author if needed
              const existingArticle = existing.rows[0];
              if (!existingArticle.keyword_id || article.author) {
                await query(
                  'UPDATE news_articles SET keyword_id = $1, author = COALESCE($2, author) WHERE id = $3',
                  [keyword.id, article.author || null, existingArticle.id]
                );
                console.log(`[Scrape] Updated article: "${article.title.substring(0, 50)}..." with keyword "${keyword.keyword}"${article.author ? ` and author "${article.author}"` : ''}`);
                scrapedArticles.push({
                  id: existingArticle.id,
                  ...article
                });
              } else {
                console.log(`[Scrape] Skipped duplicate article: "${article.title.substring(0, 50)}..." (already exists with keyword_id: ${existingArticle.keyword_id})`);
              }
            }
          }
        } catch (error) {
          console.error(`Error scraping keyword ${keyword.keyword} for source ${source.source_id}:`, error);
        }
      }
    }

    console.log(`[Scrape] Completed. Total articles scraped: ${scrapedArticles.length}`);
    res.json({
      message: 'Scraping completed',
      articlesScraped: scrapedArticles.length,
      articles: scrapedArticles
    });
  } catch (error) {
    console.error('[Scrape] Error:', error);
    res.status(500).json({ error: 'Failed to scrape news' });
  }
});

// Get single article
router.get('/:articleId', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');

    const { articleId } = req.params;

    const result = await query(
      `SELECT na.*, ns.base_url as source_url, sk.keyword
       FROM news_articles na
       JOIN news_sources ns ON na.source_id = ns.id
       LEFT JOIN source_keywords sk ON na.keyword_id = sk.id
       WHERE na.id = $1 AND ns.user_id = $2`,
      [articleId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: result.rows[0] });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

module.exports = router;

