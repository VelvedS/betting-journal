import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCompactCurrency, formatPercent, formatWholeNumber } from '@/lib/formatters';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [totalBets, setTotalBets] = useState<number | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [profit, setProfit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: bets, error } = await supabase
        .from('bets')
        .select('id, status, wager, potential_payout')
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to fetch bets:', error);
        setTotalBets(0);
        setWinRate(0);
        setProfit(0);
        setLoading(false);
        return;
      }

      if (!bets || bets.length === 0) {
        setTotalBets(0);
        setWinRate(0);
        setProfit(0);
        setLoading(false);
        return;
      }

      // Calculate total bets
      const total = bets.length;
      setTotalBets(total);

      // Calculate win rate (exclude pending and void from denominator)
      const wonBets = bets.filter(b => b.status === 'won');
      const lostBets = bets.filter(b => b.status === 'lost');
      const settledBets = wonBets.length + lostBets.length;
      const rate = settledBets > 0 ? (wonBets.length / settledBets) * 100 : 0;
      setWinRate(rate);

      // Calculate profit
      const wonProfit = wonBets.reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.wager || 0)), 0);
      const lostProfit = lostBets.reduce((sum, b) => sum + (b.wager || 0), 0);
      const netProfit = wonProfit - lostProfit;
      setProfit(netProfit);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setTotalBets(0);
      setWinRate(0);
      setProfit(0);
      setLoading(false);
    }
  }, [user]);

  // Fetch stats on component mount and when app returns to focus
  useEffect(() => {
    fetchStats();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchStats();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchStats]);

  const handleSignOut = async () => {
    await signOut();
  };

  const formatProfit = (value: number | null): string => {
    if (value === null) return '—';
    if (value === 0) return '$0';
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      const formatted = (absValue / 1000).toFixed(1);
      return value >= 0 ? `$${formatted}K` : `-$${formatted}K`;
    }
    return value >= 0 ? `$${Math.round(value)}` : `-$${Math.round(absValue)}`;
  };

  const formatWinRate = (value: number | null): string => {
    if (value === null) return '—';
    return `${Math.round(value)}%`;
  };

  const profitColor = profit === null || profit >= 0 ? '#10B981' : '#E85D5D';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account settings</Text>
        </View>

        {/* Card 1 - User Profile Card */}
        <View style={styles.profileCard}>
          {/* User Info Section */}
          <View style={styles.userInfoSection}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person-outline" size={32} color="#6B6B6B" />
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>{user?.user_metadata?.full_name || 'John Trader'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'john.trader@email.com'}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{loading ? '—' : totalBets}</Text>
              <Text style={styles.statLabel}>TOTAL BETS</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{loading ? '—' : formatWinRate(winRate)}</Text>
              <Text style={styles.statLabel}>WIN RATE</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={[styles.statValue, { color: profitColor }]}>
                {loading ? '—' : formatProfit(profit)}
              </Text>
              <Text style={styles.statLabel}>PROFIT</Text>
            </View>
          </View>
        </View>

        {/* Card 2 - Appearance Toggle */}
        <View style={styles.settingCard}>
          <View style={styles.settingIconCircle}>
            <Ionicons name="sunny-outline" size={22} color="#6B6B6B" />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Appearance</Text>
            <Text style={styles.settingDescription}>The Ledger (Light)</Text>
          </View>
          <View style={styles.toggleSwitch}>
            <View style={styles.toggleThumb} />
          </View>
        </View>

        {/* Card 3 - Settings Menu Card */}
        <View style={styles.menuCard}>
          {/* Account Settings */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/account-settings')}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="person-outline" size={22} color="#6B6B6B" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Account Settings</Text>
              <Text style={styles.menuDescription}>Manage your profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/notifications')}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="notifications-outline" size={22} color="#6B6B6B" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuDescription}>Push & email preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>

          {/* Preferences */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/preferences')}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="settings-outline" size={22} color="#6B6B6B" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Preferences</Text>
              <Text style={styles.menuDescription}>App settings & privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/help-support')}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="help-circle-outline" size={22} color="#6B6B6B" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuDescription}>FAQs and contact</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#E85D5D" style={styles.signOutIcon} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version Footer */}
        <Text style={styles.versionText}>v1.0.0 // TERMINAL</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // Header Section
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 20,
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 20,
    marginBottom: 18,
  },
  userInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 16,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9B9B9B',
    letterSpacing: 0.5,
  },

  // Setting Card (Appearance)
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  settingIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  // Menu Card
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  menuDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
  },

  // Sign Out Button
  signOutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  signOutIcon: {
    marginRight: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E85D5D',
  },

  // Version Footer
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9B9B9B',
    textAlign: 'center',
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
