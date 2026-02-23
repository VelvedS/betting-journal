import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCompactCurrency, formatPercent, formatWholeNumber } from '@/lib/formatters';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';
import AnimatedNumber from '@/components/AnimatedNumber';

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


  const profitColor = profit === null || profit >= 0 ? '#10B981' : '#E85D5D';

  const menuItems = [
    { icon: 'person-outline', title: 'Account Settings', description: 'Manage your profile', route: '/account-settings' },
    { icon: 'notifications-outline', title: 'Notifications', description: 'Push & email preferences', route: '/notifications' },
    { icon: 'settings-outline', title: 'Preferences', description: 'App settings & privacy', route: '/preferences' },
    { icon: 'help-circle-outline', title: 'Help & Support', description: 'FAQs and contact', route: '/help-support' },
  ] as const;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your account settings</Text>
          </View>
        </FadeInView>

        {/* Card 1 - User Profile Card */}
        <FadeInView delay={80} direction="bottom">
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
                {loading ? (
                  <Text style={styles.statValue}>—</Text>
                ) : (
                  <AnimatedNumber
                    value={totalBets || 0}
                    delay={200}
                    style={styles.statValue}
                  />
                )}
                <Text style={styles.statLabel}>TOTAL BETS</Text>
              </View>
              <View style={styles.statColumn}>
                {loading ? (
                  <Text style={styles.statValue}>—</Text>
                ) : (
                  <AnimatedNumber
                    value={winRate || 0}
                    decimals={1}
                    suffix="%"
                    delay={240}
                    style={styles.statValue}
                  />
                )}
                <Text style={styles.statLabel}>WIN RATE</Text>
              </View>
              <View style={styles.statColumn}>
                {loading ? (
                  <Text style={[styles.statValue, { color: profitColor }]}>—</Text>
                ) : (
                  <AnimatedNumber
                    value={Math.abs(profit || 0)}
                    prefix={profit !== null && profit < 0 ? '-$' : '$'}
                    decimals={2}
                    delay={280}
                    style={[styles.statValue, { color: profitColor }]}
                  />
                )}
                <Text style={styles.statLabel}>PROFIT</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Card 2 - Appearance Toggle */}
        <FadeInView delay={200} direction="bottom">
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
        </FadeInView>

        {/* Card 3 - Settings Menu Card */}
        <FadeInView delay={260} direction="bottom">
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <AnimatedPressable
                key={item.route}
                style={styles.menuRow}
                onPress={() => router.push(item.route as any)}
                scaleDown={0.98}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name={item.icon as any} size={22} color="#6B6B6B" />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
              </AnimatedPressable>
            ))}
          </View>
        </FadeInView>

        {/* Sign Out Button */}
        <FadeInView delay={380} direction="bottom">
          <AnimatedPressable style={styles.signOutButton} onPress={handleSignOut} scaleDown={0.97}>
            <Ionicons name="log-out-outline" size={20} color="#E85D5D" style={styles.signOutIcon} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </AnimatedPressable>
        </FadeInView>

        {/* Version Footer */}
        <FadeInView delay={440} direction="none">
          <Text style={styles.versionText}>v1.0.0 // TERMINAL</Text>
        </FadeInView>
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
