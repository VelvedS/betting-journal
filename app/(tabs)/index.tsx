import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withRepeat,
  withTiming,
  Easing,
  Extrapolation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency, formatROI, getCurrencySymbol } from '@/lib/formatters';
import { usePreferences } from '@/context/PreferencesContext';
import AnimatedPressable from '@/components/AnimatedPressable';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import FadeInView from '@/components/FadeInView';
import AnimatedNumber from '@/components/AnimatedNumber';
import PerformanceCurve, { TimePeriod } from '@/components/PerformanceCurve';
import SkeletonLoader from '@/components/SkeletonLoader';
import SkeletonBetCard from '@/components/SkeletonBetCard';
import TabScreenTransition from '@/components/TabScreenTransition';

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'won': return { label: 'WIN', statusColor: '#2DC672', statusBg: 'rgba(45, 198, 114, 0.12)', icon: 'checkmark-circle' };
    case 'lost': return { label: 'LOSS', statusColor: '#E85D5D', statusBg: '#FFECEC', icon: 'close-circle' };
    case 'pending': return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
    case 'void': return { label: 'VOID', statusColor: '#999999', statusBg: '#F0F0F0', icon: 'ban' };
    default: return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
  }
};

function getPeriodCutoff(period: TimePeriod): Date {
  const now = new Date();
  switch (period) {
    case 'Daily': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'Weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'Monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'Lifetime':
      return new Date(0);
  }
}

/** Returns the effective date for a bet, using created_at as fallback. */
function getBetDate(bet: any): Date | null {
  const raw = bet.placed_at ?? bet.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function calcPeriodStats(allBets: any[], period: TimePeriod) {
  const cutoff = getPeriodCutoff(period);
  const filtered = allBets.filter((b) => {
    const d = getBetDate(b);
    return d !== null && d >= cutoff;
  });
  let pl = 0;
  let wagered = 0;
  for (const b of filtered) {
    wagered += b.wager || 0;
    if (b.status === 'won') pl += (b.potential_payout || 0) - (b.wager || 0);
    else if (b.status === 'lost') pl -= b.wager || 0;
  }
  return { pl, wagered };
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Lifetime');
  const [recentBets, setRecentBets] = useState<any[]>([]);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [cursorPL, setCursorPL] = useState<number | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    const { data: recent } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentBets(recent || []);

    const { data: all, error: allError } = await supabase
      .from('bets')
      .select('id, status, wager, potential_payout, placed_at, created_at')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (allError) console.error('[Dashboard] allBets fetch error:', allError);
    setAllBets(all || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const hasBets = allBets.length > 0;

  // Period-specific P&L and wagered
  const { pl: periodProfit, wagered: periodWagered } = calcPeriodStats(
    allBets,
    selectedPeriod
  );

  // Display value: cursor position during drag, period total at rest
  const displayProfit = cursorPL !== null ? cursorPL : periodProfit;
  const roiPct =
    periodWagered > 0 ? (displayProfit / periodWagered) * 100 : 0;

  const { currency, showBalance } = usePreferences();
  const currencySymbol = getCurrencySymbol(currency);

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  // Animated gradient for profit card (Reanimated)
  const gradientProgress = useSharedValue(0);
  const isProfit = displayProfit > 0;
  const isLoss = displayProfit < 0;
  useEffect(() => {
    if (isProfit || isLoss) {
      gradientProgress.value = 0;
      gradientProgress.value = withRepeat(
        withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      gradientProgress.value = withTiming(0, { duration: 300 });
    }
  }, [isProfit, isLoss]);

  const gradientAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(gradientProgress.value, [0, 0.5, 1], [0.55, 0.20, 0.55], Extrapolation.CLAMP),
  }));

  const gradientBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(gradientProgress.value, [0, 0.5, 1], [0.20, 0.55, 0.20], Extrapolation.CLAMP),
  }));

  // Live number ticker — reset on focus so it counts up each time
  const [tickerKey, setTickerKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setTickerKey((k) => k + 1);
    }, [])
  );

  return (
    <TabScreenTransition>
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.chipActiveBg}
            colors={[colors.chipActiveBg]}
          />
        }
        scrollEventThrottle={16}
      >
        {/* Header Section */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Welcome Back, {displayName}</Text>
            <Text style={styles.headerQuote}>"Don't just play the books, keep your own."</Text>
          </View>
        </FadeInView>

        {loading ? (
          <>
            {/* Skeleton profit card */}
            <FadeInView delay={80} direction="bottom">
              <View style={styles.profitCard}>
                <SkeletonLoader width={140} height={12} borderRadius={6} />
                <View style={{ marginTop: 12 }}>
                  <SkeletonLoader width={180} height={36} borderRadius={8} />
                </View>
              </View>
            </FadeInView>
            {/* Skeleton bet cards */}
            {[0, 1, 2].map((i) => (
              <FadeInView key={i} delay={160 + i * 80} direction="bottom">
                <SkeletonBetCard />
              </FadeInView>
            ))}
          </>
        ) : !hasBets ? (
          <>
            {/* Welcome Card */}
            <FadeInView delay={80} direction="bottom">
              <View style={styles.profitCard}>
                <Text style={styles.welcomeTitle}>Welcome to Ledgr! 👋</Text>
                <Text style={styles.welcomeSubtitle}>
                  Upload your first betting slip to start tracking your performance.
                </Text>
              </View>
            </FadeInView>

            {/* Chart Placeholder */}
            <FadeInView delay={160} direction="bottom">
              <View style={styles.chartPlaceholder}>
                <Text style={{ fontSize: 32 }}>📈</Text>
                <Text style={styles.chartPlaceholderText}>
                  Your performance curve will appear here
                </Text>
              </View>
            </FadeInView>

            {/* Upload CTA */}
            <FadeInView delay={240} direction="bottom">
              <AnimatedPressable
                style={styles.uploadCtaCard}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/add-bet'); }}
                scaleDown={0.97}
              >
                <View style={styles.uploadCtaIconCircle}>
                  <Ionicons name="add" size={36} color={colors.buttonPrimaryText} />
                </View>
                <Text style={styles.uploadCtaTitle}>Upload Your First Bet</Text>
                <Text style={styles.uploadCtaSubtitle}>
                  Snap a photo of your betting slip or add one manually
                </Text>
              </AnimatedPressable>
            </FadeInView>
          </>
        ) : (
          <>
            {/* Total Profit/Loss Card */}
            <FadeInView delay={80} direction="bottom">
              <View style={styles.profitCard}>
                {(isProfit || isLoss) && (
                  <>
                    <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }, gradientAStyle]}>
                      <LinearGradient
                        colors={isDark
                          ? (isProfit ? [colors.surface, '#0D2B1A'] : [colors.surface, '#2B0D0D'])
                          : (isProfit ? ['transparent', 'rgba(45, 198, 114, 0.28)'] : ['transparent', 'rgba(232, 93, 93, 0.25)'])
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                    <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }, gradientBStyle]}>
                      <LinearGradient
                        colors={isDark
                          ? (isProfit ? [colors.surface, '#0D2B1C'] : [colors.surface, '#2B1010'])
                          : (isProfit ? ['transparent', 'rgba(45, 198, 114, 0.20)'] : ['transparent', 'rgba(232, 93, 93, 0.18)'])
                        }
                        start={{ x: 0.3, y: 0.2 }}
                        end={{ x: 0.7, y: 0.8 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                    {!isDark && (
                      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden', opacity: 0.5 }, gradientAStyle]}>
                        <LinearGradient
                          colors={isProfit ? ['transparent', 'rgba(45, 198, 114, 0.12)'] : ['transparent', 'rgba(232, 93, 93, 0.10)']}
                          start={{ x: 0.5, y: 0.3 }}
                          end={{ x: 0.9, y: 0.9 }}
                          style={StyleSheet.absoluteFill}
                        />
                      </Animated.View>
                    )}
                  </>
                )}
                <Text style={styles.profitLabel}>
                  {cursorPL !== null ? 'P&L AT POINT' : 'TOTAL PROFIT/LOSS'}
                </Text>
                <View style={styles.profitValueRow}>
                  {cursorPL !== null ? (
                    <Text
                      style={[
                        styles.profitValue,
                        { color: displayProfit >= 0 ? colors.accent : '#E85D5D' },
                      ]}
                    >
                      {formatCurrency(displayProfit, currency, showBalance)}
                    </Text>
                  ) : showBalance ? (
                    <AnimatedNumber
                      key={`${selectedPeriod}-${tickerKey}`}
                      value={Math.abs(displayProfit)}
                      prefix={displayProfit >= 0 ? currencySymbol : `-${currencySymbol}`}
                      decimals={0}
                      delay={0}
                      duration={1200}
                      style={{ ...styles.profitValue, color: displayProfit >= 0 ? colors.accent : '#E85D5D' }}
                    />
                  ) : (
                    <Text style={{ ...styles.profitValue, color: displayProfit >= 0 ? colors.accent : '#E85D5D' }}>
                      ••••
                    </Text>
                  )}
                  <View style={styles.percentageContainer}>
                    <Ionicons
                      name={displayProfit >= 0 ? 'trending-up' : 'trending-down'}
                      size={20}
                      color={displayProfit >= 0 ? colors.accent : '#E85D5D'}
                    />
                    {cursorPL !== null ? (
                      <Text
                        style={[
                          styles.percentageText,
                          { color: displayProfit >= 0 ? colors.accent : '#E85D5D' },
                        ]}
                      >
                        {showBalance ? formatROI(roiPct) : '••••'}
                      </Text>
                    ) : showBalance ? (
                      <AnimatedNumber
                        key={`pct-${selectedPeriod}-${tickerKey}`}
                        value={Math.abs(roiPct)}
                        prefix={roiPct >= 0 ? '+' : '-'}
                        suffix="%"
                        decimals={0}
                        delay={0}
                        duration={1200}
                        style={{ ...styles.percentageText, color: displayProfit >= 0 ? colors.accent : '#E85D5D' }}
                      />
                    ) : (
                      <Text style={{ ...styles.percentageText, color: displayProfit >= 0 ? colors.accent : '#E85D5D' }}>
                        ••••
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </FadeInView>

            {/* Time Period Tabs */}
            <FadeInView delay={160} direction="bottom">
              <View style={styles.tabsContainer}>
                {(['Daily', 'Weekly', 'Monthly', 'Lifetime'] as TimePeriod[]).map(
                  (period) => (
                    <AnimatedPressable
                      key={period}
                      style={[
                        styles.tab,
                        selectedPeriod === period && styles.tabActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedPeriod(period);
                        setCursorPL(null);
                      }}
                      scaleDown={0.93}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          selectedPeriod === period && styles.tabTextActive,
                        ]}
                      >
                        {period}
                      </Text>
                    </AnimatedPressable>
                  )
                )}
              </View>
            </FadeInView>

            {/* Performance Curve Card */}
            <FadeInView delay={220} direction="bottom">
              <View style={styles.chartCard}>
                <Text style={styles.chartLabel}>PERFORMANCE CURVE</Text>
                <PerformanceCurve
                  allBets={allBets}
                  period={selectedPeriod}
                  onCursorChange={setCursorPL}
                />
              </View>
            </FadeInView>

            {/* Recent Activity Section */}
            <View style={styles.activitySection}>
              <FadeInView delay={300} direction="none">
                <View style={styles.activityTitleRow}>
                  <Text style={styles.activityTitle}>Recent Activity</Text>
                  <AnimatedPressable
                    style={styles.viewAllButton}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/stats'); }}
                    scaleDown={0.93}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                  </AnimatedPressable>
                </View>
              </FadeInView>

              {recentBets.map((bet, index) => {
                const sc = getStatusConfig(bet.status);
                const roiPctValue = !bet.wager || bet.wager <= 0 ? 0
                  : bet.status === 'lost' ? -100
                  : bet.status === 'void' ? 0
                  : ((bet.potential_payout || 0) - bet.wager) / bet.wager * 100;
                const ts = bet.placed_at
                  ? new Date(bet.placed_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '';
                return (
                  <FadeInView key={bet.id} delay={360 + index * 80} direction="bottom">
                    <AnimatedPressable
                      style={styles.activityCard}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/bet-details/${bet.id}`); }}
                      scaleDown={0.98}
                    >
                      <View style={styles.activityHeader}>
                        <View style={styles.activityHeaderLeft}>
                          <Text style={styles.platformName}>
                            {bet.sportsbook || 'Unknown'}
                          </Text>
                          <View
                            style={[styles.badge, { backgroundColor: sc.statusBg }]}
                          >
                            <Text
                              style={[styles.badgeText, { color: sc.statusColor }]}
                            >
                              {sc.label}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={sc.icon as any}
                          size={24}
                          color={sc.statusColor}
                        />
                      </View>
                      <Text style={styles.betType}>
                        {bet.bet_type
                          ? bet.bet_type === 'over_under'
                            ? 'Over/Under'
                            : bet.bet_type.charAt(0).toUpperCase() +
                              bet.bet_type.slice(1)
                          : ''}
                      </Text>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Text style={styles.statLabel}>WAGER</Text>
                          <Text style={styles.statValue}>
                            {formatCurrency(bet.wager, currency, showBalance)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statLabel}>POTENTIAL</Text>
                          <Text style={styles.statValue}>
                            {formatCurrency(bet.potential_payout || 0, currency, showBalance)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statLabel}>ROI</Text>
                          <Text style={[styles.roiValue, { color: roiPctValue < 0 ? '#E85D5D' : colors.accent }]}>
                            {showBalance ? formatROI(roiPctValue) : '••••'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.activityFooter}>
                        <Text style={styles.timestamp}>{ts}</Text>
                        <Text style={styles.betId}>
                          #{String(bet.id).slice(-4)}
                        </Text>
                      </View>
                    </AnimatedPressable>
                  </FadeInView>
                );
              })}
            </View>
          </>
        )}
      </Animated.ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  headerQuote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  profitCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  profitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  profitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profitValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
  },
  profitValueEmpty: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentageText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  tab: {
    backgroundColor: colors.chipBg,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: colors.chipActiveBg,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.chipActiveText,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    elevation: 3,
    overflow: 'hidden',
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  activitySection: {
    marginBottom: 24,
  },
  activityTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.03)',
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  betType: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  roiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  betId: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  emptyStateCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Empty state (0 bets) ──────────
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  chartPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 40,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  uploadCtaCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  uploadCtaIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadCtaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  uploadCtaSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  });
}
