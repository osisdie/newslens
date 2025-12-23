import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { api } from '../services/api';

export default function NewsScreen() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNews();
  }, []);

  async function loadNews() {
    try {
      const response = await api.get('/news');
      setArticles(response.data.articles || []);
    } catch (error) {
      console.error('Load news error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function renderArticle({ item }) {
    return (
      <TouchableOpacity style={styles.article}>
        <Text style={styles.articleTitle}>{item.title}</Text>
        {item.description && (
          <Text style={styles.articleDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={styles.source}>{item.source_url}</Text>
          {item.published_at && (
            <Text style={styles.date}>
              {new Date(item.published_at).toLocaleDateString()}
            </Text>
          )}
        </View>
        <View style={styles.ratings}>
          <Text style={styles.rating}>
            Fake: {(item.fake_news_rate * 100).toFixed(0)}%
          </Text>
          <Text style={styles.rating}>
            Clickbait: {(item.clickbait_rate * 100).toFixed(0)}%
          </Text>
          <Text style={styles.rating}>
            Phishing: {(item.phishing_rate * 100).toFixed(0)}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadNews} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No news articles found. Add sources to get started!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  article: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    marginHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8
  },
  articleDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  source: {
    fontSize: 12,
    color: '#999'
  },
  date: {
    fontSize: 12,
    color: '#999'
  },
  ratings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  rating: {
    fontSize: 11,
    color: '#666'
  }
});

