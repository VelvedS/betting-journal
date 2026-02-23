import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';
import AnimatedNumber from '@/components/AnimatedNumber';
import PerformanceCurve, { TimePeriod } from '@/components/PerformanceCurve';

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'won': return { label: 'WIN', statusColor: '#2DC672', statusBg: '#E8F8F0', icon: 'checkmark-circle' };
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
    case 'Yearly':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
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
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Weekly');
  const [recentBets, setRecentBets] = useState<any[]>([]);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [cursorPL, setCursorPL] = useState<number | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    const { data: recent } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .limit(5);
    setRecentBets(recent || []);

    const { data: all, error: allError } = await supabase
      .from('bets')
      .select('id, status, wager, potential_payout, placed_at, created_at')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: true });
    if (allError) console.error('[Dashboard] allBets fetch error:', allError);
    setAllBets(all || []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

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

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Welcome Back, {displayName}</Text>
            <Text style={styles.headerQuote}>"Don't just play the books, keep your own."</Text>
          </View>
        </FadeInView>

        {/* Total Profit/Loss Card */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.profitCard}>
            <Text style={styles.profitLabel}>
              {cursorPL !== null ? 'P&L AT POINT' : 'TOTAL PROFIT/LOSS'}
            </Text>
            <View style={styles.profitValueRow}>
              {hasBets ? (
                <>
                  {cursorPL !== null ? (
                    // Plain text during cursor drag — no count-up flash
                    <Text
                      style={[
                        styles.profitValue,
                        { color: displayProfit >= 0 ? '#2DC672' : '#E85D5D' },
                      ]}
                    >
                      {displayProfit >= 0
                        ? `$${Math.abs(displayProfit).toFixed(2)}`
                        : `-$${Math.abs(displayProfit).toFixed(2)}`}
                    </Text>
                  ) : (
                    // Animated count-up for period total
                    <AnimatedNumber
                      key={selectedPeriod}
                      value={Math.abs(displayProfit)}
                      prefix={displayProfit >= 0 ? '$' : '-$'}
                      decimals={2}
                      delay={0}
                      style={{ ...styles.profitValue, color: displayProfit >= 0 ? '#2DC672' : '#E85D5D' }}
                    />
                  )}
                  <View style={styles.percentageContainer}>
                    <Ionicons
                      name={displayProfit >= 0 ? 'trending-up' : 'trending-down'}
                      size={20}
                      color={displayProfit >= 0 ? '#2DC672' : '#E85D5D'}
                    />
                    {cursorPL !== null ? (
                      <Text
                        style={[
                          styles.percentageText,
                          { color: displayProfit >= 0 ? '#2DC672' : '#E85D5D' },
                        ]}
                      >
                        {roiPct >= 0 ? '+' : '-'}
                        {Math.abs(roiPct).toFixed(1)}%
                      </Text>
                    ) : (
                      <AnimatedNumber
                        key={`pct-${selectedPeriod}`}
                        value={Math.abs(roiPct)}
                        prefix={roiPct >= 0 ? '+' : '-'}
                        suffix="%"
                        decimals={1}
                        delay={0}
                        style={{ ...styles.percentageText, color: displayProfit >= 0 ? '#2DC672' : '#E85D5D' }}
                      />
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.profitValueEmpty}>$0</Text>
              )}
            </View>
          </View>
        </FadeInView>

        {/* Time Period Tabs */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.tabsContainer}>
            {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as TimePeriod[]).map(
              (period) => (
                <AnimatedPressable
                  key={period}
                  style={[
                    styles.tab,
                    selectedPeriod === period && styles.tabActive,
                  ]}
                  onPress={() => {
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
              {hasBets && (
                <AnimatedPressable
                  style={styles.viewAllButton}
                  onPress={() => router.push('/(tabs)/stats')}
                  scaleDown={0.93}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                  <Ionicons name="arrow-forward" size={16} color="#6366F1" />
                </AnimatedPressable>
              )}
            </View>
          </FadeInView>

          {hasBets ? (
            recentBets.map((bet, index) => {
              const sc = getStatusConfig(bet.status);
              const roiPctValue =
                bet.wager > 0
                  ? ((bet.potential_payout || 0) - bet.wager) / bet.wager * 100
                  : 0;
              const ts = bet.placed_at
                ? new Date(bet.placed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '';
              return (
                <FadeInView key={bet.id} delay={360 + index * 80} direction="bottom">
                  <AnimatedPressable
                    style={styles.activityCard}
                    onPress={() => router.push(`/bet-details/${bet.id}`)}
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
                          {formatCurrency(bet.wager)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>POTENTIAL</Text>
                        <Text style={styles.statValue}>
                          {formatCurrency(bet.potential_payout || 0)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>ROI</Text>
                        <Text style={styles.roiValue}>
                          {formatPercent(roiPctValue, true)}
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
            })
          ) : (
            <FadeInView delay={360} direction="bottom">
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={36} color="#6366F1" />
                </View>
                <Text style={styles.emptyTitle}>No bets yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start tracking your bets to see your performance
                </Text>
                <AnimatedPressable
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)/add-bet')}
                  scaleDown={0.97}
                >
                  <Text style={styles.emptyButtonText}>Add Your First Bet</Text>
                </AnimatedPressable>
              </View>
            </FadeInView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerQuote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#6B6B6B',
  },
  profitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  profitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
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
    color: '#10B981',
  },
  profitValueEmpty: {
    fontSize: 36,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  tab: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#6B6B6B',
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
    color: '#1A1A1A',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#1A1A1A',
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
    color: '#6B6B6B',
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
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  roiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  betId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
