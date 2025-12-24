const express = require('express');
const { query } = require('../db/init');
const { checkUsageLimits, trackUsage } = require('../middleware/usageLimits');
const { scrapeNews } = require('../services/newsScraper');
const { analyzeNews } = require('../services/newsAnalyzer');

const router = express.Router();

// Helper function to validate and sanitize date strings for PostgreSQL
// Returns null for invalid dates (e.g., year 0000, out of range dates)
function validateDate(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`[Date Validation] Invalid date string: ${dateString}`);
      return null;
    }
    
    // Check if year is valid (PostgreSQL doesn't accept year 0000 or negative years)
    const year = date.getFullYear();
    if (year < 1 || year > 9999) {
      console.warn(`[Date Validation] Date out of valid range (year ${year}): ${dateString}`);
      return null;
    }
    
    // Return ISO string for PostgreSQL
    return date.toISOString();
  } catch (error) {
    console.warn(`[Date Validation] Error parsing date "${dateString}":`, error.message);
    return null;
  }
}

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

    const { sourceId, keywordId, offset = 0 } = req.query;
    // Get configurable limit per source/keyword (default 20)
    const articlesPerSourceKeyword = parseInt(process.env.ARTICLES_PER_SOURCE_KEYWORD || '20');

    // Check if article_keywords table exists, if not use fallback query
    let useNewQuery = true;
    try {
      await query('SELECT 1 FROM article_keywords LIMIT 1');
    } catch (error) {
      console.log('[News] article_keywords table does not exist, using fallback query');
      useNewQuery = false;
    }

    let newsQuery;
    const params = [req.user.id, articlesPerSourceKeyword];
    let paramIndex = 3;

    if (useNewQuery) {
      // New query with article_keywords junction table
      // Limit to top N articles per source/keyword combination
      newsQuery = `
        WITH ranked_articles AS (
          SELECT 
            na.id, na.title, na.url, na.description, na.author, na.published_at, 
            na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
            na.source_id,
            ns.base_url as source_url,
            ak.keyword_id,
            ROW_NUMBER() OVER (
              PARTITION BY na.source_id, ak.keyword_id 
              ORDER BY na.published_at DESC NULLS LAST, na.scraped_at DESC
            ) as rn
          FROM news_articles na
          JOIN news_sources ns ON na.source_id = ns.id
          JOIN article_keywords ak ON na.id = ak.article_id
          WHERE ns.user_id = $1
      `;

      if (sourceId) {
        newsQuery += ` AND na.source_id = $${paramIndex}`;
        params.push(sourceId);
        paramIndex++;
      }

      if (keywordId) {
        newsQuery += ` AND ak.keyword_id = $${paramIndex}`;
        params.push(keywordId);
        paramIndex++;
      }

      newsQuery += `
        )
        SELECT DISTINCT
          ra.id, ra.title, ra.url, ra.description, ra.author, ra.published_at, 
          ra.scraped_at, ra.fake_news_rate, ra.clickbait_rate, ra.phishing_rate,
          ra.source_id, ra.source_url,
          COALESCE(
            (
              SELECT json_agg(DISTINCT sk.keyword ORDER BY sk.keyword)::text
              FROM article_keywords ak2
              JOIN source_keywords sk ON ak2.keyword_id = sk.id
              WHERE ak2.article_id = ra.id AND sk.keyword IS NOT NULL
            ),
            '[]'
          ) as keywords
        FROM ranked_articles ra
        WHERE ra.rn <= $2
      `;
    } else {
      // Fallback query using old keyword_id field
      newsQuery = `
        WITH ranked_articles AS (
          SELECT 
            na.id, na.title, na.url, na.description, na.author, na.published_at, 
            na.scraped_at, na.fake_news_rate, na.clickbait_rate, na.phishing_rate,
            na.source_id, na.keyword_id,
            ns.base_url as source_url,
            ROW_NUMBER() OVER (
              PARTITION BY na.source_id, na.keyword_id 
              ORDER BY na.published_at DESC NULLS LAST, na.scraped_at DESC
            ) as rn
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
        newsQuery += ` AND na.keyword_id = $${paramIndex}`;
        params.push(keywordId);
        paramIndex++;
      }

      newsQuery += `
        )
        SELECT 
          ra.id, ra.title, ra.url, ra.description, ra.author, ra.published_at, 
          ra.scraped_at, ra.fake_news_rate, ra.clickbait_rate, ra.phishing_rate,
          ra.source_id, ra.source_url,
          CASE 
            WHEN sk.keyword IS NOT NULL THEN json_build_array(sk.keyword)::text
            ELSE '[]'
          END as keywords
        FROM ranked_articles ra
        LEFT JOIN source_keywords sk ON ra.keyword_id = sk.id
        WHERE ra.rn <= $2
      `;
    }

    newsQuery += ` 
      ORDER BY published_at DESC NULLS LAST, scraped_at DESC 
      OFFSET $${paramIndex}`;
    params.push(parseInt(offset));

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

// Helper function to process and save a single article (async, non-blocking)
async function processAndSaveArticle(article, sourceId, keywords, userId) {
  try {
    const existing = await query(
      'SELECT id, keyword_id, title, description, published_at, author FROM news_articles WHERE source_id = $1 AND url = $2',
      [sourceId, article.url]
    );

    let articleId;
    let isNew = false;

    if (existing.rows.length === 0) {
      // New article - insert it immediately (don't wait for analysis)
      // Save basic info first, analysis and date can be updated later
      const validatedDate = validateDate(article.publishedAt);
      const insertResult = await query(
        `INSERT INTO news_articles 
         (source_id, keyword_id, title, url, description, author, published_at, 
          fake_news_rate, clickbait_rate, phishing_rate, analyzed_at, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, NULL, NOW())
         RETURNING id`,
        [
          sourceId,
          keywords[0].id,
          article.title,
          article.url,
          article.description || '',
          article.author || null,
          validatedDate // Use validated date (null if invalid)
        ]
      );

      articleId = insertResult.rows[0].id;
      isNew = true;
      console.log(`[Scrape] Saved new article immediately: "${article.title.substring(0, 50)}..." (ID: ${articleId})`);

      // Tag article with matching keywords (async, non-blocking)
      tagArticleWithMatchingKeywords(
        articleId,
        article.title,
        article.description,
        sourceId,
        keywords
      ).catch(err => console.error(`[Scrape] Error tagging article ${articleId}:`, err));

      // Run analysis in background (async, non-blocking)
      analyzeNews(article).then(analysis => {
        query(
          `UPDATE news_articles 
           SET fake_news_rate = $1, clickbait_rate = $2, phishing_rate = $3, analyzed_at = NOW()
           WHERE id = $4`,
          [analysis.fakeNewsRate, analysis.clickbaitRate, analysis.phishingRate, articleId]
        ).catch(err => console.error(`[Scrape] Error updating analysis for article ${articleId}:`, err));
      }).catch(err => console.error(`[Scrape] Error analyzing article ${articleId}:`, err));

      // Update published date in background if we have it (async, non-blocking)
      const validatedDateForUpdate = validateDate(article.publishedAt);
      if (validatedDateForUpdate) {
        query(
          'UPDATE news_articles SET published_at = $1 WHERE id = $2',
          [validatedDateForUpdate, articleId]
        ).catch(err => console.error(`[Scrape] Error updating date for article ${articleId}:`, err));
      }

      return { articleId, isNew: true };
    } else {
      // Article exists - update scraped_at immediately, other fields async
      articleId = existing.rows[0].id;
      const existingArticle = existing.rows[0];
      
      // Always update scraped_at immediately so article appears fresh
      await query(
        'UPDATE news_articles SET scraped_at = NOW() WHERE id = $1',
        [articleId]
      );

      // Update other fields in background (async, non-blocking)
      const updatePromises = [];
      
      const validatedDate = validateDate(article.publishedAt);
      if (validatedDate && validatedDate !== existingArticle.published_at?.toISOString()) {
        updatePromises.push(
          query('UPDATE news_articles SET published_at = $1 WHERE id = $2', [validatedDate, articleId])
            .catch(err => console.error(`[Scrape] Error updating date for article ${articleId}:`, err))
        );
      }
      
      if (article.author && article.author !== existingArticle.author) {
        updatePromises.push(
          query('UPDATE news_articles SET author = $1 WHERE id = $2', [article.author, articleId])
            .catch(err => console.error(`[Scrape] Error updating author for article ${articleId}:`, err))
        );
      }
      
      if (article.description && article.description !== existingArticle.description) {
        updatePromises.push(
          query('UPDATE news_articles SET description = $1 WHERE id = $2', [article.description, articleId])
            .catch(err => console.error(`[Scrape] Error updating description for article ${articleId}:`, err))
        );
      }
      
      if (article.title && article.title !== existingArticle.title) {
        updatePromises.push(
          query('UPDATE news_articles SET title = $1 WHERE id = $2', [article.title, articleId])
            .catch(err => console.error(`[Scrape] Error updating title for article ${articleId}:`, err))
        );
      }

      // Don't await these - let them run in background
      Promise.all(updatePromises).catch(err => console.error(`[Scrape] Error in background updates for article ${articleId}:`, err));

      // Refresh tags in background
      tagArticleWithMatchingKeywords(
        articleId,
        article.title || existingArticle.title,
        article.description || existingArticle.description,
        sourceId,
        keywords
      ).catch(err => console.error(`[Scrape] Error tagging article ${articleId}:`, err));

      return { articleId, isNew: false };
    }
  } catch (error) {
    console.error(`[Scrape] Error processing article "${article.title?.substring(0, 50)}...":`, error);
    return null;
  }
}

// Trigger news scraping for a source (async - returns immediately)
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

    // Return immediately - processing happens in background
    res.json({
      message: 'Scraping started',
      sourceId: sourceId,
      keywords: keywords.map(k => k.keyword)
    });

    // Process in background (don't await)
    (async () => {
      let totalSaved = 0;
      const allArticles = new Map(); // url -> article data

      // Scrape all keywords
      for (const keyword of keywords) {
        try {
          console.log(`[Scrape] Starting scrape for keyword: ${keyword.keyword}`);
          const articles = await scrapeNews(source.base_url, keyword.keyword);
          console.log(`[Scrape] Found ${articles.length} articles for keyword: ${keyword.keyword}`);

          for (const article of articles) {
            if (!allArticles.has(article.url)) {
              allArticles.set(article.url, article);
            }
          }
        } catch (error) {
          console.error(`[Scrape] Error scraping keyword ${keyword.keyword} for source ${sourceId}:`, error);
        }
      }

      console.log(`[Scrape] Total unique articles found: ${allArticles.size}`);

      // Process and save articles as they're found (save immediately, don't wait for all)
      for (const [url, article] of allArticles) {
        const result = await processAndSaveArticle(article, sourceId, keywords, req.user.id);
        if (result && result.isNew) {
          totalSaved++;
        }
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[Scrape] Background processing completed. Total new articles saved: ${totalSaved}`);
    })().catch(error => {
      console.error(`[Scrape] Background processing error:`, error);
    });

  } catch (error) {
    console.error('Scrape news error:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
  }
});

// Trigger news scraping for all of a user's sources (async - returns immediately)
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

    // Return immediately - processing happens in background
    res.json({
      message: 'Scraping started',
      sourcesCount: sources.length
    });

    // Process in background (don't await)
    (async () => {
      let totalSaved = 0;

      for (const source of sources) {
        const keywords = source.keywords || [];
        console.log(`[Scrape] Processing source ${source.source_id} (${source.base_url}) with ${keywords.length} keyword(s)`);
        
        if (keywords.length === 0) {
          console.log(`[Scrape] Skipping source ${source.source_id} - no keywords`);
          continue;
        }

        // Collect all articles from all keywords
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
            console.error(`[Scrape] Error scraping keyword ${keyword.keyword} for source ${source.source_id}:`, error);
          }
        }

        console.log(`[Scrape] Total unique articles for source ${source.source_id}: ${allArticles.size}`);

        // Process and save articles as they're found (save immediately, don't wait for all)
        for (const [url, article] of allArticles) {
          const result = await processAndSaveArticle(article, source.source_id, keywords, req.user.id);
          if (result && result.isNew) {
            totalSaved++;
          }
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`[Scrape] Background processing completed. Total new articles saved: ${totalSaved}`);
    })().catch(error => {
      console.error(`[Scrape] Background processing error:`, error);
    });

  } catch (error) {
    console.error('[Scrape] Error:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
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
