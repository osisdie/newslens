const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

// Build search URL based on source and keyword using a mapping table
const SEARCH_PATH_MAP = {
  'news.google.com': (baseUrl, keyword) => {
    // Ensure baseUrl ends with /
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    // Use English locale for better compatibility with English keywords
    // return `${normalizedBase}search?q=${encodeURIComponent(keyword)}&hl=en&gl=US&ceid=US:en`;
    return `${normalizedBase}search?q=${encodeURIComponent(keyword)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  },
  'money.udn.com': (baseUrl, keyword) => {
    const normalizedBase = baseUrl.replace(/\/$/, '');
    return `${normalizedBase}/search/result/1001/${encodeURIComponent(keyword)}?search_type=title`;
  },
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

// Follow redirects for Google News URLs to get the final destination URL
async function followGoogleNewsRedirect(googleNewsUrl, browser) {
  try {
    console.log(`[Scraper] Following redirect for Google News URL: ${googleNewsUrl.substring(0, 100)}...`);
    
    const page = await browser.newPage();
    await page.setUserAgent(process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
      // Set up response listener to capture redirects
      let finalUrl = googleNewsUrl;
      
      // Navigate and wait for redirects
      const response = await page.goto(googleNewsUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      // Get the final URL after redirects
      finalUrl = page.url();
      
      // If still on Google News domain, try to extract the actual URL from the page
      if (finalUrl.includes('news.google.com')) {
        // Google News sometimes shows the actual URL in a meta tag or redirects via JavaScript
        // Try to find the actual article URL in the page
        const content = await page.content();
        const $ = cheerio.load(content);
        
        // Look for meta refresh or canonical link
        const canonical = $('link[rel="canonical"]').attr('href');
        if (canonical && !canonical.includes('news.google.com')) {
          finalUrl = canonical;
        } else {
          // Try to find redirect URL in meta tags
          const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
          if (metaRefresh) {
            const urlMatch = metaRefresh.match(/url=(.+)/i);
            if (urlMatch && urlMatch[1]) {
              finalUrl = urlMatch[1].trim();
            }
          }
        }
        
        // If still on Google News, try to get the URL from the page's JavaScript redirect
        // or wait a bit more for client-side redirect
        if (finalUrl.includes('news.google.com')) {
          await page.waitForTimeout(2000);
          finalUrl = page.url();
        }
      }
      
      await page.close();
      
      if (finalUrl !== googleNewsUrl) {
        console.log(`[Scraper] Redirect resolved: ${googleNewsUrl.substring(0, 80)}... -> ${finalUrl.substring(0, 80)}...`);
      } else {
        console.log(`[Scraper] No redirect found, using original URL`);
      }
      
      return finalUrl;
    } catch (error) {
      await page.close();
      console.warn(`[Scraper] Error following redirect for ${googleNewsUrl}:`, error.message);
      return googleNewsUrl; // Return original URL on error
    }
  } catch (error) {
    console.warn(`[Scraper] Failed to follow redirect for ${googleNewsUrl}:`, error.message);
    return googleNewsUrl; // Return original URL on error
  }
}

// Follow redirects for Google News URLs to get the final destination URL
async function followGoogleNewsRedirect(googleNewsUrl, browser) {
  try {
    console.log(`[Scraper] Following redirect for Google News URL: ${googleNewsUrl.substring(0, 100)}...`);
    
    const page = await browser.newPage();
    await page.setUserAgent(process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
      // Navigate and wait for redirects
      const response = await page.goto(googleNewsUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      // Get the final URL after redirects
      let finalUrl = page.url();
      
      // If still on Google News domain, try to extract the actual URL from the page
      if (finalUrl.includes('news.google.com')) {
        // Google News sometimes shows the actual URL in a meta tag or redirects via JavaScript
        // Try to find the actual article URL in the page
        const content = await page.content();
        const $ = cheerio.load(content);
        
        // Look for meta refresh or canonical link
        const canonical = $('link[rel="canonical"]').attr('href');
        if (canonical && !canonical.includes('news.google.com')) {
          finalUrl = canonical;
        } else {
          // Try to find redirect URL in meta tags
          const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
          if (metaRefresh) {
            const urlMatch = metaRefresh.match(/url=(.+)/i);
            if (urlMatch && urlMatch[1]) {
              finalUrl = urlMatch[1].trim();
            }
          }
        }
        
        // If still on Google News, wait a bit more for client-side redirect
        if (finalUrl.includes('news.google.com')) {
          await page.waitForTimeout(2000);
          finalUrl = page.url();
        }
      }
      
      await page.close();
      
      if (finalUrl !== googleNewsUrl) {
        console.log(`[Scraper] Redirect resolved: ${googleNewsUrl.substring(0, 80)}... -> ${finalUrl.substring(0, 80)}...`);
      } else {
        console.log(`[Scraper] No redirect found, using original URL`);
      }
      
      return finalUrl;
    } catch (error) {
      await page.close();
      console.warn(`[Scraper] Error following redirect for ${googleNewsUrl}:`, error.message);
      return googleNewsUrl; // Return original URL on error
    }
  } catch (error) {
    console.warn(`[Scraper] Failed to follow redirect for ${googleNewsUrl}:`, error.message);
    return googleNewsUrl; // Return original URL on error
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
  
  console.log(`[Scraper] Scraping ${baseUrl} with keyword "${keyword}"`);
  console.log(`[Scraper] Search URL: ${searchUrl}`);

  return retryOperation(async () => {
    try {
      // Try using Puppeteer for JavaScript-heavy sites
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent(process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set proper encoding for Google News (especially for Chinese content)
        const isGoogleNews = baseUrl.includes('news.google.com');
        if (isGoogleNews) {
          // Set UTF-8 encoding and accept language headers
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
            'Accept-Charset': 'UTF-8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          });
        }
        
        const waitOptions = isGoogleNews 
          ? { waitUntil: 'domcontentloaded', timeout: timeout }
          : { waitUntil: 'networkidle2', timeout: timeout };
        
        await page.goto(searchUrl, waitOptions);
        
        // For Google News, wait a bit more for JavaScript to render
        if (isGoogleNews) {
          // Wait for article elements to appear
          try {
            await page.waitForSelector('article, [jslog]', { timeout: 5000 });
            console.log(`[Scraper] Google News articles detected on page`);
          } catch (e) {
            console.warn(`[Scraper] No article elements found after wait: ${e.message}`);
          }
          await page.waitForTimeout(2000); // Additional wait for content to render
        }
        
        // Check if page might be blocked or showing captcha
        const pageTitle = await page.title();
        const pageUrl = page.url();
        console.log(`[Scraper] Page title: "${pageTitle}", Final URL: ${pageUrl}`);
        
        if (pageTitle.toLowerCase().includes('captcha') || pageTitle.toLowerCase().includes('blocked')) {
          console.error(`[Scraper] Page might be blocked or showing captcha: ${pageTitle}`);
        }
        
        // Get content with proper encoding
        // For Google News, get content directly from document to preserve UTF-8 encoding
        let content;
        if (isGoogleNews) {
          // Use evaluate to get content directly from the DOM to preserve encoding
          content = await page.evaluate(() => {
            // Ensure charset is set correctly in the document
            if (document.documentElement) {
              const metaCharset = document.querySelector('meta[charset]');
              if (!metaCharset) {
                const meta = document.createElement('meta');
                meta.setAttribute('charset', 'UTF-8');
                document.head.insertBefore(meta, document.head.firstChild);
              }
            }
            return document.documentElement.outerHTML;
          });
        } else {
          content = await page.content();
        }
        
        // Ensure content is treated as UTF-8
        // Check for charset declaration
        if (isGoogleNews) {
          const charsetMatch = content.match(/charset\s*=\s*["']?([^"'\s>]+)/i);
          if (charsetMatch) {
            console.log(`[Scraper] Content charset detected: ${charsetMatch[1]}`);
          } else {
            // Ensure UTF-8 charset is in the content
            if (!content.includes('charset')) {
              content = content.replace(/<head>/i, '<head><meta charset="UTF-8">');
            }
          }
        }
        
        await page.close();

        // Load content with explicit UTF-8 encoding for Cheerio
        const $ = cheerio.load(content, {
          decodeEntities: true,
          normalizeWhitespace: false,
          xmlMode: false
        });
        console.log(`[Scraper] Page loaded, parsing HTML...`);
        console.log(`[Scraper] HTML content length: ${content.length} characters`);
        
        // Verify encoding by checking for Chinese characters
        if (isGoogleNews) {
          const sampleText = $('body').text().substring(0, 500);
          const hasChineseChars = /[\u4e00-\u9fff]/.test(sampleText);
          console.log(`[Scraper] Chinese characters detected in content: ${hasChineseChars}`);
          if (hasChineseChars) {
            console.log(`[Scraper] Sample Chinese text: "${sampleText.substring(0, 100)}"`);
          } else {
            console.warn(`[Scraper] Warning: No Chinese characters found - possible encoding issue`);
          }
        }
        
        // Debug: Check what elements exist for Google News
        if (baseUrl.includes('news.google.com')) {
          const articleCount = $('article').length;
          const jslogCount = $('[jslog]').length;
          const h3Count = $('h3').length;
          const h4Count = $('h4').length;
          const articleLinks = $('a[href*="articles"]').length;
          console.log(`[Scraper] Google News debug - articles: ${articleCount}, [jslog]: ${jslogCount}, h3: ${h3Count}, h4: ${h4Count}, article links: ${articleLinks}`);
          
          // Log a sample of article HTML structure
          if (articleCount > 0) {
            const firstArticle = $('article').first();
            console.log(`[Scraper] First article HTML sample (first 500 chars):`, firstArticle.html().substring(0, 500));
          } else if (jslogCount > 0) {
            const firstJslog = $('[jslog]').first();
            console.log(`[Scraper] First [jslog] element HTML sample (first 500 chars):`, firstJslog.html().substring(0, 500));
          }
        }
        
        const initialArticles = parseNewsFromHTML($, baseUrl, keyword);
        console.log(`[Scraper] Found ${initialArticles.length} articles after parsing HTML`);
        
        // Limit to top 20 before fetching metadata
        const topArticles = initialArticles.slice(0, 20);
        console.log(`[Scraper] Processing top ${topArticles.length} articles for metadata`);
        
        // First, resolve Google News redirects to get final URLs
        console.log(`[Scraper] Resolving Google News redirects...`);
        for (let i = 0; i < topArticles.length; i++) {
          const article = topArticles[i];
          if (article.url && article.url.includes('news.google.com/read/')) {
            try {
              const finalUrl = await followGoogleNewsRedirect(article.url, browser);
              article.url = finalUrl; // Replace with final destination URL
              console.log(`[Scraper] Resolved Google News URL to: ${finalUrl.substring(0, 100)}...`);
            } catch (error) {
              console.warn(`[Scraper] Failed to resolve redirect for ${article.url}:`, error.message);
              // Keep original URL if redirect fails
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        // Fetch published date and author from each article page
        console.log(`[Scraper] Fetching metadata for ${topArticles.length} articles...`);
        for (let i = 0; i < topArticles.length; i++) {
          const article = topArticles[i];
          if (article.url) {
            // Skip if still a Google News URL (redirect failed)
            if (article.url.includes('news.google.com/read/')) {
              console.log(`[Scraper] Skipping metadata fetch for unresolved Google News URL`);
              continue;
            }
            
            let urlToFetch = article.url;
            if (urlToFetch.includes('news.google.com') && !urlToFetch.startsWith('http')) {
              urlToFetch = `https://${urlToFetch}`;
            }
            
            try {
              const metadata = await fetchArticleMetadata(urlToFetch, browser);
              if (metadata) {
                article.publishedAt = metadata.publishedAt;
                article.author = metadata.author;
              }
            } catch (error) {
              console.warn(`[Scraper] Failed to fetch metadata for ${urlToFetch}:`, error.message);
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
      console.log(`[Scraper] Parsing Google News articles from ${baseUrl}`);
      
      // Google News uses /read/ URLs (not /articles/)
      // Find all links with /read/ pattern - these are the article links
      const readLinks = $('a[href*="/read/"]');
      console.log(`[Scraper] Found ${readLinks.length} links with /read/ pattern`);
      
      const seenUrls = new Set();
      let foundArticles = 0;
      
      readLinks.each((i, elem) => {
        const $link = $(elem);
        const href = $link.attr('href');
        let title = $link.text().trim();
        
        // Skip if no href or already seen
        if (!href || seenUrls.has(href)) return;
        
        // Some links are wrappers with empty text - find the actual title link nearby
        if (!title || title.length < 5) {
          // Look for a sibling or parent link with text
          const $parent = $link.parent();
          const $titleLink = $parent.find('a').filter((idx, el) => {
            const text = $(el).text().trim();
            return text && text.length > 5;
          }).first();
          
          if ($titleLink.length > 0) {
            title = $titleLink.text().trim();
            // Use the /read/ URL from the original link, but title from the title link
          } else {
            // Try finding title in nearby elements
            const $container = $link.closest('div');
            const $titleElem = $container.find('h3, h4, a').filter((idx, el) => {
              const text = $(el).text().trim();
              return text && text.length > 5 && !text.match(/^(更多|分享|追蹤)/);
            }).first();
            
            if ($titleElem.length > 0) {
              title = $titleElem.text().trim();
            }
          }
        }
        
        // Skip if still no valid title
        if (!title || title.length < 5) {
          if (foundArticles < 3) {
            console.log(`[Scraper] Skipping link - no valid title found`);
          }
          return;
        }
        
        // Build full URL
        let url = href;
        if (url.startsWith('./read/')) {
          url = `https://news.google.com${url.substring(1)}`;
        } else if (url.startsWith('./')) {
          url = `https://news.google.com${url.substring(1)}`;
        } else if (url.startsWith('/')) {
          url = `https://news.google.com${url}`;
        } else if (!url.startsWith('http')) {
          url = `https://news.google.com/${url}`;
        }
        
        // Find description - look in the same container
        let description = '';
        const $container = $link.closest('div');
        if ($container.length > 0) {
          // Try to find description text that's not the title
          const containerText = $container.text();
          const titleIndex = containerText.indexOf(title);
          if (titleIndex >= 0) {
            // Get text after title
            const afterTitle = containerText.substring(titleIndex + title.length).trim();
            // Extract first sentence or paragraph
            const descMatch = afterTitle.match(/^[^。！？\n]{10,200}/);
            if (descMatch && descMatch[0] !== title) {
              description = descMatch[0].trim();
            }
          }
          
          // Also try specific selectors
          if (!description) {
            const descSelectors = ['div[data-n-tid]', '.Y3v8qd', '.GI74Re', 'p'];
            for (const descSel of descSelectors) {
              const descText = $container.find(descSel).first().text().trim();
              if (descText && descText.length > 10 && descText !== title) {
                description = descText;
                break;
              }
            }
          }
        }
        
        // Find published date - look for time element in the same container
        let dateText = '';
        const $containerForDate = $link.closest('div');
        if ($containerForDate.length > 0) {
          const $timeElem = $containerForDate.find('time').first();
          if ($timeElem.length > 0) {
            dateText = $timeElem.attr('datetime') || $timeElem.text().trim();
          }
        }
        
        // If no time in immediate container, look in parent containers
        if (!dateText) {
          let $parent = $link.parent();
          for (let depth = 0; depth < 5 && $parent.length > 0; depth++) {
            const $timeElem = $parent.find('time').first();
            if ($timeElem.length > 0) {
              dateText = $timeElem.attr('datetime') || $timeElem.text().trim();
              if (dateText) break;
            }
            $parent = $parent.parent();
          }
        }
        
        const publishedAt = parseDate(dateText);
        
        if (foundArticles < 3) {
          console.log(`[Scraper] Found article: "${title.substring(0, 60)}..." with URL: ${url.substring(0, 80)}...`);
        }
        
        articles.push({
          title,
          url,
          description,
          publishedAt,
          source: baseUrl
        });
        
        seenUrls.add(href);
        foundArticles++;
      });
      
      console.log(`[Scraper] Found ${foundArticles} Google News articles`);
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

