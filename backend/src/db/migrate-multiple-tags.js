#!/usr/bin/env node

/**
 * Migration Script: Multiple Tags Support
 * 
 * This script migrates existing articles to support multiple tags:
 * 1. Creates the article_keywords junction table if it doesn't exist
 * 2. Populates article_keywords from existing keyword_id values
 * 
 * Usage:
 *   node src/db/migrate-multiple-tags.js
 */

require('dotenv').config();
const { query } = require('./init');

async function migrateMultipleTags() {
  try {
    console.log('🔄 Starting migration to support multiple tags per article...');

    // Step 1: Create article_keywords table if it doesn't exist
    console.log('📋 Creating article_keywords table...');
    await query(`
      CREATE TABLE IF NOT EXISTS article_keywords (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
        keyword_id INTEGER REFERENCES source_keywords(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(article_id, keyword_id)
      );
    `);
    console.log('✅ article_keywords table created');

    // Step 2: Create indexes
    console.log('📋 Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_article_keywords_article_id ON article_keywords(article_id);
      CREATE INDEX IF NOT EXISTS idx_article_keywords_keyword_id ON article_keywords(keyword_id);
    `);
    console.log('✅ Indexes created');

    // Step 3: Migrate existing data
    console.log('📋 Migrating existing articles to article_keywords...');
    const migrateResult = await query(`
      INSERT INTO article_keywords (article_id, keyword_id)
      SELECT id, keyword_id
      FROM news_articles
      WHERE keyword_id IS NOT NULL
      ON CONFLICT (article_id, keyword_id) DO NOTHING
    `);
    console.log(`✅ Migrated ${migrateResult.rowCount} article-keyword relationships`);

    // Step 4: For articles that match multiple keywords, tag them with all matching keywords
    console.log('📋 Tagging articles with all matching keywords...');
    
    // Get all articles with their source and keywords
    const articlesResult = await query(`
      SELECT na.id, na.source_id, na.title, na.description,
             COALESCE(
               json_agg(json_build_object('id', sk.id, 'keyword', sk.keyword))
               FILTER (WHERE sk.id IS NOT NULL),
               '[]'
             ) as source_keywords
      FROM news_articles na
      JOIN news_sources ns ON na.source_id = ns.id
      LEFT JOIN source_keywords sk ON ns.id = sk.source_id
      GROUP BY na.id, na.source_id, na.title, na.description
    `);

    let taggedCount = 0;
    for (const article of articlesResult.rows) {
      const sourceKeywords = article.source_keywords || [];
      const articleText = `${article.title} ${article.description || ''}`.toLowerCase();
      const matchingKeywords = [];

      for (const kw of sourceKeywords) {
        const keywordLower = kw.keyword.toLowerCase();
        if (articleText.includes(keywordLower)) {
          matchingKeywords.push(kw.id);
        }
      }

      // Insert all matching keywords
      for (const keywordId of matchingKeywords) {
        try {
          await query(
            'INSERT INTO article_keywords (article_id, keyword_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [article.id, keywordId]
          );
        } catch (error) {
          // Ignore conflicts
        }
      }

      if (matchingKeywords.length > 0) {
        taggedCount++;
      }
    }

    console.log(`✅ Tagged ${taggedCount} articles with multiple keywords`);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Run a new scrape to ensure all articles are properly tagged');
    console.log('   2. Articles will now appear in multiple keyword groups if they match multiple keywords');
    console.log('   3. Filtering by a keyword will show all articles that have that keyword');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrateMultipleTags();
}

module.exports = { migrateMultipleTags };

