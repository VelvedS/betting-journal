import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import TabScreenTransition from '@/components/TabScreenTransition';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency, formatROI, formatWholeNumber } from '@/lib/formatters';
import { usePreferences } from '@/context/PreferencesContext';
import AnimatedPressable from '@/components/AnimatedPressable';
import * as Haptics from 'expo-haptics';
import FadeInView from '@/components/FadeInView';
import CalendarHeatMap from '@/components/CalendarHeatMap';

type FilterType = 'All' | 'Wins' | 'Losses' | 'Pending';

const REASONING_TAGS: { label: string; value: string; icon: string }[] = [
  { label: 'Stats', value: 'stats', icon: 'analytics-outline' },
  { label: 'Value', value: 'value', icon: 'diamond-outline' },
  { label: 'Gut Feel', value: 'gut_feel', icon: 'flash-outline' },
  { label: 'Revenge', value: 'revenge', icon: 'flame-outline' },
  { label: 'Fade', value: 'fade', icon: 'arrow-down-outline' },
  { label: 'Tail', value: 'tail', icon: 'people-outline' },
  { label: 'System', value: 'system', icon: 'code-slash-outline' },
  { label: 'Hedge', value: 'hedge', icon: 'shield-outline' },
];

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'won': return { label: 'WIN', statusColor: '#2DC672', statusBg: 'rgba(45, 198, 114, 0.12)', icon: 'checkmark-circle' };
    case 'lost': return { label: 'LOSS', statusColor: '#E85D5D', statusBg: '#FFECEC', icon: 'close-circle' };
    case 'pending': return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
    case 'void': return { label: 'VOID', statusColor: '#999999', statusBg: '#F0F0F0', icon: 'ban' };
    default: return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
  }
};

export default function StatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currency, showBalance } = usePreferences();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [allBets, setAllBets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBets = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) console.error('[Stats] fetch error:', error);
    setAllBets(data || []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchBets();
    }, [fetchBets])
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchBets();
    setRefreshing(false);
  }, [fetchBets]);

  const hasBets = allBets.length > 0;

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectedFilter]);

  // Counts for filter tabs (always based on all bets)
  const totalWins = allBets.filter(bet => bet.status === 'won').length;
  const totalLosses = allBets.filter(bet => bet.status === 'lost').length;
  const totalPending = allBets.filter(bet => bet.status === 'pending').length;
  const totalAllBets = allBets.length;

  // Filter bets based on selected filter
  const filteredBets = selectedFilter === 'All'
    ? allBets
    : allBets.filter(bet => {
        if (selectedFilter === 'Wins') return bet.status === 'won';
        if (selectedFilter === 'Losses') return bet.status === 'lost';
        if (selectedFilter === 'Pending') return bet.status === 'pending';
        return true;
      });

  // Calculate stats based on filtered bets
  const filteredCount = filteredBets.length;
  const wins = filteredBets.filter(bet => bet.status === 'won').length;
  const losses = filteredBets.filter(bet => bet.status === 'lost').length;

  const totalWagered = filteredBets.reduce((sum, bet) => sum + (bet.wager || 0), 0);
  const totalWon = filteredBets
    .filter(bet => bet.status === 'won')
    .reduce((sum, bet) => sum + ((bet.potential_payout || 0) - (bet.wager || 0)), 0);
  const totalLost = filteredBets
    .filter(bet => bet.status === 'lost')
    .reduce((sum, bet) => sum + (bet.wager || 0), 0);
  const netPL = totalWon - totalLost;

  // Win rate: exclude pending/void from denominator
  const settledBets = wins + losses;
  const winRateValue = settledBets > 0 ? (wins / settledBets) * 100 : 0;

  const roiValue = totalWagered > 0 ? (netPL / totalWagered) * 100 : 0;

  const getValueColor = (value: number) => {
    if (value > 0) return colors.accent;
    if (value < 0) return '#EF4444';
    return colors.text;
  };

  // Helper function to get responsive font size based on string length
  const getResponsiveFontSize = (text: string) => {
    if (text.length > 8) return 14;
    if (text.length > 6) return 16;
    return 20;
  };

  // Pre-calculate formatted values
  const winsStr = formatWholeNumber(wins);
  const lossesStr = formatWholeNumber(losses);
  const formattedNetPL = formatCurrency(netPL, currency, showBalance);
  const netPLStr = showBalance && netPL > 0 ? `+${formattedNetPL}` : formattedNetPL;
  const wageredStr = formatCurrency(totalWagered, currency, showBalance);
  const winRateStr = Math.round(winRateValue) + '%';
  const roiStr = formatROI(roiValue);

  const subtitleText = filteredCount === 1 ? '1 Total Bet' : `${filteredCount} Total Bets`;

  // ── Confidence breakdown ──
  const confidenceBreakdown = useMemo(() => {
    const settled = allBets.filter(
      (b) => (b.status === 'won' || b.status === 'lost') && b.confidence_level != null
    );
    const groups: Record<number, { wins: number; losses: number; wagered: number; profit: number }> = {};
    settled.forEach((bet) => {
      const level = bet.confidence_level as number;
      if (!groups[level]) groups[level] = { wins: 0, losses: 0, wagered: 0, profit: 0 };
      const g = groups[level];
      g.wagered += bet.wager || 0;
      if (bet.status === 'won') {
        g.wins++;
        g.profit += (bet.potential_payout || 0) - (bet.wager || 0);
      } else {
        g.losses++;
        g.profit -= bet.wager || 0;
      }
    });
    return Object.entries(groups)
      .map(([level, data]) => ({
        level: parseInt(level),
        ...data,
        roi: data.wagered > 0 ? (data.profit / data.wagered) * 100 : 0,
      }))
      .sort((a, b) => a.level - b.level);
  }, [allBets]);

  // ── Reasoning breakdown ──
  const reasoningBreakdown = useMemo(() => {
    const settled = allBets.filter(
      (b) => (b.status === 'won' || b.status === 'lost') && b.reasoning_tag != null
    );
    const groups: Record<string, { wins: number; losses: number; wagered: number; profit: number }> = {};
    settled.forEach((bet) => {
      const tag = bet.reasoning_tag as string;
      if (!groups[tag]) groups[tag] = { wins: 0, losses: 0, wagered: 0, profit: 0 };
      const g = groups[tag];
      g.wagered += bet.wager || 0;
      if (bet.status === 'won') {
        g.wins++;
        g.profit += (bet.potential_payout || 0) - (bet.wager || 0);
      } else {
        g.losses++;
        g.profit -= bet.wager || 0;
      }
    });
    return Object.entries(groups)
      .map(([tag, data]) => ({
        tag,
        ...data,
        roi: data.wagered > 0 ? (data.profit / data.wagered) * 100 : 0,
        label: REASONING_TAGS.find((t) => t.value === tag)?.label || tag,
        icon: REASONING_TAGS.find((t) => t.value === tag)?.icon || 'help-outline',
      }))
      .sort((a, b) => b.roi - a.roi);
  }, [allBets]);

  const renderStars = (count: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < count ? 'star' : 'star-outline'}
        size={14}
        color={i < count ? colors.star : colors.textTertiary}
        style={{ marginRight: 1 }}
      />
    ));
  };

  return (
    <TabScreenTransition>
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
        scrollEventThrottle={16}
      >
        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Betting Statistics</Text>
              <Text style={styles.subtitle}>{subtitleText}</Text>
            </View>
            <AnimatedPressable style={styles.filterIconButton} scaleDown={0.9}>
              <Ionicons name="funnel-outline" size={22} color={colors.text} />
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* Summary Cards - Row 1 */}
        <Animated.View style={[styles.summaryRow, { opacity: fadeAnim }]}>
          <FadeInView delay={0} direction="bottom" style={styles.summaryCardFlex}>
            <View style={styles.summaryCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="trending-up" size={20} color={colors.accent} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>WINS</Text>
              <Text
                style={[styles.summaryValue, { fontSize: getResponsiveFontSize(winsStr) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {winsStr}
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={30} direction="bottom" style={styles.summaryCardFlex}>
            <View style={styles.summaryCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="trending-down" size={20} color="#EF4444" />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>LOSSES</Text>
              <Text
                style={[styles.summaryValue, { fontSize: getResponsiveFontSize(lossesStr) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {lossesStr}
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={60} direction="bottom" style={styles.summaryCardFlex}>
            <View style={styles.summaryCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="document-text-outline" size={20} color={getValueColor(netPL)} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>NET P/L</Text>
              <Text
                style={[styles.summaryValue, { color: getValueColor(netPL), fontSize: getResponsiveFontSize(netPLStr) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {netPLStr}
              </Text>
            </View>
          </FadeInView>
        </Animated.View>

        {/* Summary Cards - Row 2 */}
        <Animated.View style={[styles.summaryRow, { opacity: fadeAnim }]}>
          <FadeInView delay={60} direction="bottom" style={styles.summaryCardFlex}>
            <View style={styles.summaryCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="cash-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>WAGERED</Text>
              <Text
                style={[styles.summaryValue, { fontSize: getResponsiveFontSize(wageredStr) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {wageredStr}
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={80} direction="bottom" style={styles.summaryCardFlex}>
            <View style={styles.summaryCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>WIN RATE</Text>
              <Text
                style={[styles.summaryValue, { fontSize: getResponsiveFontSize(winRateStr) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {winRateStr}
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={100} direction="bottom" style={styles.summaryCardFlex}>
            <View style={styles.summaryCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="bar-chart-outline" size={20} color={showBalance ? getValueColor(roiValue) : colors.textSecondary} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>ROI</Text>
              <Text
                style={[styles.summaryValue, { color: showBalance ? getValueColor(roiValue) : colors.textSecondary, fontSize: getResponsiveFontSize(showBalance ? roiStr : '••••') }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {showBalance ? roiStr : '••••'}
              </Text>
            </View>
          </FadeInView>
        </Animated.View>

        {/* What-If Button */}
        <FadeInView delay={120} direction="bottom">
          <TouchableOpacity
            style={styles.whatIfLink}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/what-if'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="git-branch-outline" size={16} color={colors.accent} />
            <Text style={styles.whatIfLinkText}>What If?</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        </FadeInView>

        {/* Filter Tabs */}
        <FadeInView delay={440} direction="none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsContainer}
          >
            {(['All', 'Wins', 'Losses', 'Pending'] as FilterType[]).map((filter) => {
              const count = filter === 'All' ? totalAllBets
                : filter === 'Wins' ? totalWins
                : filter === 'Losses' ? totalLosses
                : totalPending;
              return (
                <AnimatedPressable
                  key={filter}
                  style={[
                    styles.filterTab,
                    selectedFilter === filter && styles.filterTabActive,
                  ]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedFilter(filter); }}
                  scaleDown={0.93}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      selectedFilter === filter && styles.filterTabTextActive,
                    ]}
                  >
                    {filter} {count}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </FadeInView>

        {/* ── Daily Activity Heat Map ── */}
        <FadeInView delay={450} direction="bottom">
          <CalendarHeatMap bets={allBets} />
        </FadeInView>

        {/* ── By Confidence ── */}
        <FadeInView delay={460} direction="bottom">
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <Ionicons name="star" size={18} color={colors.star} />
              <Text style={styles.breakdownTitle}>By Confidence</Text>
            </View>
            {confidenceBreakdown.length > 0 ? (
              confidenceBreakdown.map((row) => (
                <View key={row.level} style={styles.breakdownRow}>
                  <View style={styles.breakdownRowLeft}>
                    <View style={styles.starsRow}>{renderStars(row.level)}</View>
                  </View>
                  <Text style={styles.breakdownRecord}>{row.wins}-{row.losses}</Text>
                  <Text
                    style={[
                      styles.breakdownRoi,
                      { color: showBalance ? getValueColor(row.roi) : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {showBalance ? formatROI(row.roi) : '••••'}
                  </Text>
                  <Text
                    style={[
                      styles.breakdownPl,
                      { color: showBalance ? getValueColor(row.profit) : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {showBalance && row.profit > 0 ? '+' : ''}{formatCurrency(row.profit, currency, showBalance)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.breakdownEmpty}>
                Tag your confidence on new bets to see patterns here
              </Text>
            )}
          </View>
        </FadeInView>

        {/* ── By Reasoning ── */}
        <FadeInView delay={520} direction="bottom">
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <Ionicons name="bulb-outline" size={18} color={colors.accent} />
              <Text style={styles.breakdownTitle}>By Reasoning</Text>
            </View>
            {reasoningBreakdown.length > 0 ? (
              reasoningBreakdown.map((row) => (
                <View key={row.tag} style={styles.breakdownRow}>
                  <View style={styles.breakdownRowLeft}>
                    <Ionicons name={row.icon as any} size={16} color={colors.textSecondary} />
                    <Text style={styles.breakdownTagLabel}>{row.label}</Text>
                  </View>
                  <Text style={styles.breakdownRecord}>{row.wins}-{row.losses}</Text>
                  <Text
                    style={[
                      styles.breakdownRoi,
                      { color: showBalance ? getValueColor(row.roi) : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {showBalance ? formatROI(row.roi) : '••••'}
                  </Text>
                  <Text
                    style={[
                      styles.breakdownPl,
                      { color: showBalance ? getValueColor(row.profit) : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {showBalance && row.profit > 0 ? '+' : ''}{formatCurrency(row.profit, currency, showBalance)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.breakdownEmpty}>
                Tag your reasoning on new bets to unlock insights
              </Text>
            )}
          </View>
        </FadeInView>

        {/* AI Coach Link */}
        <FadeInView delay={540} direction="bottom">
          <TouchableOpacity
            style={styles.aiCoachLink}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/ai-coach'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={16} color={colors.accent} />
            <Text style={styles.aiCoachLinkText}>Get AI Insights</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        </FadeInView>

        {/* Bet Cards List */}
        <View style={styles.betsList}>
          {hasBets ? (
            filteredBets.map((bet, index) => {
              const sc = getStatusConfig(bet.status);
              const roiPctValue = !bet.wager || bet.wager <= 0 ? 0
                : bet.status === 'lost' ? -100
                : bet.status === 'void' ? 0
                : ((bet.potential_payout || 0) - bet.wager) / bet.wager * 100;
              const dateStr = bet.placed_at ? new Date(bet.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
              return (
              <FadeInView key={bet.id} delay={500 + index * 60} direction="bottom">
                <AnimatedPressable
                  style={styles.betCard}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/bet-details/${bet.id}`); }}
                  scaleDown={0.98}
                >
                  <View style={styles.betHeader}>
                    <View style={styles.betHeaderLeft}>
                      <Text style={styles.platformName} numberOfLines={1}>{bet.sportsbook || 'Unknown'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc.statusBg }]}>
                        <Text style={[styles.statusBadgeText, { color: sc.statusColor }]}>
                          {sc.label}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name={sc.icon as any} size={24} color={sc.statusColor} />
                  </View>
                  <Text style={styles.betType} numberOfLines={1}>{bet.bet_type ? (bet.bet_type === 'over_under' ? 'Over/Under' : bet.bet_type.charAt(0).toUpperCase() + bet.bet_type.slice(1)) : ''}</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statColumn}>
                      <Text style={styles.statLabel}>WAGER</Text>
                      <Text style={styles.statValue}>{formatCurrency(bet.wager, currency, showBalance)}</Text>
                    </View>
                    <View style={styles.statColumn}>
                      <Text style={styles.statLabel}>POTENTIAL</Text>
                      <Text style={styles.statValue}>{formatCurrency(bet.potential_payout || 0, currency, showBalance)}</Text>
                    </View>
                    <View style={styles.statColumn}>
                      <Text style={styles.statLabel}>ROI</Text>
                      <Text
                        style={[styles.roiValue, { color: showBalance ? (roiPctValue < 0 ? colors.loss : colors.accent) : colors.textSecondary }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >{showBalance ? formatROI(roiPctValue) : '••••'}</Text>
                    </View>
                  </View>
                  <View style={styles.betFooter}>
                    <Text style={styles.betDate} numberOfLines={1}>{dateStr}</Text>
                    <Text style={styles.betId}>#{String(bet.id).slice(-4)}</Text>
                  </View>
                </AnimatedPressable>
              </FadeInView>
              );
            })
          ) : (
            <FadeInView delay={500} direction="bottom">
              <View style={styles.emptyStateCard}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>📊</Text>
                <Text style={styles.emptyTitle}>No stats yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your betting analytics will appear here after your first bet
                </Text>
                <AnimatedPressable
                  style={styles.emptyAddButton}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/add-bet'); }}
                  scaleDown={0.97}
                >
                  <Text style={styles.emptyAddButtonText}>Add a Bet</Text>
                </AnimatedPressable>
              </View>
            </FadeInView>
          )}
        </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCardFlex: {
    flex: 1,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden' as any,
  },
  iconContainer: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    marginTop: 12,
  },
  filterTab: {
    backgroundColor: colors.chipBg,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: colors.chipActiveBg,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.chipActiveText,
  },
  betsList: {
    gap: 12,
  },
  betCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  betHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  betHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  statColumn: {
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
  betFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betDate: {
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
    marginBottom: 20,
  },
  emptyAddButton: {
    backgroundColor: colors.chipActiveBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyAddButtonText: {
    color: colors.chipActiveText,
    fontSize: 16,
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  breakdownHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
  },
  breakdownRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  breakdownTagLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.text,
  },
  breakdownRecord: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    width: 44,
    textAlign: 'center' as const,
  },
  breakdownRoi: {
    fontSize: 13,
    fontWeight: '700' as const,
    width: 56,
    textAlign: 'right' as const,
  },
  breakdownPl: {
    fontSize: 13,
    fontWeight: '600' as const,
    width: 72,
    textAlign: 'right' as const,
  },
  breakdownEmpty: {
    fontSize: 13,
    color: colors.textTertiary,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  aiCoachLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    marginBottom: 20,
  },
  aiCoachLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.accent,
  },
  whatIfLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    marginBottom: 4,
  },
  whatIfLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.accent,
  },
  });
}
