import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="profile-page">
      <h1>Profile</h1>
      <div className="profile-card">
        <div className="profile-field">
          <label>Email</label>
          <div className="profile-value">{user?.email}</div>
        </div>
        <div className="profile-field">
          <label>Subscription</label>
          <div className="profile-value">
            {user?.subscription_status || 'Free'}
          </div>
        </div>
      </div>
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

