import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, AppState, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { getCurrencySymbol } from '@/lib/formatters';
import { usePreferences } from '@/context/PreferencesContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedPressable from '@/components/AnimatedPressable';
import TabScreenTransition from '@/components/TabScreenTransition';
import * as Haptics from 'expo-haptics';
import FadeInView from '@/components/FadeInView';
import AnimatedNumber from '@/components/AnimatedNumber';
import { useFocusEffect } from '@react-navigation/native';
import { getAvailableReports, Season } from '@/lib/seasonDefinitions';

const SPORT_EMOJI: Record<string, string> = {
  NFL: '\uD83C\uDFC8', NBA: '\uD83C\uDFC0', MLB: '\u26BE',
  NHL: '\uD83C\uDFD2', NCAAF: '\uD83C\uDFC8', NCAAB: '\uD83C\uDFC0',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { currency, showBalance } = usePreferences();
  const currencySymbol = getCurrencySymbol(currency);
  const [totalBets, setTotalBets] = useState<number | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [profit, setProfit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadInsights, setUnreadInsights] = useState(0);
  const [todayAlertCount, setTodayAlertCount] = useState(0);
  const [availableReports, setAvailableReports] = useState<Array<Season & { betCount: number }>>([]);

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

      const total = bets.length;
      setTotalBets(total);

      const wonBets = bets.filter(b => b.status === 'won');
      const lostBets = bets.filter(b => b.status === 'lost');
      const settledBets = wonBets.length + lostBets.length;
      const rate = settledBets > 0 ? (wonBets.length / settledBets) * 100 : 0;
      setWinRate(rate);

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

  const fetchUnreadInsights = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('ai_insights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadInsights(count ?? 0);
  }, [user]);

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

  useFocusEffect(
    useCallback(() => {
      fetchUnreadInsights();
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('recent_alerts');
          if (!raw) { setTodayAlertCount(0); return; }
          const alerts = JSON.parse(raw);
          const today = new Date().toISOString().split('T')[0];
          const count = alerts.filter((a: any) => a.timestamp?.startsWith(today)).length;
          setTodayAlertCount(count);
        } catch {
          setTodayAlertCount(0);
        }
      })();
      if (user) {
        getAvailableReports(user.id)
          .then(setAvailableReports)
          .catch(() => setAvailableReports([]));
      }
    }, [fetchUnreadInsights, user])
  );

  const handleSignOut = async () => {
    await signOut();
  };

  const profitColor = profit === null || profit >= 0 ? colors.accent : colors.loss;

  const menuItems = [
    { icon: 'person-outline', title: 'Account Settings', description: 'Manage Your Profile', route: '/account-settings' },
    { icon: 'notifications-outline', title: 'Notifications', description: 'Push & Email Preferences', route: '/notifications' },
    { icon: 'settings-outline', title: 'Preferences', description: 'App Settings & Privacy', route: '/preferences' },
    { icon: 'help-circle-outline', title: 'Help & Support', description: 'FAQs & Contact Us', route: '/help-support' },
  ] as const;

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TabScreenTransition>
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage Your Account Settings</Text>
          </View>
        </FadeInView>

        {/* Card 1 - User Profile Card */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.profileCard}>
            <View style={styles.userInfoSection}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person-outline" size={32} color={colors.iconSecondary} />
              </View>
              <View style={styles.userTextContainer}>
                <Text style={styles.userName} numberOfLines={1}>{user?.user_metadata?.full_name || 'John Trader'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user?.email || 'john.trader@email.com'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

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
                ) : showBalance ? (
                  <AnimatedNumber
                    value={Math.abs(profit || 0)}
                    prefix={profit !== null && profit < 0 ? `-${currencySymbol}` : currencySymbol}
                    decimals={0}
                    delay={280}
                    style={[styles.statValue, { color: profitColor }]}
                  />
                ) : (
                  <Text style={[styles.statValue, { color: profitColor }]}>••••</Text>
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
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={22} color={colors.iconSecondary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Appearance</Text>
              <Text style={styles.settingDescription}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={colors.border}
            />
          </View>
        </FadeInView>

        {/* AI Coach Card */}
        <FadeInView delay={230} direction="bottom">
          <AnimatedPressable
            style={styles.settingCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/ai-coach'); }}
            scaleDown={0.98}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="sparkles" size={22} color={colors.accent} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>AI Coach</Text>
              <Text style={styles.settingDescription}>Personalized Betting Insights</Text>
            </View>
            {unreadInsights > 0 && (
              <View style={styles.unreadDot} />
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </AnimatedPressable>
        </FadeInView>

        {/* Insights Card */}
        <FadeInView delay={240} direction="bottom">
          <AnimatedPressable
            style={styles.settingCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/insights'); }}
            scaleDown={0.98}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="bulb-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Insights</Text>
              <Text style={styles.settingDescription}>Smart Streaks & Pattern Alerts</Text>
            </View>
            {todayAlertCount > 0 && (
              <View style={{
                minWidth: 22, height: 22, borderRadius: 11,
                backgroundColor: colors.accent, alignItems: 'center' as const,
                justifyContent: 'center' as const, paddingHorizontal: 6, marginRight: 8,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700' as const, color: '#FFFFFF' }}>
                  {todayAlertCount}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </AnimatedPressable>
        </FadeInView>

        {/* Season Reports */}
        <FadeInView delay={250} direction="bottom">
          {availableReports.length > 0 ? (
            <View>
              {availableReports.map((report) => (
                <AnimatedPressable
                  key={`${report.sport}-${report.label}`}
                  style={styles.settingCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                      pathname: '/season-report',
                      params: {
                        sport: report.sport,
                        seasonLabel: report.label,
                        startDate: report.startDate,
                        endDate: report.endDate,
                      },
                    });
                  }}
                  scaleDown={0.98}
                >
                  <View style={styles.settingIconCircle}>
                    <Text style={{ fontSize: 22 }}>
                      {SPORT_EMOJI[report.sport] || '\uD83C\uDFC6'}
                    </Text>
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>{report.label}</Text>
                    <Text style={styles.settingDescription}>
                      {report.betCount} bets analyzed
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textTertiary}
                  />
                </AnimatedPressable>
              ))}
            </View>
          ) : (
            <View style={styles.settingCard}>
              <View style={styles.settingIconCircle}>
                <Ionicons
                  name="trophy-outline"
                  size={22}
                  color={colors.iconSecondary}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Season Reports</Text>
                <Text style={styles.settingDescription}>
                  Your first season report will appear here when a season ends
                </Text>
              </View>
            </View>
          )}
        </FadeInView>

        {/* What-If Engine */}
        <FadeInView delay={260} direction="bottom">
          <AnimatedPressable
            style={styles.settingCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/what-if'); }}
            scaleDown={0.98}
          >
            <View style={styles.settingIconCircle}>
              <Ionicons name="git-branch-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>What-If Engine</Text>
              <Text style={styles.settingDescription}>Simulate Alternate Strategies</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </AnimatedPressable>
        </FadeInView>

        {/* Card 3 - Settings Menu Card */}
        <FadeInView delay={280} direction="bottom">
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <AnimatedPressable
                key={item.route}
                style={styles.menuRow}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route); }}
                scaleDown={0.98}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name={item.icon as any} size={22} color={colors.iconSecondary} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </AnimatedPressable>
            ))}
          </View>
        </FadeInView>

        {/* Sign Out Button */}
        <FadeInView delay={380} direction="bottom">
          <AnimatedPressable style={styles.signOutButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSignOut(); }} scaleDown={0.97}>
            <Ionicons name="log-out-outline" size={20} color={colors.loss} style={styles.signOutIcon} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </AnimatedPressable>
        </FadeInView>

        {/* Version Footer */}
        <FadeInView delay={440} direction="none">
          <Text style={styles.versionText}>v1.0.0</Text>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
    </TabScreenTransition>
  );
}

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 100,
    },

    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
      lineHeight: 20,
    },

    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.iconCircleBg,
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
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
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
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textTertiary,
      letterSpacing: 0.5,
    },

    settingCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.iconCircleBg,
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
      color: colors.text,
      marginBottom: 3,
    },
    settingDescription: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
    },

    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.iconCircleBg,
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
      color: colors.text,
      marginBottom: 3,
    },
    menuDescription: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
    },

    signOutButton: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.loss,
    },

    versionText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textTertiary,
      textAlign: 'center',
      letterSpacing: 0.8,
      marginTop: 2,
    },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accent,
      marginRight: 8,
    },
  });
}
