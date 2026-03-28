import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withRepeat,
  withTiming,
  runOnJS,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatCurrency, formatROI, getCurrencySymbol } from '@/lib/formatters';
import { usePreferences } from '@/context/PreferencesContext';
// AnimatedPressable removed — using TouchableOpacity for touch debugging
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedNumber from '@/components/AnimatedNumber';
import PerformanceCurve, { TimePeriod } from '@/components/PerformanceCurve';
import LiveScoresTicker from '@/components/LiveScoresTicker';
import TickerDetailSheet from '@/components/TickerDetailSheet';
import SkeletonLoader from '@/components/SkeletonLoader';
import SkeletonBetCard from '@/components/SkeletonBetCard';
import { getAvailableReports } from '@/lib/seasonDefinitions';

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [hasUnreadInsights, setHasUnreadInsights] = useState(false);

  // Pattern alert banner state
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const bannerOpacity = useSharedValue(0);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Season report banner state
  const [seasonBanner, setSeasonBanner] = useState<{
    sport: string; label: string; startDate: string; endDate: string;
  } | null>(null);

  // Ticker detail sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetItemType, setSheetItemType] = useState<'espn' | 'kalshi' | null>(null);
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [sheetItemSport, setSheetItemSport] = useState<string>('');

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    const { data: recent, error: recentError } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);
    if (recentError) console.error('[Dashboard] recentBets fetch error:', recentError);
    setRecentBets(recent || []);

    const { data: all, error: allError } = await supabase
      .from('bets')
      .select('id, status, wager, potential_payout, placed_at, created_at')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (allError) console.error('[Dashboard] allBets fetch error:', allError);
    setAllBets(all || []);

    // Check for unread AI insights
    const { count } = await supabase
      .from('ai_insights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setHasUnreadInsights((count ?? 0) > 0);

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      setTickerKey((k) => k + 1);

      // Check for recent pattern alerts
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('recent_alerts');
          if (!raw) return;
          const alerts = JSON.parse(raw);
          const now = Date.now();
          const recentAlert = alerts.find((a: any) => {
            if (!a.timestamp) return false;
            return now - new Date(a.timestamp).getTime() < 60000;
          });
          if (!recentAlert) return;

          const lastShown = await AsyncStorage.getItem('last_shown_alert_timestamp');
          if (lastShown === recentAlert.timestamp) return;

          await AsyncStorage.setItem('last_shown_alert_timestamp', recentAlert.timestamp);
          setBannerMessage(recentAlert.message);
          setBannerVisible(true);
          bannerOpacity.value = withTiming(1, { duration: 300 });

          bannerTimeoutRef.current = setTimeout(() => {
            bannerOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
              if (finished) runOnJS(dismissBanner)();
            });
          }, 5000);
        } catch {}
      })();

      // Check for season report banners
      if (user) {
        (async () => {
          try {
            const reports = await getAvailableReports(user.id);
            for (const report of reports) {
              const key = `season_report_viewed_${report.sport}_${report.label}`;
              const viewed = await AsyncStorage.getItem(key);
              if (!viewed) {
                setSeasonBanner(report);
                return;
              }
            }
            setSeasonBanner(null);
          } catch {
            setSeasonBanner(null);
          }
        })();
      }

      return () => {
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      };
    }, [fetchDashboardData, user])
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

  // ── Pattern Alert Banner ──
  const dismissBanner = useCallback(() => {
    setBannerVisible(false);
  }, []);

  const bannerAnimStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView
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
      >
        {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Welcome Back, {displayName}</Text>
            <Text style={styles.headerQuote}>"Don't just play the books, keep your own."</Text>
          </View>

        {/* Pattern Alert Banner */}
        {bannerVisible && (
          <Animated.View style={bannerAnimStyle}>
            <TouchableOpacity
              style={{
                flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
                backgroundColor: colors.surface, borderRadius: 12, padding: 14,
                marginBottom: 20, borderLeftWidth: 3, borderLeftColor: colors.accent,
              }}
              onPress={() => {
                if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
                bannerOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
                  if (finished) runOnJS(dismissBanner)();
                });
                router.push('/insights');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={18} color={colors.accent} />
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 }} numberOfLines={2}>{bannerMessage}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.accent }}>View →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Season Report Banner */}
        {seasonBanner && (
          <TouchableOpacity
            style={styles.seasonBanner}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const key = `season_report_viewed_${seasonBanner.sport}_${seasonBanner.label}`;
              await AsyncStorage.setItem(key, 'true');
              router.push({
                pathname: '/season-report',
                params: {
                  sport: seasonBanner.sport,
                  seasonLabel: seasonBanner.label,
                  startDate: seasonBanner.startDate,
                  endDate: seasonBanner.endDate,
                },
              });
              setSeasonBanner(null);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy" size={18} color={colors.accent} />
            <Text style={styles.seasonBannerText}>
              Your {seasonBanner.sport} Season Report is ready
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.accent }}>{'\u2192'}</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <>
            {/* Skeleton profit card */}
              <View style={styles.profitCard}>
                <SkeletonLoader width={140} height={12} borderRadius={6} />
                <View style={{ marginTop: 12 }}>
                  <SkeletonLoader width={180} height={36} borderRadius={8} />
                </View>
              </View>
            {/* Skeleton bet cards */}
            {[0, 1, 2].map((i) => (
                <SkeletonBetCard key={i} />
            ))}
          </>
        ) : !hasBets ? (
          <>
            {/* Welcome Card */}
              <View style={styles.profitCard}>
                <Text style={styles.welcomeTitle}>Welcome to Ledgr! 👋</Text>
                <Text style={styles.welcomeSubtitle}>
                  Upload your first betting slip to start tracking your performance.
                </Text>
              </View>

            {/* Chart Placeholder */}
              <View style={styles.chartPlaceholder}>
                <Text style={{ fontSize: 32 }}>📈</Text>
                <Text style={styles.chartPlaceholderText}>
                  Your performance curve will appear here
                </Text>
              </View>

            {/* Upload CTA */}
              <TouchableOpacity
                style={styles.uploadCtaCard}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/add-bet'); }}
                activeOpacity={0.7}
              >
                <View style={styles.uploadCtaIconCircle}>
                  <Ionicons name="add" size={36} color={colors.buttonPrimaryText} />
                </View>
                <Text style={styles.uploadCtaTitle}>Upload Your First Bet</Text>
                <Text style={styles.uploadCtaSubtitle}>
                  Snap a photo of your betting slip or add one manually
                </Text>
              </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Total Profit/Loss Card */}
              <View style={styles.profitCard}>
                {(isProfit || isLoss) && (
                  <>
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }, gradientAStyle]}>
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
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }, gradientBStyle]}>
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
                      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden', opacity: 0.5 }, gradientAStyle]}>
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
                        { color: displayProfit >= 0 ? colors.accent : colors.loss },
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
                      style={{ ...styles.profitValue, color: displayProfit >= 0 ? colors.accent : colors.loss }}
                    />
                  ) : (
                    <Text style={{ ...styles.profitValue, color: displayProfit >= 0 ? colors.accent : colors.loss }}>
                      ••••
                    </Text>
                  )}
                  <View style={styles.percentageContainer}>
                    <Ionicons
                      name={displayProfit >= 0 ? 'trending-up' : 'trending-down'}
                      size={20}
                      color={displayProfit >= 0 ? colors.accent : colors.loss}
                    />
                    {cursorPL !== null ? (
                      <Text
                        style={[
                          styles.percentageText,
                          { color: displayProfit >= 0 ? colors.accent : colors.loss },
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
                        style={{ ...styles.percentageText, color: displayProfit >= 0 ? colors.accent : colors.loss }}
                      />
                    ) : (
                      <Text style={{ ...styles.percentageText, color: displayProfit >= 0 ? colors.accent : colors.loss }}>
                        ••••
                      </Text>
                    )}
                  </View>
                </View>
              </View>

            {/* Live Sports Ticker */}
              <LiveScoresTicker
                onGamePress={(id, sport) => {
                  setSheetItemType('espn');
                  setSheetItemId(id);
                  setSheetItemSport(sport);
                  setSheetVisible(true);
                }}
              />

            {/* Performance Curve Card */}
              <View style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                  <Text style={styles.chartLabel}>PERFORMANCE CURVE</Text>
                  <TouchableOpacity
                    style={styles.filterPill}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFilterOpen((v) => !v);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.filterPillText}>{selectedPeriod}</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter dropdown */}
                {filterOpen && (
                  <>
                    <TouchableOpacity
                      activeOpacity={1}
                      style={StyleSheet.absoluteFill}
                      onPress={() => setFilterOpen(false)}
                    />
                    <Animated.View
                      style={[
                        styles.filterDropdown,
                        {
                          shadowOpacity: isDark ? 0.3 : 0.1,
                        },
                      ]}
                    >
                      {(['Daily', 'Weekly', 'Monthly', 'Lifetime'] as TimePeriod[]).map(
                        (period) => {
                          const isActive = selectedPeriod === period;
                          return (
                            <TouchableOpacity
                              key={period}
                              style={[
                                styles.filterDropdownItem,
                                isActive && styles.filterDropdownItemActive,
                              ]}
                              onPress={() => {
                                Haptics.selectionAsync();
                                setSelectedPeriod(period);
                                setCursorPL(null);
                                setFilterOpen(false);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.filterDropdownText,
                                  isActive && styles.filterDropdownTextActive,
                                ]}
                              >
                                {period}
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                      )}
                    </Animated.View>
                  </>
                )}

                <PerformanceCurve
                  allBets={allBets}
                  period={selectedPeriod}
                  onCursorChange={setCursorPL}
                />
              </View>

            {/* Unread AI Insights Banner */}
            {hasUnreadInsights && (
              <TouchableOpacity
                style={styles.insightBanner}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/ai-coach'); }}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={18} color={colors.accent} />
                <Text style={styles.insightBannerText}>New AI insights available</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
              </TouchableOpacity>
            )}

            {/* Recent Activity Section */}
            <View style={styles.activitySection}>
                <View style={styles.activityTitleRow}>
                  <Text style={styles.activityTitle}>Recent Activity</Text>
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/stats'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                  </TouchableOpacity>
                </View>

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
                    <TouchableOpacity
                      key={bet.id}
                      style={styles.activityCard}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/bet-details/${bet.id}`); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activityHeader}>
                        <View style={styles.activityHeaderLeft}>
                          <Text style={styles.platformName} numberOfLines={1}>
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
                      <Text style={styles.betType} numberOfLines={1}>
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
                          <Text style={[styles.roiValue, { color: roiPctValue < 0 ? colors.loss : colors.accent }]}>
                            {showBalance ? formatROI(roiPctValue) : '••••'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.activityFooter}>
                        <Text style={styles.timestamp} numberOfLines={1}>{ts}</Text>
                        <Text style={styles.betId}>
                          #{String(bet.id).slice(-4)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative' as const,
    zIndex: 10,
  },
  chartHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  filterPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: `${colors.border}4D`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterDropdown: {
    position: 'absolute' as const,
    top: 48,
    right: 20,
    width: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 4,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  filterDropdownItem: {
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
  },
  filterDropdownItemActive: {
    backgroundColor: 'rgba(45, 198, 114, 0.12)',
  },
  filterDropdownText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  filterDropdownTextActive: {
    color: colors.accent,
    fontWeight: '600',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
  insightBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  insightBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  seasonBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  seasonBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text,
  },
  });
}
