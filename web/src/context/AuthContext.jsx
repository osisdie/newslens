import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Load user error:', error);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('auth_token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  }

  async function register(email, password) {
    try {
      const response = await api.post('/auth/register', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('auth_token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return { success: true };
    } catch (error) {
      // Handle validation errors (array format)
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const validationErrors = error.response.data.errors
          .map(err => err.msg || err.message || `${err.param}: ${err.msg}`)
          .join(', ');
        return {
          success: false,
          error: validationErrors || 'Validation failed'
        };
      }
      
      // Handle single error message
      if (error.response?.data?.error) {
        return {
          success: false,
          error: error.response.data.error
        };
      }
      
      // Handle network errors
      if (error.message === 'Network Error' || !error.response) {
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.'
        };
      }
      
      // Fallback
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed. Please try again.'
      };
    }
  }

  function logout() {
    localStorage.removeItem('auth_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

