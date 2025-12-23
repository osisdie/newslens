const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

// Build search URL based on source and keyword using a mapping table
const SEARCH_PATH_MAP = {
  'news.google.com': (baseUrl, keyword) =>
    `${baseUrl}search?q=${encodeURIComponent(keyword)}&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant`,
  'tw.news.yahoo.com': (baseUrl, keyword) =>
    `${baseUrl.replace(/\/$/, '')}/search?p=${encodeURIComponent(keyword)}`,
  'news.yahoo.com': (baseUrl, keyword) =>
    `${baseUrl.replace(/\/$/, '')}/search?p=${encodeURIComponent(keyword)}`,
  'yahoo.com': (baseUrl, keyword) =>
    `${baseUrl.replace(/\/$/, '')}/search?p=${encodeURIComponent(keyword)}`
};

function buildSearchUrl(baseUrl, keyword) {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname;

    // Find matching mapper
    const mapperKey = Object.keys(SEARCH_PATH_MAP).find((key) =>
      host.includes(key)
    );

    if (mapperKey) {
      return SEARCH_PATH_MAP[mapperKey](baseUrl, keyword);
    }

    // Default: append keyword as query parameter
    url.searchParams.set('q', keyword);
    return url.toString();
  } catch (error) {
    // Fallback when URL parsing fails
    const mapperKey = Object.keys(SEARCH_PATH_MAP).find((key) =>
      baseUrl.includes(key)
    );
    if (mapperKey) {
      return SEARCH_PATH_MAP[mapperKey](baseUrl, keyword);
    }
    return `${baseUrl}?q=${encodeURIComponent(keyword)}`;
  }
}

// Retry helper function
async function retryOperation(operation, maxRetries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isRetryable = error.message.includes('EAI_AGAIN') || 
                          error.message.includes('timeout') ||
                          error.message.includes('Navigation timeout') ||
                          error.name === 'TimeoutError';
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      console.log(`[Scraper] Retry attempt ${attempt}/${maxRetries} for error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

// Fetch published date and author from article page
async function fetchArticleMetadata(url, browser) {
  const timeout = parseInt(process.env.SCRAPE_TIMEOUT || 30000);
  const isYahoo = url.includes('yahoo.com');
  
  return retryOperation(async () => {
    const page = await browser.newPage();
    await page.setUserAgent(process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout });
      const content = await page.content();
      await page.close();
      
      const $ = cheerio.load(content);
      let dateText = '';
      let author = '';
      
      // Yahoo News specific extraction
      if (isYahoo) {
        // Extract author first (look for author near title)
        const titleSelectors = [
          'h1.caas-title',
          'h1[data-module="ArticleHeader"]',
          'h1',
          'article h1',
          '[data-module="ArticleHeader"] h1'
        ];
        
        let $title = null;
        for (const selector of titleSelectors) {
          $title = $(selector).first();
          if ($title.length > 0) break;
        }
        
        if ($title.length > 0) {
          // Extract author (next element after title)
          let $authorElem = $title.next();
          for (let i = 0; i < 3; i++) {
            if ($authorElem.length === 0) break;
            
            const authorText = $authorElem.text().trim();
            // Check if it looks like an author (not too long, might contain "by", "記者", etc.)
            if (authorText && authorText.length < 100 && 
                (authorText.toLowerCase().includes('by') || 
                 authorText.includes('記者') || 
                 authorText.includes('作者') ||
                 !/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(authorText))) {
              // Clean up author text
              author = authorText.replace(/^(by|記者|作者)[:\s]*/i, '').trim();
              if (author) {
                console.log(`[Scraper] Found author for ${url}: "${author}"`);
                break;
              }
            }
            $authorElem = $authorElem.next();
          }
        }
        
        // Method 1: Look for time element with datetime attribute
        const $timeWithDatetime = $('time[datetime]').first();
        if ($timeWithDatetime.length > 0) {
          dateText = $timeWithDatetime.attr('datetime');
          if (dateText) {
            const parsedDate = parseDate(dateText);
            console.log(`[Scraper] Found Yahoo date (datetime attr) for ${url}: "${dateText}" -> ${parsedDate}`);
            return { publishedAt: parsedDate, author };
          }
        }
        
        // Method 2: Find title and look for date in same container or nearby
        // Reuse $title from author extraction above
        if ($title && $title.length > 0) {
          // Extract author (next element after title)
          let $authorElem = $title.next();
          for (let i = 0; i < 3; i++) {
            if ($authorElem.length === 0) break;
            
            const authorText = $authorElem.text().trim();
            // Check if it looks like an author (not too long, might contain "by", "記者", etc.)
            if (authorText && authorText.length < 100 && 
                (authorText.toLowerCase().includes('by') || 
                 authorText.includes('記者') || 
                 authorText.includes('作者') ||
                 !/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(authorText))) {
              // Clean up author text
              author = authorText.replace(/^(by|記者|作者)[:\s]*/i, '').trim();
              if (author) {
                console.log(`[Scraper] Found author for ${url}: "${author}"`);
                break;
              }
            }
            $authorElem = $authorElem.next();
          }
          
          // Look in the same parent container as title
          const $parent = $title.closest('div, article, header, [class*="header"], [class*="article"]');
          
          // Look for date elements near title (siblings or in parent)
          const dateSelectors = [
            'time[datetime]',
            'time',
            'span[data-test-locator="timestamp"]',
            '[class*="date"]',
            '[class*="time"]',
            '[class*="timestamp"]',
            '[class*="published"]',
            '[data-module="ArticleHeader"] time',
            '[data-module="ArticleHeader"] [class*="date"]'
          ];
          
          for (const selector of dateSelectors) {
            const $dateElem = $parent.find(selector).first();
            if ($dateElem.length > 0) {
              dateText = $dateElem.attr('datetime') || $dateElem.text().trim();
              if (dateText) {
                // Validate it looks like a date
                if (/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(dateText) || 
                    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(dateText) ||
                    dateText.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
                    dateText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/) ||
                    dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)) {
                  const parsedDate = parseDate(dateText);
                  console.log(`[Scraper] Found Yahoo date (near title) for ${url}: "${dateText}" -> ${parsedDate}`);
                  return { publishedAt: parsedDate, author };
                }
              }
            }
          }
          
          // Method 3: Look for date in siblings of title
          let $sibling = $title.next();
          for (let i = 0; i < 5; i++) {
            if ($sibling.length === 0) break;
            
            const siblingText = $sibling.text().trim();
            
            // Check if sibling contains date-like text
            if (/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(siblingText) || 
                /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(siblingText) ||
                siblingText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/)) {
              dateText = siblingText;
              const parsedDate = parseDate(dateText);
              console.log(`[Scraper] Found Yahoo date (sibling) for ${url}: "${dateText}" -> ${parsedDate}`);
              return { publishedAt: parsedDate, author };
            }
            
            // Check for time elements in sibling
            const $timeInSibling = $sibling.find('time').first();
            if ($timeInSibling.length > 0) {
              dateText = $timeInSibling.attr('datetime') || $timeInSibling.text().trim();
              if (dateText) {
                const parsedDate = parseDate(dateText);
                console.log(`[Scraper] Found Yahoo date (sibling time) for ${url}: "${dateText}" -> ${parsedDate}`);
                return { publishedAt: parsedDate, author };
              }
            }
            
            $sibling = $sibling.next();
          }
        }
        
        // Method 4: Search entire article for date patterns
        const articleText = $('article, [class*="article"], main').text();
        const datePatterns = [
          /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
          /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/,
          /\d{4}年\d{1,2}月\d{1,2}日/
        ];
        
        for (const pattern of datePatterns) {
          const match = articleText.match(pattern);
          if (match) {
            dateText = match[0];
            const parsedDate = parseDate(dateText);
            console.log(`[Scraper] Found Yahoo date (pattern match) for ${url}: "${dateText}" -> ${parsedDate}`);
            return { publishedAt: parsedDate, author };
          }
        }
      } else {
        // Generic extraction for other sites
        const titleSelectors = ['h1', 'h2.article-title', '[class*="title"]', 'article h1'];
        let $title = null;
        for (const selector of titleSelectors) {
          $title = $(selector).first();
          if ($title.length > 0) break;
        }
        
        if ($title.length > 0) {
          // Extract author
          let $authorElem = $title.next();
          for (let i = 0; i < 3; i++) {
            if ($authorElem.length === 0) break;
            const authorText = $authorElem.text().trim();
            if (authorText && authorText.length < 100 && 
                (authorText.toLowerCase().includes('by') || 
                 !/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(authorText))) {
              author = authorText.replace(/^(by)[:\s]*/i, '').trim();
              if (author) break;
            }
            $authorElem = $authorElem.next();
          }
          
          const $parent = $title.parent();
          const dateSelectors = [
            'time[datetime]',
            'time',
            '[class*="date"]',
            '[class*="published"]',
            '[class*="time"]'
          ];
          
          for (const selector of dateSelectors) {
            const $dateElem = $parent.find(selector).first();
            if ($dateElem.length > 0) {
              dateText = $dateElem.attr('datetime') || $dateElem.text().trim();
              if (dateText && (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(dateText) || 
                  /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(dateText))) {
                break;
              }
            }
          }
        }
      }
      
      if (dateText) {
        const parsedDate = parseDate(dateText);
        console.log(`[Scraper] Found date for ${url}: "${dateText}" -> ${parsedDate}`);
        return { publishedAt: parsedDate, author };
      }
      
      console.warn(`[Scraper] No date found for ${url}`);
      return { publishedAt: null, author };
    } catch (pageError) {
      await page.close();
      throw pageError; // Let retry handle it
    }
  }, 3, 2000).catch((error) => {
    // Retry failed - return empty metadata
    console.warn(`[Scraper] Error fetching article metadata for ${url} after retries:`, error.message);
    return { publishedAt: null, author: '' };
  });
}

// Scrape news from a URL
async function scrapeNews(baseUrl, keyword) {
  const articles = [];
  const searchUrl = buildSearchUrl(baseUrl, keyword);
  const timeout = parseInt(process.env.SCRAPE_TIMEOUT || 30000);

  return retryOperation(async () => {
    try {
      // Try using Puppeteer for JavaScript-heavy sites
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent(process.env.USER_AGENT || 'Mozilla/5.0 (compatible; AI-News-Bot/1.0)');
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout });
        
        const content = await page.content();
        await page.close();

        const $ = cheerio.load(content);
        const initialArticles = parseNewsFromHTML($, baseUrl, keyword);
        
        // Limit to top 20 before fetching metadata
        const topArticles = initialArticles.slice(0, 20);
        
        // Fetch published date and author from each article page
        console.log(`[Scraper] Fetching metadata for ${topArticles.length} articles...`);
        for (let i = 0; i < topArticles.length; i++) {
          const article = topArticles[i];
          if (article.url) {
            const metadata = await fetchArticleMetadata(article.url, browser);
            if (metadata) {
              article.publishedAt = metadata.publishedAt;
              article.author = metadata.author;
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        articles.push(...topArticles);
        await browser.close();
        return articles;
      } catch (puppeteerError) {
        await browser.close();
        console.warn('Puppeteer scraping failed, trying axios:', puppeteerError.message);
        
        // Fallback to axios + cheerio (without fetching individual metadata)
        const response = await axios.get(searchUrl, {
          timeout,
          headers: {
            'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (compatible; AI-News-Bot/1.0)'
          }
        });
        
        const $ = cheerio.load(response.data);
        return parseNewsFromHTML($, baseUrl, keyword).slice(0, 20);
      }
    } catch (error) {
      console.error(`Error scraping ${searchUrl}:`, error.message);
      throw error; // Let retry handle it
    }
  }, 3, 2000).catch((error) => {
    console.error(`Error scraping ${searchUrl} after retries:`, error.message);
    return []; // Return empty array after all retries fail
  });

  // Sort by date (newest first) - articles without dates will be at the end
  return articles.sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
    const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
    return dateB - dateA;
  });
}

// Parse news articles from HTML
function parseNewsFromHTML($, baseUrl, keyword) {
  const articles = [];
  const baseUrlObj = new URL(baseUrl);

  try {
    // Yahoo News parsing
    if (baseUrlObj.hostname.includes('yahoo.com')) {
      $('h3 a, h4 a').each((i, elem) => {
        const $elem = $(elem);
        const title = $elem.text().trim();
        let url = $elem.attr('href');
        
        if (!url || !title) return;
        
        // Make absolute URL
        if (url.startsWith('/')) {
          url = `${baseUrlObj.protocol}//${baseUrlObj.hostname}${url}`;
        } else if (!url.startsWith('http')) {
          url = `${baseUrl}${url}`;
        }

        // Find description
        const description = $elem.closest('div').find('p').first().text().trim() || '';
        
        // Find published date - try multiple selectors
        let dateText = '';
        const $parent = $elem.closest('div, article, li');
        
        // Try various date selectors
        const dateSelectors = [
          'time[datetime]',
          'time',
          'span[data-test-locator]',
          '[class*="date"]',
          '[class*="time"]',
          '[class*="published"]',
          'span:contains("ago")',
          'span:contains("小時前")',
          'span:contains("天前")',
          'span:contains("分鐘前")'
        ];
        
        for (const selector of dateSelectors) {
          const $dateElem = $parent.find(selector).first();
          if ($dateElem.length > 0) {
            dateText = $dateElem.attr('datetime') || $dateElem.text().trim();
            if (dateText) break;
          }
        }
        
        // If still no date, try to find relative time text in parent
        if (!dateText) {
          const parentText = $parent.text();
          const relativeTimeMatch = parentText.match(/(\d+)\s*(小時前|小時|天前|天|分鐘前|分鐘|hour|hours|day|days|minute|minutes|week|weeks)\s*(ago)?/i);
          if (relativeTimeMatch) {
            dateText = relativeTimeMatch[0];
          }
        }
        
        // Don't set publishedAt here - will be fetched from article page
        // Just return null, date will be fetched later
        const publishedAt = null;

        articles.push({
          title,
          url,
          description,
          publishedAt,
          source: baseUrl
        });
      });
    }
    // Google News parsing
    else if (baseUrlObj.hostname.includes('news.google.com')) {
      $('article').each((i, elem) => {
        const $article = $(elem);
        const $link = $article.find('a[href*="/articles/"]').first();
        
        if ($link.length === 0) return;

        const title = $link.text().trim();
        let url = $link.attr('href');
        
        if (!url || !title) return;

        // Google News URLs are relative, need to extract actual URL
        if (url.startsWith('./')) {
          url = url.substring(2);
        }

        // Find description
        const description = $article.find('div[data-n-tid]').first().text().trim() || '';
        
        // Find published date
        const timeElem = $article.find('time').first();
        const dateText = timeElem.attr('datetime') || timeElem.text().trim();
        const publishedAt = parseDate(dateText);

        articles.push({
          title,
          url,
          description,
          publishedAt,
          source: baseUrl
        });
      });
    }
    // Generic parsing (fallback)
    else {
      $('article, .article, [class*="article"], [class*="news-item"]').each((i, elem) => {
        const $elem = $(elem);
        const $link = $elem.find('a').first();
        
        if ($link.length === 0) return;

        const title = $link.text().trim();
        let url = $link.attr('href');
        
        if (!url || !title) return;

        // Make absolute URL
        if (url.startsWith('/')) {
          url = `${baseUrlObj.protocol}//${baseUrlObj.hostname}${url}`;
        } else if (!url.startsWith('http')) {
          url = `${baseUrl}${url}`;
        }

        const description = $elem.find('p').first().text().trim() || '';
        const timeElem = $elem.find('time, [datetime]').first();
        const dateText = timeElem.attr('datetime') || timeElem.text().trim();
        const publishedAt = parseDate(dateText);

        articles.push({
          title,
          url,
          description,
          publishedAt,
          source: baseUrl
        });
      });
    }
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }

  return articles;
}

// Parse date from various formats and convert to UTC ISO string
function parseDate(dateString) {
  if (!dateString) return null;

  try {
    // Try ISO format first (already UTC)
    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }

    // Try relative dates in English (e.g., "2 hours ago", "3 days ago")
    const relativeMatch = dateString.match(/(\d+)\s*(hour|hours|day|days|minute|minutes|week|weeks|month|months|year|years)\s*ago/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      // Use UTC time to ensure consistent conversion
      const now = new Date();
      const utcNow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      ));
      
      if (unit.includes('minute')) {
        utcNow.setUTCMinutes(utcNow.getUTCMinutes() - amount);
      } else if (unit.includes('hour')) {
        utcNow.setUTCHours(utcNow.getUTCHours() - amount);
      } else if (unit.includes('day')) {
        utcNow.setUTCDate(utcNow.getUTCDate() - amount);
      } else if (unit.includes('week')) {
        utcNow.setUTCDate(utcNow.getUTCDate() - (amount * 7));
      } else if (unit.includes('month')) {
        utcNow.setUTCMonth(utcNow.getUTCMonth() - amount);
      } else if (unit.includes('year')) {
        utcNow.setUTCFullYear(utcNow.getUTCFullYear() - amount);
      }
      
      return utcNow.toISOString();
    }

    // Try relative dates in Chinese (e.g., "2小時前", "3天前")
    const chineseRelativeMatch = dateString.match(/(\d+)\s*(分鐘前|分鐘|小時前|小時|天前|天|週前|週|月前|月|年前|年)/i);
    if (chineseRelativeMatch) {
      const amount = parseInt(chineseRelativeMatch[1]);
      const unit = chineseRelativeMatch[2];
      // Use UTC time to ensure consistent conversion
      const now = new Date();
      const utcNow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      ));
      
      if (unit.includes('分鐘') || unit.includes('分钟')) {
        utcNow.setUTCMinutes(utcNow.getUTCMinutes() - amount);
      } else if (unit.includes('小時') || unit.includes('小时')) {
        utcNow.setUTCHours(utcNow.getUTCHours() - amount);
      } else if (unit.includes('天')) {
        utcNow.setUTCDate(utcNow.getUTCDate() - amount);
      } else if (unit.includes('週') || unit.includes('周')) {
        utcNow.setUTCDate(utcNow.getUTCDate() - (amount * 7));
      } else if (unit.includes('月')) {
        utcNow.setUTCMonth(utcNow.getUTCMonth() - amount);
      } else if (unit.includes('年')) {
        utcNow.setUTCFullYear(utcNow.getUTCFullYear() - amount);
      }
      
      return utcNow.toISOString();
    }

    // Try absolute date formats (mm/dd/yyyy, yyyy-mm-dd, etc.)
    // Handle Chinese date format: 2024年1月15日
    const chineseDateMatch = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (chineseDateMatch) {
      const year = parseInt(chineseDateMatch[1]);
      const month = parseInt(chineseDateMatch[2]) - 1; // JS months are 0-indexed
      const day = parseInt(chineseDateMatch[3]);
      const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    // Handle mm/dd/yyyy format
    const mmddyyyyMatch = dateString.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (mmddyyyyMatch) {
      const month = parseInt(mmddyyyyMatch[1]) - 1; // JS months are 0-indexed
      const day = parseInt(mmddyyyyMatch[2]);
      const year = parseInt(mmddyyyyMatch[3]);
      const date = new Date(Date.UTC(year, month, day, 12, 0, 0)); // Use noon UTC to avoid timezone issues
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    // Handle yyyy-mm-dd format
    const yyyymmddMatch = dateString.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymmddMatch) {
      const year = parseInt(yyyymmddMatch[1]);
      const month = parseInt(yyyymmddMatch[2]) - 1; // JS months are 0-indexed
      const day = parseInt(yyyymmddMatch[3]);
      const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Try other common formats - parse and convert to UTC
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Convert to UTC ISO string
      return date.toISOString();
    }
  } catch (error) {
    console.warn('Failed to parse date:', dateString, error);
  }

  return null;
}

module.exports = {
  scrapeNews,
  buildSearchUrl
};

