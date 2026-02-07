import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency, formatPL, formatPercent, formatWholeNumber } from '@/lib/formatters';

type FilterType = 'All' | 'Wins' | 'Losses' | 'Pending';

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'won': return { label: 'WIN', statusColor: '#2DC672', statusBg: '#E8F8F0', icon: 'checkmark-circle' };
    case 'lost': return { label: 'LOSS', statusColor: '#E85D5D', statusBg: '#FFECEC', icon: 'close-circle' };
    case 'pending': return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
    case 'void': return { label: 'VOID', statusColor: '#999999', statusBg: '#F0F0F0', icon: 'ban' };
    default: return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
  }
};

export default function StatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [allBets, setAllBets] = useState<any[]>([]);

  const fetchBets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false });
    setAllBets(data || []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchBets();
    }, [fetchBets])
  );

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
    if (value > 0) return '#10B981';
    if (value < 0) return '#EF4444';
    return '#1A1A1A';
  };

  // Helper function to get responsive font size based on string length
  const getResponsiveFontSize = (text: string) => {
    if (text.length > 8) return 14;
    if (text.length > 6) return 16;
    return 20;
  };

  const subtitleText = filteredCount === 1 ? '1 Total Bet' : `${filteredCount} Total Bets`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Betting Statistics</Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
          </View>
          <TouchableOpacity style={styles.filterIconButton}>
            <Ionicons name="funnel-outline" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Summary Cards - Row 1 */}
        <Animated.View style={[styles.summaryRow, { opacity: fadeAnim }]}>
          <View style={[styles.summaryCard, { overflow: 'hidden' }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="trending-up" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>WINS</Text>
            <Text
              style={[styles.summaryValue, { fontSize: getResponsiveFontSize(formatWholeNumber(wins)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatWholeNumber(wins)}
            </Text>
          </View>

          <View style={[styles.summaryCard, { overflow: 'hidden' }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="trending-down" size={20} color="#EF4444" />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>LOSSES</Text>
            <Text
              style={[styles.summaryValue, { fontSize: getResponsiveFontSize(formatWholeNumber(losses)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatWholeNumber(losses)}
            </Text>
          </View>

          <View style={[styles.summaryCard, { overflow: 'hidden' }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text-outline" size={20} color={getValueColor(netPL)} />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>NET P/L</Text>
            <Text
              style={[styles.summaryValue, { color: getValueColor(netPL), fontSize: getResponsiveFontSize(formatPL(netPL)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatPL(netPL)}
            </Text>
          </View>
        </Animated.View>

        {/* Summary Cards - Row 2 */}
        <Animated.View style={[styles.summaryRow, { opacity: fadeAnim }]}>
          <View style={[styles.summaryCard, { overflow: 'hidden' }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="cash-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>WAGERED</Text>
            <Text
              style={[styles.summaryValue, { fontSize: getResponsiveFontSize(formatCurrency(totalWagered)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(totalWagered)}
            </Text>
          </View>

          <View style={[styles.summaryCard, { overflow: 'hidden' }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>WIN RATE</Text>
            <Text
              style={[styles.summaryValue, { fontSize: getResponsiveFontSize(formatPercent(winRateValue)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatPercent(winRateValue)}
            </Text>
          </View>

          <View style={[styles.summaryCard, { overflow: 'hidden' }]}>
            <View style={styles.iconContainer}>
              <Ionicons name="bar-chart-outline" size={20} color={getValueColor(roiValue)} />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>ROI</Text>
            <Text
              style={[styles.summaryValue, { color: getValueColor(roiValue), fontSize: getResponsiveFontSize(formatPercent(roiValue, true)) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatPercent(roiValue, true)}
            </Text>
          </View>
        </Animated.View>

        {/* Filter Tabs */}
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
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  selectedFilter === filter && styles.filterTabActive,
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selectedFilter === filter && styles.filterTabTextActive,
                  ]}
                >
                  {filter} {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bet Cards List */}
        <View style={styles.betsList}>
          {hasBets ? (
            filteredBets.map((bet) => {
              const sc = getStatusConfig(bet.status);
              const roiPctValue = bet.wager > 0 ? ((bet.potential_payout || 0) - bet.wager) / bet.wager * 100 : 0;
              const dateStr = bet.placed_at ? new Date(bet.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
              return (
              <TouchableOpacity
                key={bet.id}
                style={styles.betCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/bet-details/${bet.id}`)}
              >
                <View style={styles.betHeader}>
                  <View style={styles.betHeaderLeft}>
                    <Text style={styles.platformName}>{bet.sportsbook || 'Unknown'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.statusBg }]}>
                      <Text style={[styles.statusBadgeText, { color: sc.statusColor }]}>
                        {sc.label}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={sc.icon as any} size={24} color={sc.statusColor} />
                </View>
                <Text style={styles.betType}>{bet.bet_type ? (bet.bet_type === 'over_under' ? 'Over/Under' : bet.bet_type.charAt(0).toUpperCase() + bet.bet_type.slice(1)) : ''}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>WAGER</Text>
                    <Text style={styles.statValue}>{formatCurrency(bet.wager)}</Text>
                  </View>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>POTENTIAL</Text>
                    <Text style={styles.statValue}>{formatCurrency(bet.potential_payout || 0)}</Text>
                  </View>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>ROI</Text>
                    <Text style={styles.roiValue}>{formatPercent(roiPctValue, true)}</Text>
                  </View>
                </View>
                <View style={styles.betFooter}>
                  <Text style={styles.betDate}>{dateStr}</Text>
                  <Text style={styles.betId}>#{String(bet.id).slice(-4)}</Text>
                </View>
              </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="bar-chart-outline" size={36} color="#6366F1" />
              </View>
              <Text style={styles.emptyTitle}>No betting history</Text>
              <Text style={styles.emptySubtitle}>
                Your bets will appear here once you start tracking
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '400',
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.03)',
    elevation: 1,
  },
  iconContainer: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  filterTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    marginTop: 12,
  },
  filterTab: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: '#1A1A1A',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  betsList: {
    gap: 12,
  },
  betCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.05)',
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
    color: '#1A1A1A',
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
    color: '#6B6B6B',
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
  betFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betDate: {
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
  },
});
