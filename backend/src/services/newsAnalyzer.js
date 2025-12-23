// Analyze news article for fake news, clickbait, and phishing indicators
// This is a simplified version - in production, you'd use ML models or external APIs

async function analyzeNews(article) {
  const { title, description, url } = article;

  // Fake news detection (simplified heuristic-based approach)
  const fakeNewsRate = detectFakeNews(title, description, url);

  // Clickbait detection
  const clickbaitRate = detectClickbait(title);

  // Phishing detection
  const phishingRate = detectPhishing(url, title);

  return {
    fakeNewsRate: Math.round(fakeNewsRate * 100) / 100, // Round to 2 decimal places
    clickbaitRate: Math.round(clickbaitRate * 100) / 100,
    phishingRate: Math.round(phishingRate * 100) / 100
  };
}

// Detect fake news indicators (0.0 to 1.0)
function detectFakeNews(title, description, url) {
  let score = 0.0;
  let indicators = 0;

  // Suspicious words/phrases
  const suspiciousPhrases = [
    'shocking truth', 'they don\'t want you to know', 'doctors hate',
    'one weird trick', 'this will blow your mind', 'secret revealed',
    'conspiracy', 'cover-up', 'mainstream media won\'t tell you'
  ];

  const text = `${title} ${description}`.toLowerCase();

  suspiciousPhrases.forEach(phrase => {
    if (text.includes(phrase)) {
      score += 0.15;
      indicators++;
    }
  });

  // URL credibility check
  const urlLower = url.toLowerCase();
  const trustedDomains = ['reuters.com', 'ap.org', 'bbc.com', 'nytimes.com', 'washingtonpost.com'];
  const untrustedDomains = ['.blogspot.', '.wordpress.', 'freehosting'];
  
  if (untrustedDomains.some(domain => urlLower.includes(domain))) {
    score += 0.2;
    indicators++;
  } else if (trustedDomains.some(domain => urlLower.includes(domain))) {
    score -= 0.1; // Reduce score for trusted domains
  }

  // Excessive capitalization
  const capsRatio = (title.match(/[A-Z]/g) || []).length / title.length;
  if (capsRatio > 0.5 && title.length > 10) {
    score += 0.1;
    indicators++;
  }

  // Too many exclamation marks
  const exclamationCount = (title.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    score += 0.1;
    indicators++;
  }

  // Normalize score (0.0 to 1.0)
  return Math.min(1.0, Math.max(0.0, score));
}

// Detect clickbait headlines (0.0 to 1.0)
function detectClickbait(title) {
  let score = 0.0;

  // Clickbait patterns
  const clickbaitPatterns = [
    { pattern: /^you won't believe/i, weight: 0.3 },
    { pattern: /this (one|thing) (will|is going to)/i, weight: 0.25 },
    { pattern: /number \d+ (will|is)/i, weight: 0.2 },
    { pattern: /^(the|this) (one|secret|trick|way)/i, weight: 0.2 },
    { pattern: /(shocking|amazing|incredible|unbelievable)/i, weight: 0.15 },
    { pattern: /\?$/, weight: 0.1 }, // Ends with question mark
    { pattern: /!\s*!+/, weight: 0.15 }, // Multiple exclamation marks
    { pattern: /(everyone|everybody) (is|are|needs)/i, weight: 0.15 }
  ];

  clickbaitPatterns.forEach(({ pattern, weight }) => {
    if (pattern.test(title)) {
      score += weight;
    }
  });

  // List format (often clickbait)
  if (/^\d+\.|^top \d+|^\d+ (ways|things|reasons|tips)/i.test(title)) {
    score += 0.2;
  }

  // Vague or emotional language
  const vagueWords = ['this', 'that', 'these', 'those', 'it', 'they'];
  const vagueCount = vagueWords.filter(word => 
    new RegExp(`\\b${word}\\b`, 'i').test(title)
  ).length;
  if (vagueCount > 2) {
    score += 0.1;
  }

  // Normalize to 0.0-1.0
  return Math.min(1.0, Math.max(0.0, score));
}

// Detect phishing indicators (0.0 to 1.0)
function detectPhishing(url, title) {
  let score = 0.0;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Suspicious domain patterns
    const suspiciousPatterns = [
      /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/, // IP address
      /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly/, // URL shorteners
      /[a-z0-9-]{30,}\.com/, // Very long random subdomains
      /\.tk$|\.ml$|\.ga$|\.cf$/, // Suspicious TLDs
    ];

    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(hostname)) {
        score += 0.2;
      }
    });

    // Typosquatting indicators (simplified)
    const commonDomains = ['google', 'facebook', 'amazon', 'microsoft', 'apple'];
    commonDomains.forEach(domain => {
      if (hostname.includes(domain) && !hostname.includes(`.${domain}.`) && !hostname.endsWith(`${domain}.com`)) {
        score += 0.3;
      }
    });

    // HTTPS check
    if (urlObj.protocol !== 'https:') {
      score += 0.15;
    }

    // Suspicious keywords in title
    const phishingKeywords = ['verify', 'update', 'confirm', 'suspended', 'locked', 'expired'];
    const titleLower = title.toLowerCase();
    phishingKeywords.forEach(keyword => {
      if (titleLower.includes(keyword) && (titleLower.includes('account') || titleLower.includes('password'))) {
        score += 0.1;
      }
    });

  } catch (error) {
    // Invalid URL - could be phishing
    score += 0.2;
  }

  // Normalize to 0.0-1.0
  return Math.min(1.0, Math.max(0.0, score));
}

module.exports = {
  analyzeNews
};

