import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import './Billing.css';

export default function Billing() {
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data: subscriptionData, refetch: refetchSubscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await api.get('/billing/subscription');
      return response.data;
    }
  });

  const { data: historyData } = useQuery({
    queryKey: ['billing-history'],
    queryFn: async () => {
      const response = await api.get('/billing/history');
      return response.data;
    }
  });

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      const response = await api.post('/billing/checkout', {
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/billing?canceled=true`
      });
      window.location.href = response.data.checkout_url;
    } catch (error) {
      alert('Failed to create checkout session');
      setCheckoutLoading(false);
    }
  }

  async function toggleAutoRenew(enable) {
    try {
      if (enable) {
        await api.post('/billing/enable-auto-renew');
      } else {
        await api.post('/billing/cancel-auto-renew');
      }
      await refetchSubscription();
      alert(`Auto-renewal ${enable ? 'enabled' : 'cancelled'}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update auto-renewal');
    }
  }

  const subscription = subscriptionData?.subscription;
  const history = historyData?.history || [];
  const isActive = subscription?.status === 'active';
  const isFree = !subscription || subscription.status === 'free';

  return (
    <div className="billing-page">
      <h1>Billing & Subscription</h1>

      <div className="billing-section">
        <h2>Subscription Status</h2>
        <div className="status-card">
          <div className="status-row">
            <span className="status-label">Status:</span>
            <span className="status-value">{subscription?.status || 'free'}</span>
          </div>
          {isActive && subscription.current_period_end && (
            <div className="status-row">
              <span className="status-label">
                {subscription.auto_renew ? 'Renews on:' : 'Expires on:'}
              </span>
              <span className="status-value">
                {new Date(subscription.current_period_end).toLocaleDateString()}
                {!subscription.auto_renew && (
                  <span className="status-note"> (auto-renew cancelled)</span>
                )}
              </span>
            </div>
          )}
          {isActive && (
            <div className="auto-renew-section">
              <div className="status-row">
                <span className="status-label">Auto-renew:</span>
                <span className="status-value">
                  {subscription.auto_renew ? 'On' : 'Off'}
                </span>
              </div>
              <button
                className="toggle-button"
                onClick={() => toggleAutoRenew(!subscription.auto_renew)}
              >
                {subscription.auto_renew ? 'Disable' : 'Enable'} Auto-renew
              </button>
            </div>
          )}
        </div>

        {isFree && (
          <button
            className="subscribe-button"
            onClick={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? 'Loading...' : 'Subscribe Now'}
          </button>
        )}
      </div>

      <div className="billing-section">
        <h2>Billing History</h2>
        {history.length === 0 ? (
          <div className="empty-state">No billing history</div>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-row">
                  <span className="history-amount">
                    ${item.amount} {item.currency}
                  </span>
                  <span className="history-status">{item.status}</span>
                </div>
                <div className="history-date">
                  {new Date(item.billing_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

