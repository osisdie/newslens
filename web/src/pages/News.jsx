import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import './News.css';

// Helper function to format UTC date as mm/dd/yyyy
function formatLocalDate(utcDateString) {
  if (!utcDateString) return null;
  
  const date = new Date(utcDateString);
  if (isNaN(date.getTime())) return null;
  
  // Format as mm/dd/yyyy
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
}

// Helper function to format date with full details (for modal) - mm/dd/yyyy format
function formatFullLocalDate(utcDateString) {
  if (!utcDateString) return null;
  
  const date = new Date(utcDateString);
  if (isNaN(date.getTime())) return null;
  
  // Format as mm/dd/yyyy
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
}

export default function News() {
  // Force console output - these should ALWAYS show
  console.log('=== NEWS COMPONENT RENDERING ===');
  // console.error('=== NEWS COMPONENT ERROR TEST ===');
  // console.warn('=== NEWS COMPONENT WARN TEST ===');
  
  const [autoScrapeTriggered, setAutoScrapeTriggered] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('[News] Component mounted');
    return () => {
      console.log('[News] Component unmounting');
    };
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      console.log('[News] Fetching news...');
      const response = await api.get('/news');
      console.log('[News] Got response:', response.data);
      return response.data;
    },
    enabled: true, // Explicitly enable the query
    retry: false // Disable retry for debugging
  });

  const {
    data: favoritesData,
    isLoading: favoritesLoading
  } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const response = await api.get('/favorites');
      return response.data;
    }
  });

  const { data: sourcesData } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const response = await api.get('/sources');
      return response.data;
    }
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      console.log('[News] Starting scrape mutation...');
      // Ensure token is set
      const token = localStorage.getItem('auth_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      console.log('[News] Calling POST /news/scrape');
      const response = await api.post('/news/scrape');
      console.log('[News] Scrape response:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[News] Scrape completed:', data);
      refetch();
    },
    onError: (error) => {
      console.error('[News] Scrape error:', error);
      console.error('[News] Error response:', error.response?.data);
      console.error('[News] Error status:', error.response?.status);
    }
  });

  const articles = data?.articles || [];

  const favoriteIds = useMemo(() => {
    const favs = favoritesData?.favorites || [];
    return new Set(favs.map((f) => f.id));
  }, [favoritesData]);

  const groupedArticles = useMemo(() => {
    const groups = {};
    articles.forEach((article) => {
      const key = article.keyword || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(article);
    });
    return groups;
  }, [articles]);

  const keywordOptions = useMemo(() => {
    const opts = new Set();
    
    // Add keywords from articles
    articles.forEach((a) => {
      if (a.keyword) opts.add(a.keyword);
    });
    
    // Add all configured keywords from sources (even if no articles yet)
    if (sourcesData?.sources) {
      sourcesData.sources.forEach((source) => {
        if (source.keywords && Array.isArray(source.keywords)) {
          source.keywords.forEach((kw) => {
            if (kw.keyword) opts.add(kw.keyword);
          });
        }
      });
    }
    
    return Array.from(opts).sort();
  }, [articles, sourcesData]);

  // Reset filter if current selection no longer exists
  useEffect(() => {
    if (keywordFilter !== 'all' && !keywordOptions.includes(keywordFilter)) {
      setKeywordFilter('all');
    }
  }, [keywordFilter, keywordOptions]);

  const filteredGroupedArticles = useMemo(() => {
    if (keywordFilter === 'all') return groupedArticles;
    const filtered = {};
    Object.entries(groupedArticles).forEach(([k, list]) => {
      if (k === keywordFilter) {
        filtered[k] = list;
      }
    });
    return filtered;
  }, [groupedArticles, keywordFilter]);

  useEffect(() => {
    console.log('[News] useEffect triggered:', {
      isLoading,
      scrapeMutationIsLoading: scrapeMutation.isLoading,
      autoScrapeTriggered,
      articlesLength: articles.length,
      hasData: !!data,
      dataArticlesLength: data?.articles?.length
    });

    if (
      !isLoading &&
      !scrapeMutation.isLoading &&
      !autoScrapeTriggered &&
      articles.length === 0 &&
      data // Ensure data has been loaded (even if empty)
    ) {
      console.log('[News] Auto-triggering scrape...');
      setAutoScrapeTriggered(true);
      scrapeMutation.mutate();
    }
  }, [isLoading, scrapeMutation.isLoading, autoScrapeTriggered, articles.length, data]);

  // While scraping is in progress, poll the news endpoint to reflect per-article updates
  useEffect(() => {
    if (!scrapeMutation.isLoading) return undefined;
    const interval = setInterval(() => {
      refetch();
    }, 2000); // poll every 2s during scrape
    return () => clearInterval(interval);
  }, [scrapeMutation.isLoading, refetch]);

  console.log('[News] Render state:', { isLoading, articlesCount: articles.length, autoScrapeTriggered });

  if (isLoading) {
    console.log('[News] Showing loading state');
    return <div className="loading">Loading news...</div>;
  }

  console.log('[News] Rendering main content');
  return (
    <div className="news-page">
      {/* DEBUG: Visible test element */}
      <div style={{padding: '10px', backgroundColor: 'yellow', marginBottom: '10px'}}>
        DEBUG: Component rendered. Articles: {articles.length}, Loading: {isLoading ? 'YES' : 'NO'}, AutoScrape: {autoScrapeTriggered ? 'YES' : 'NO'}
      </div>
      <div className="news-header">
        <h1>Latest News</h1>
        <div className="header-actions">
          {keywordOptions.length > 0 && (
            <select
              className="keyword-filter"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
            >
              <option value="all">All keywords</option>
              {keywordOptions.map((kw) => (
                <option key={kw} value={kw}>{kw}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              console.log('=== REFRESH BUTTON CLICKED ===');
              scrapeMutation.mutate();
            }}
            className="refresh-button"
            disabled={scrapeMutation.isLoading}
          >
            {scrapeMutation.isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            className="favorites-button"
            onClick={() => setShowFavorites(true)}
            disabled={favoritesLoading}
          >
            Favorites ({favoritesData?.favorites?.length || 0})
          </button>
        </div>
      </div>
      
      {scrapeMutation.isSuccess && scrapeMutation.data && (
        <div className="success-message" style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
          {scrapeMutation.data.articlesScraped > 0 
            ? `Successfully scraped ${scrapeMutation.data.articlesScraped} new article(s)!`
            : 'No new articles found. Try different keywords or sources.'}
        </div>
      )}
      
      {scrapeMutation.isError && (
        <div className="error-message" style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          {scrapeMutation.error?.response?.data?.error || 'Failed to refresh news'}
        </div>
      )}
      
      {articles.length === 0 ? (
        <div className="empty-state">
          <p>No news articles found. {scrapeMutation.isLoading ? 'Scraping news...' : 'Add sources to get started!'}</p>
        </div>
      ) : (
        Object.entries(filteredGroupedArticles).map(([keyword, list]) => (
          <div key={keyword} className="keyword-group">
            <div className="keyword-header">
              <span className="keyword-badge">{keyword}</span>
              <span className="keyword-count">{list.length} articles</span>
            </div>
            <div className="articles-grid">
              {list.map((article) => {
                const isFav = favoriteIds.has(article.id);
                return (
                  <div key={article.id} className="article-card">
                    <div className="article-top">
                      <h3 className="article-title">{article.title}</h3>
                      <span className="date-badge">
                        {formatLocalDate(article.published_at) || 'No date'}
                      </span>
                    </div>
                    {article.author && (
                      <div className="article-author">
                        <span className="author-label">By:</span>
                        <span className="author-name">{article.author}</span>
                      </div>
                    )}
                    {article.description && (
                      <p className="article-description">{article.description}</p>
                    )}
                    <div className="article-meta">
                      <span className="source">{article.source_url}</span>
                      {article.keyword && (
                        <span className="keyword-pill">{article.keyword}</span>
                      )}
                    </div>
                    <div className="article-ratings">
                      <div className="rating">
                        <span className="rating-label">Fake News:</span>
                        <span className="rating-value">
                          {(article.fake_news_rate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="rating">
                        <span className="rating-label">Clickbait:</span>
                        <span className="rating-value">
                          {(article.clickbait_rate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="rating">
                        <span className="rating-label">Phishing:</span>
                        <span className="rating-value">
                          {(article.phishing_rate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="article-actions">
                      <button
                        className={`favorite-toggle ${isFav ? 'active' : ''}`}
                        onClick={async () => {
                          if (isFav) {
                            await api.delete(`/favorites/${article.id}`);
                          } else {
                            await api.post(`/favorites/${article.id}`);
                          }
                          queryClient.invalidateQueries(['favorites']);
                        }}
                      >
                        {isFav ? '★ Favorited' : '☆ Favorite'}
                      </button>
                      <button
                        className="article-link"
                        onClick={() => setSelectedArticle(article)}
                      >
                        Read More →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {selectedArticle && (
        <div className="modal-backdrop" onClick={() => setSelectedArticle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedArticle.title}</h3>
              <button className="close-button" onClick={() => setSelectedArticle(null)}>✕</button>
            </div>
            <div className="modal-body">
              {selectedArticle.published_at && (
                <div className="date-badge large">
                  {formatFullLocalDate(selectedArticle.published_at)}
                </div>
              )}
              {selectedArticle.description && (
                <p className="article-description">{selectedArticle.description}</p>
              )}
              <div className="article-meta">
                <span className="source">{selectedArticle.source_url}</span>
                {selectedArticle.keyword && (
                  <span className="keyword-pill">{selectedArticle.keyword}</span>
                )}
              </div>
              <a
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="article-link external"
              >
                Open Source →
              </a>
            </div>
          </div>
        </div>
      )}

      {showFavorites && (
        <div className="modal-backdrop" onClick={() => setShowFavorites(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Favorites</h3>
              <button className="close-button" onClick={() => setShowFavorites(false)}>✕</button>
            </div>
            <div className="modal-body favorites-modal">
              {favoritesLoading ? (
                <div>Loading favorites...</div>
              ) : (favoritesData?.favorites || []).length === 0 ? (
                <div>No favorites yet.</div>
              ) : (
                (favoritesData?.favorites || []).map((fav) => (
                  <div key={fav.id} className="favorite-row">
                    <div>
                      <div className="article-title">{fav.title}</div>
                      <div className="article-meta">
                        <span className="source">{fav.source_url}</span>
                        {fav.keyword && <span className="keyword-pill">{fav.keyword}</span>}
                      </div>
                    </div>
                    <div className="favorite-actions">
                      <button
                        className="article-link"
                        onClick={() => setSelectedArticle(fav)}
                      >
                        Read
                      </button>
                      <button
                        className="favorite-toggle active"
                        onClick={async () => {
                          await api.delete(`/favorites/${fav.id}`);
                          queryClient.invalidateQueries(['favorites']);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

 