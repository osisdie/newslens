const express = require('express');
const { query } = require('../db/init');
const { checkUsageLimits, trackUsage } = require('../middleware/usageLimits');
const { scrapeNews } = require('../services/newsScraper');
const { analyzeNews } = require('../services/newsAnalyzer');

const router = express.Router();

// Helper function to tag an article with all matching keywords from a source
async function tagArticleWithMatchingKeywords(articleId, articleTitle, articleDescription, sourceId, keywords) {
  const articleText = `${articleTitle} ${articleDescription || ''}`.toLowerCase();
  const matchingKeywords = [];

  for (const kw of keywords) {
    const keywordLower = kw.keyword.toLowerCase();
    // Check if keyword appears in title or description
    if (articleText.includes(keywordLower)) {
      matchingKeywords.push(kw.id);
    }
  }

  // Remove existing tags and add all matching ones
  await query('DELETE FROM article_keywords WHERE article_id = $1', [articleId]);
  
  for (const keywordId of matchingKeywords) {
    try {
      await query(
        'INSERT INTO article_keywords (article_id, keyword_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [articleId, keywordId]
      );
    } catch (error) {
      console.error(`[Scrape] Error tagging article ${articleId} with keyword ${keywordId}:`, error);
    }
  }

  return matchingKeywords.length;
}

// Get news articles for user
router.get('/', checkUsageLimits, async (req, res) => {
  try {
    await trackUsage(req.user.id, 'api');

    const { sourceId, keywordId, limit = 50, offset = 0 } = req.query;

    // Check if article_keywords table exists, if not use fallback query
    let useNewQuery = true;
    try {
      await query('SELECT 1 FROM article_keywords LIMIT 1');
    } catch (error) {
      console.log('[News] article_keywords table does not exist, using fallback query');
      useNewQuery = false;
    }

    let newsQuery;
    const params = [req.user.id];
    let paramIndex = 2;

    if (useNewQuery) {
      // New query with article_keywords junction table
      // Use array_agg and convert to JSON to avoid JSON comparison issues
      newsQuery = `
        SELECT na.id, na.title, na.url, na.description, na.author, na.published_at, 
               na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
               ns.base_url as source_url,
               COALESCE(
                 (
                   SELECT json_agg(DISTINCT sk.keyword ORDER BY sk.keyword)::text
                   FROM article_keywords ak
                   JOIN source_keywords sk ON ak.keyword_id = sk.id
                   WHERE ak.article_id = na.id AND sk.keyword IS NOT NULL
                 ),
                 '[]'
               ) as keywords
        FROM news_articles na
        JOIN news_sources ns ON na.source_id = ns.id
        WHERE ns.user_id = $1
      `;

      if (sourceId) {
        newsQuery += ` AND na.source_id = $${paramIndex}`;
        params.push(sourceId);
        paramIndex++;
      }

      if (keywordId) {
        // Filter by keyword - article must have this keyword
        newsQuery += ` AND EXISTS (
          SELECT 1 FROM article_keywords ak2 
          WHERE ak2.article_id = na.id AND ak2.keyword_id = $${paramIndex}
        )`;
        params.push(keywordId);
        paramIndex++;
      }
    } else {
      // Fallback query using old keyword_id field
      newsQuery = `
        SELECT na.id, na.title, na.url, na.description, na.author, na.published_at, 
               na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
               ns.base_url as source_url,
               CASE 
                 WHEN sk.keyword IS NOT NULL THEN json_build_array(sk.keyword)::text
                 ELSE '[]'
               END as keywords
        FROM news_articles na
        JOIN news_sources ns ON na.source_id = ns.id
        LEFT JOIN source_keywords sk ON na.keyword_id = sk.id
        WHERE ns.user_id = $1
      `;

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
    }

    newsQuery += ` 
      ORDER BY na.published_at DESC NULLS LAST, na.scraped_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    console.log('[News] Executing query (using', useNewQuery ? 'new' : 'fallback', 'format)');
    console.log('[News] Query params:', params);
    
    const result = await query(newsQuery, params);

    console.log('[News] Query returned', result.rows.length, 'articles');

    // Transform results to include keywords array and single keyword for backward compatibility
    const articles = result.rows.map(row => {
      // Handle keywords - ensure it's always an array
      // keywords is now returned as text (JSON string), so parse it
      let keywords = [];
      if (row.keywords) {
        if (Array.isArray(row.keywords)) {
          keywords = row.keywords.filter(k => k !== null);
        } else if (typeof row.keywords === 'string') {
          try {
            const parsed = JSON.parse(row.keywords);
            keywords = Array.isArray(parsed) ? parsed.filter(k => k !== null) : [];
          } catch (e) {
            console.log('[News] Error parsing keywords JSON:', row.keywords, e.message);
            keywords = [];
          }
        }
      }
      
      return {
        ...row,
        keywords: keywords,
        keyword: keywords.length > 0 ? keywords[0] : null // First keyword for backward compatibility
      };
    });

    console.log('[News] Returning', articles.length, 'articles to frontend');
    if (articles.length > 0) {
      console.log('[News] First article sample:', {
        id: articles[0].id,
        title: articles[0].title?.substring(0, 50),
        keywords: articles[0].keywords,
        keyword: articles[0].keyword
      });
    }

    res.json({
      articles: articles,
      count: articles.length
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

    // Verify source belongs to user and get keywords with IDs
    const sourceResult = await query(
      `SELECT ns.id, ns.base_url, 
              COALESCE(
                json_agg(json_build_object('id', sk.id, 'keyword', sk.keyword))
                FILTER (WHERE sk.id IS NOT NULL),
                '[]'
              ) as keywords
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

    // Collect all articles from all keywords first
    const allArticles = new Map(); // url -> article data

    for (const keyword of keywords) {
      try {
        const articles = await scrapeNews(source.base_url, keyword.keyword);

        for (const article of articles) {
          if (!allArticles.has(article.url)) {
            allArticles.set(article.url, article);
          }
        }
      } catch (error) {
        console.error(`Error scraping keyword ${keyword.keyword} for source ${sourceId}:`, error);
      }
    }

    // Process all collected articles
    const scrapedArticles = [];
    for (const [url, article] of allArticles) {
      const existing = await query(
        'SELECT id, keyword_id, title, description FROM news_articles WHERE source_id = $1 AND url = $2',
        [sourceId, url]
      );

      let articleId;
      let isNew = false;

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
            sourceId,
            keywords[0].id, // Keep first keyword for backward compatibility
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

        articleId = insertResult.rows[0].id;
        isNew = true;
        scrapedArticles.push({
          id: articleId,
          ...article,
          ...analysis
        });
      } else {
        // Article exists - update author if needed
        articleId = existing.rows[0].id;
        const existingArticle = existing.rows[0];
        
        if (article.author && !existingArticle.author) {
          await query(
            'UPDATE news_articles SET author = $1 WHERE id = $2',
            [article.author, articleId]
          );
        }
      }

      // Tag article with all matching keywords
      await tagArticleWithMatchingKeywords(
        articleId,
        article.title,
        article.description,
        sourceId,
        keywords
      );
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

      // Collect all articles from all keywords first
      const allArticles = new Map(); // url -> article data

      for (const keyword of keywords) {
        try {
          console.log(`[Scrape] Scraping keyword "${keyword.keyword}" from ${source.base_url}`);
          const articles = await scrapeNews(source.base_url, keyword.keyword);
          console.log(`[Scrape] Found ${articles.length} article(s) for keyword "${keyword.keyword}"`);

          for (const article of articles) {
            if (!allArticles.has(article.url)) {
              allArticles.set(article.url, article);
            }
          }
        } catch (error) {
          console.error(`Error scraping keyword ${keyword.keyword} for source ${source.source_id}:`, error);
        }
      }

      // Process all collected articles
      for (const [url, article] of allArticles) {
        const existing = await query(
          'SELECT id, keyword_id, title, description FROM news_articles WHERE source_id = $1 AND url = $2',
          [source.source_id, url]
        );

        let articleId;
        let isNew = false;

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
              keywords[0].id, // Keep first keyword for backward compatibility
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

          articleId = insertResult.rows[0].id;
          isNew = true;
          scrapedArticles.push({
            id: articleId,
            ...article,
            ...analysis
          });
          console.log(`[Scrape] Saved new article: "${article.title.substring(0, 50)}..."`);
        } else {
          // Article exists - update author if needed
          articleId = existing.rows[0].id;
          const existingArticle = existing.rows[0];
          
          if (article.author && !existingArticle.author) {
            await query(
              'UPDATE news_articles SET author = $1 WHERE id = $2',
              [article.author, articleId]
            );
            console.log(`[Scrape] Updated author for article: "${article.title.substring(0, 50)}..."`);
          }
        }

        // Tag article with all matching keywords
        const matchedCount = await tagArticleWithMatchingKeywords(
          articleId,
          article.title,
          article.description,
          source.source_id,
          keywords
        );
        console.log(`[Scrape] Tagged article "${article.title.substring(0, 50)}..." with ${matchedCount} keyword(s)`);
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
      `SELECT na.id, na.title, na.url, na.description, na.author, na.published_at, 
              na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
              ns.base_url as source_url,
              COALESCE(
                json_agg(DISTINCT sk.keyword) FILTER (WHERE sk.keyword IS NOT NULL),
                '[]'
              ) as keywords
       FROM news_articles na
       JOIN news_sources ns ON na.source_id = ns.id
       LEFT JOIN article_keywords ak ON na.id = ak.article_id
       LEFT JOIN source_keywords sk ON ak.keyword_id = sk.id
       WHERE na.id = $1 AND ns.user_id = $2
       GROUP BY na.id, na.title, na.url, na.description, na.author, na.published_at, 
                na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
                ns.base_url`,
      [articleId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = result.rows[0];
    // Transform to include keywords array and single keyword for backward compatibility
    article.keywords = article.keywords || [];
    article.keyword = article.keywords.length > 0 ? article.keywords[0] : null;

    res.json({ article });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

module.exports = router;

