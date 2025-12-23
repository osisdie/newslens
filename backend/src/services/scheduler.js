const cron = require('node-cron');
const { query } = require('../db/init');
const { scrapeNews } = require('./newsScraper');
const { analyzeNews } = require('./newsAnalyzer');

// Scheduled job to scrape news for all active sources
async function scrapeAllSources() {
  console.log('Starting scheduled news scrape...');

  try {
    // Get all sources with keywords
    const sources = await query(
      `SELECT ns.id as source_id, ns.user_id, ns.base_url,
              json_agg(json_build_object('id', sk.id, 'keyword', sk.keyword)) as keywords
       FROM news_sources ns
       JOIN source_keywords sk ON ns.id = sk.source_id
       GROUP BY ns.id, ns.user_id, ns.base_url`
    );

    let totalScraped = 0;

    for (const source of sources.rows) {
      try {
        const keywords = source.keywords || [];
        
        for (const kw of keywords) {
          try {
            const articles = await scrapeNews(source.base_url, kw.keyword);

            for (const article of articles) {
              // Check if article already exists
              const existing = await query(
                'SELECT id FROM news_articles WHERE source_id = $1 AND url = $2',
                [source.source_id, article.url]
              );

              if (existing.rows.length === 0) {
                // Analyze article
                const analysis = await analyzeNews(article);

                // Insert article
                await query(
                  `INSERT INTO news_articles 
                   (source_id, keyword_id, title, url, description, published_at, 
                    fake_news_rate, clickbait_rate, phishing_rate, analyzed_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                  [
                    source.source_id,
                    kw.id,
                    article.title,
                    article.url,
                    article.description,
                    article.publishedAt,
                    analysis.fakeNewsRate,
                    analysis.clickbaitRate,
                    analysis.phishingRate
                  ]
                );

                totalScraped++;
              }
            }

            // Small delay between keywords to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error scraping keyword ${kw.keyword} for source ${source.source_id}:`, error);
          }
        }

        // Delay between sources
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing source ${source.source_id}:`, error);
      }
    }

    console.log(`Scheduled scrape completed. Scraped ${totalScraped} new articles.`);
  } catch (error) {
    console.error('Error in scheduled scrape:', error);
  }
}

// Initialize scheduler
function initializeScheduler() {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', scrapeAllSources);
  console.log('News scraping scheduler initialized (runs every 6 hours)');

  // Also run once on startup (optional)
  // scrapeAllSources();
}

module.exports = {
  initializeScheduler,
  scrapeAllSources
};

