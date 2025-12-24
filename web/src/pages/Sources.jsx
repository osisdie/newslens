import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TagInput from '../components/TagInput';
import './Sources.css';

// Predefined news sources
const PREDEFINED_SOURCES = [
  { name: 'Google News (繁體中文)', url: 'https://news.google.com/' },
  { name: 'Yahoo News (台灣)', url: 'https://tw.news.yahoo.com/' },
  { name: 'Yahoo News (US)', url: 'https://news.yahoo.com/' },
  { name: '經濟日報 (money.udn.com)', url: 'https://money.udn.com/' },
  { name: 'Custom URL', url: '' }
];

export default function Sources() {
  const [selectedSource, setSelectedSource] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [editKeywords, setEditKeywords] = useState([]);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const response = await api.get('/sources');
      return response.data;
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/sources', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      setNewUrl('');
      setNewKeywords('');
      setSelectedSource('');
      alert('Source added successfully!');
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to add source');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (sourceId) => {
      await api.delete(`/sources/${sourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ sourceId, keywords }) => {
      const response = await api.put(`/sources/${sourceId}/keywords`, { keywords });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      setEditingSourceId(null);
      setEditKeywords([]);
      alert('Keywords updated successfully!');
    },
    onError: (error) => {
      alert(error.response?.data?.error || 'Failed to update keywords');
    }
  });

  function handleSourceChange(e) {
    const value = e.target.value;
    setSelectedSource(value);
    
    if (value === 'custom') {
      setNewUrl('');
    } else {
      const source = PREDEFINED_SOURCES.find(s => s.url === value);
      if (source) {
        setNewUrl(source.url);
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const urlToUse = selectedSource === 'custom' ? newUrl : selectedSource;
    
    if (!urlToUse || !newKeywords) {
      alert('Please select a source and enter keywords');
      return;
    }

    const keywords = newKeywords.split(',').map(k => k.trim()).filter(k => k);
    addMutation.mutate({ base_url: urlToUse, keywords });
  }

  function handleDelete(sourceId) {
    if (confirm('Are you sure you want to delete this source?')) {
      deleteMutation.mutate(sourceId);
    }
  }

  function handleEdit(source) {
    const keywordsArray = (source.keywords || []).map(kw => kw.keyword);
    setEditKeywords(keywordsArray);
    setEditingSourceId(source.id);
  }

  function handleCancelEdit() {
    setEditingSourceId(null);
    setEditKeywords([]);
  }

  function handleSaveEdit(sourceId) {
    if (editKeywords.length === 0) {
      alert('Please enter at least one keyword');
      return;
    }

    updateMutation.mutate({ sourceId, keywords: editKeywords });
  }

  if (isLoading) {
    return <div className="loading">Loading sources...</div>;
  }

  const sources = data?.sources || [];
  const isPaid = user?.subscription_status === 'active';
  const canAddMore = isPaid || sources.length < 3;

  return (
    <div className="sources-page">
      <h1>News Sources</h1>
      
      <form onSubmit={handleSubmit} className="source-form">
        <select
          className="source-select"
          value={selectedSource}
          onChange={handleSourceChange}
          required
        >
          <option value="">Select a news source...</option>
          {PREDEFINED_SOURCES.map((source, idx) => (
            <option key={idx} value={source.url || 'custom'}>
              {source.name}
            </option>
          ))}
        </select>
        {selectedSource === 'custom' && (
          <input
            type="url"
            placeholder="Enter custom news source URL (e.g., https://example.com/)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            required
          />
        )}
        <input
          type="text"
          placeholder="Keywords (comma-separated, e.g., AI, Technology)"
          value={newKeywords}
          onChange={(e) => setNewKeywords(e.target.value)}
          required
        />
        <button type="submit" disabled={!canAddMore || addMutation.isLoading}>
          {addMutation.isLoading ? 'Adding...' : 'Add Source'}
        </button>
        {!canAddMore && (
          <p className="limit-message">
            Free tier: Maximum 3 sources. Upgrade for unlimited.
          </p>
        )}
      </form>

      <div className="sources-list">
        {sources.length === 0 ? (
          <div className="empty-state">
            <p>No sources added yet. Add one above!</p>
          </div>
        ) : (
          sources.map((source) => {
            const keywords = source.keywords || [];
            const canAddKeywords = isPaid || keywords.length < 3;
            
            const isEditing = editingSourceId === source.id;
            
            return (
              <div key={source.id} className="source-card">
                <div className="source-header">
                  <h3>{source.base_url}</h3>
                  <div className="source-actions">
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => handleEdit(source)}
                          className="edit-button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSaveEdit(source.id)}
                          className="save-button"
                          disabled={updateMutation.isLoading}
                        >
                          {updateMutation.isLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="cancel-button"
                          disabled={updateMutation.isLoading}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="keywords-section">
                  <p className="keywords-label">Keywords:</p>
                  {isEditing ? (
                    <div className="edit-keywords-form">
                      <TagInput
                        tags={editKeywords}
                        onChange={setEditKeywords}
                        placeholder="Add keywords (press Enter, comma, or semicolon)"
                        disabled={updateMutation.isLoading}
                      />
                      {!canAddKeywords && editKeywords.length >= 3 && (
                        <p className="limit-message">
                          Free tier: Max 3 keywords per source. Upgrade for unlimited.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="keywords-list">
                        {keywords.map((kw, idx) => (
                          <span key={idx} className="keyword-tag">
                            {kw.keyword}
                          </span>
                        ))}
                      </div>
                      {!canAddKeywords && (
                        <p className="limit-message">
                          Free tier: Max 3 keywords per source. Upgrade for unlimited.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

