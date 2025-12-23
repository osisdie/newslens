import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import { api } from '../services/api';

export default function BillingScreen() {
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    try {
      const [subResponse, historyResponse] = await Promise.all([
        api.get('/billing/subscription'),
        api.get('/billing/history')
      ]);
      setSubscription(subResponse.data.subscription);
      setHistory(historyResponse.data.history || []);
    } catch (error) {
      console.error('Load billing error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    try {
      const response = await api.post('/billing/checkout', {
        success_url: 'myapp://billing/success',
        cancel_url: 'myapp://billing/cancel'
      });
      
      // Open checkout URL in browser
      const canOpen = await Linking.canOpenURL(response.data.checkout_url);
      if (canOpen) {
        await Linking.openURL(response.data.checkout_url);
      } else {
        Alert.alert('Error', 'Cannot open checkout URL');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create checkout session');
    }
  }

  async function toggleAutoRenew(enable) {
    try {
      if (enable) {
        await api.post('/billing/enable-auto-renew');
      } else {
        await api.post('/billing/cancel-auto-renew');
      }
      loadBilling();
      Alert.alert('Success', `Auto-renewal ${enable ? 'enabled' : 'cancelled'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update auto-renewal');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isActive = subscription?.status === 'active';
  const isFree = !subscription || subscription.status === 'free';

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription Status</Text>
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            Status: {subscription?.status || 'free'}
          </Text>
          {isActive && subscription.current_period_end && (
            <Text style={styles.periodText}>
              Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
            </Text>
          )}
          {isActive && (
            <View style={styles.autoRenewContainer}>
              <Text style={styles.autoRenewText}>
                Auto-renew: {subscription.auto_renew ? 'On' : 'Off'}
              </Text>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => toggleAutoRenew(!subscription.auto_renew)}
              >
                <Text style={styles.toggleText}>
                  {subscription.auto_renew ? 'Disable' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isFree && (
          <TouchableOpacity style={styles.subscribeButton} onPress={handleCheckout}>
            <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Billing History</Text>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <View style={styles.historyRow}>
                <Text style={styles.historyAmount}>
                  ${item.amount} {item.currency}
                </Text>
                <Text style={styles.historyStatus}>{item.status}</Text>
              </View>
              <Text style={styles.historyDate}>
                {new Date(item.billing_date).toLocaleDateString()}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No billing history</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10
  },
  statusText: {
    fontSize: 16,
    marginBottom: 5
  },
  periodText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10
  },
  autoRenewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  autoRenewText: {
    fontSize: 14
  },
  toggleButton: {
    padding: 5
  },
  toggleText: {
    color: '#007AFF',
    fontSize: 14
  },
  subscribeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  historyStatus: {
    fontSize: 14,
    color: '#666'
  },
  historyDate: {
    fontSize: 12,
    color: '#999'
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20
  }
});

