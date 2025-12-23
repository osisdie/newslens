import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SourcesScreen() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    try {
      const response = await api.get('/sources');
      setSources(response.data.sources || []);
    } catch (error) {
      console.error('Load sources error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addSource() {
    if (!newUrl || !newKeywords) {
      Alert.alert('Error', 'Please enter URL and keywords');
      return;
    }

    const keywords = newKeywords.split(',').map(k => k.trim()).filter(k => k);

    try {
      await api.post('/sources', {
        base_url: newUrl,
        keywords
      });
      setNewUrl('');
      setNewKeywords('');
      loadSources();
      Alert.alert('Success', 'Source added successfully');
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to add source'
      );
    }
  }

  async function deleteSource(sourceId) {
    Alert.alert(
      'Delete Source',
      'Are you sure you want to delete this source?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/sources/${sourceId}`);
              loadSources();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete source');
            }
          }
        }
      ]
    );
  }

  function renderSource({ item }) {
    const keywords = item.keywords || [];
    const isPaid = user?.subscription_status === 'active';
    const canAddMore = isPaid || sources.length < 3;
    const canAddKeywords = isPaid || keywords.length < 3;

    return (
      <View style={styles.sourceCard}>
        <View style={styles.sourceHeader}>
          <Text style={styles.sourceUrl}>{item.base_url}</Text>
          <TouchableOpacity
            onPress={() => deleteSource(item.id)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.keywordsLabel}>Keywords:</Text>
        <View style={styles.keywordsContainer}>
          {keywords.map((kw, idx) => (
            <View key={idx} style={styles.keywordTag}>
              <Text style={styles.keywordText}>{kw.keyword}</Text>
            </View>
          ))}
        </View>
        {!canAddKeywords && (
          <Text style={styles.limitText}>
            Free tier: Max 3 keywords. Upgrade for unlimited.
          </Text>
        )}
      </View>
    );
  }

  const isPaid = user?.subscription_status === 'active';
  const canAddMore = isPaid || sources.length < 3;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="News source URL (e.g., https://tw.news.yahoo.com/)"
          value={newUrl}
          onChangeText={setNewUrl}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Keywords (comma-separated, e.g., AI, Technology)"
          value={newKeywords}
          onChangeText={setNewKeywords}
        />
        <TouchableOpacity
          style={[styles.button, !canAddMore && styles.buttonDisabled]}
          onPress={addSource}
          disabled={!canAddMore}
        >
          <Text style={styles.buttonText}>Add Source</Text>
        </TouchableOpacity>
        {!canAddMore && (
          <Text style={styles.limitText}>
            Free tier: Max 3 sources. Upgrade for unlimited.
          </Text>
        )}
      </View>

      <FlatList
        data={sources}
        renderItem={renderSource}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No sources added yet. Add one above!</Text>
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
  form: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 14
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonDisabled: {
    backgroundColor: '#ccc'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  limitText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginTop: 5,
    textAlign: 'center'
  },
  sourceCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    marginHorizontal: 10,
    borderRadius: 8
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sourceUrl: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1
  },
  deleteButton: {
    padding: 5
  },
  deleteText: {
    color: '#ff6b6b',
    fontSize: 14
  },
  keywordsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  keywordTag: {
    backgroundColor: '#e3f2fd',
    padding: 5,
    borderRadius: 4,
    marginRight: 5,
    marginBottom: 5
  },
  keywordText: {
    fontSize: 12,
    color: '#1976d2'
  }
});

