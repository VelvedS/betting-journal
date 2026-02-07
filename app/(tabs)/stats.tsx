import React, { useState, useRef, useEffect } from 'react';
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

type FilterType = 'All' | 'Wins' | 'Losses' | 'Pending';

interface BetData {
  id: string;
  platform: string;
  status: 'WIN' | 'LOSS' | 'PENDING';
  betType: string;
  wager: number;
  potential: number;
  roi: number;
  date: string;
  statusColor: string;
  statusBg: string;
  iconName: any;
}

const allBets: BetData[] = [
  {
    id: '#0001',
    platform: 'DraftKings',
    status: 'WIN',
    betType: 'Parlay (3 legs)',
    wager: 50,
    potential: 425,
    roi: 750,
    date: 'Jan 25, 3:45 PM',
    statusColor: '#10B981',
    statusBg: '#D1FAE5',
    iconName: 'checkmark-circle',
  },
  {
    id: '#0002',
    platform: 'Kalshi',
    status: 'PENDING',
    betType: 'Spread',
    wager: 100,
    potential: 190,
    roi: 90,
    date: 'Jan 25, 1:20 PM',
    statusColor: '#F59E0B',
    statusBg: '#FEF3C7',
    iconName: 'time',
  },
  {
    id: '#0003',
    platform: 'PrizePicks',
    status: 'LOSS',
    betType: 'Over/Under',
    wager: 25,
    potential: 47.5,
    roi: 90,
    date: 'Jan 24, 8:30 PM',
    statusColor: '#EF4444',
    statusBg: '#FEE2E2',
    iconName: 'close-circle',
  },
  {
    id: '#0004',
    platform: 'DraftKings',
    status: 'WIN',
    betType: 'Moneyline',
    wager: 75,
    potential: 142.5,
    roi: 90,
    date: 'Jan 23, 6:15 PM',
    statusColor: '#10B981',
    statusBg: '#D1FAE5',
    iconName: 'checkmark-circle',
  },
  {
    id: '#0005',
    platform: 'FanDuel',
    status: 'LOSS',
    betType: 'Parlay (2 legs)',
    wager: 40,
    potential: 120,
    roi: 200,
    date: 'Jan 22, 4:00 PM',
    statusColor: '#EF4444',
    statusBg: '#FEE2E2',
    iconName: 'close-circle',
  },
  {
    id: '#0006',
    platform: 'BetMGM',
    status: 'WIN',
    betType: 'Spread',
    wager: 60,
    potential: 114,
    roi: 90,
    date: 'Dec 28, 2:30 PM',
    statusColor: '#10B981',
    statusBg: '#D1FAE5',
    iconName: 'checkmark-circle',
  },
  {
    id: '#0007',
    platform: 'Caesars',
    status: 'WIN',
    betType: 'Over/Under',
    wager: 85,
    potential: 161.5,
    roi: 90,
    date: 'Dec 25, 7:45 PM',
    statusColor: '#10B981',
    statusBg: '#D1FAE5',
    iconName: 'checkmark-circle',
  },
  {
    id: '#0008',
    platform: 'DraftKings',
    status: 'LOSS',
    betType: 'Parlay (4 legs)',
    wager: 30,
    potential: 450,
    roi: 1400,
    date: 'Dec 20, 12:00 PM',
    statusColor: '#EF4444',
    statusBg: '#FEE2E2',
    iconName: 'close-circle',
  },
];

export default function StatsScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectedFilter]);

  const totalWins = allBets.filter(bet => bet.status === 'WIN').length;
  const totalLosses = allBets.filter(bet => bet.status === 'LOSS').length;
  const totalPending = allBets.filter(bet => bet.status === 'PENDING').length;
  const totalAllBets = allBets.length;

  const filteredBets = selectedFilter === 'All'
    ? allBets
    : allBets.filter(bet => {
        if (selectedFilter === 'Wins') return bet.status === 'WIN';
        if (selectedFilter === 'Losses') return bet.status === 'LOSS';
        if (selectedFilter === 'Pending') return bet.status === 'PENDING';
        return true;
      });

  const filteredCount = filteredBets.length;
  const wins = filteredBets.filter(bet => bet.status === 'WIN').length;
  const losses = filteredBets.filter(bet => bet.status === 'LOSS').length;

  const totalWagered = filteredBets.reduce((sum, bet) => sum + bet.wager, 0);
  const totalWon = filteredBets
    .filter(bet => bet.status === 'WIN')
    .reduce((sum, bet) => sum + (bet.potential - bet.wager), 0);
  const totalLost = filteredBets
    .filter(bet => bet.status === 'LOSS')
    .reduce((sum, bet) => sum + bet.wager, 0);
  const netPL = totalWon - totalLost;
  const winRate = filteredCount > 0 ? ((wins / filteredCount) * 100).toFixed(1) : '0.0';
  const roi = totalWagered > 0 ? ((netPL / totalWagered) * 100).toFixed(1) : '0.0';

  const getValueColor = (value: number) => {
    if (value > 0) return '#10B981';
    if (value < 0) return '#EF4444';
    return '#1A1A1A';
  };

  const formatNetPL = (value: number) => {
    if (value > 0) return `+$${value}`;
    if (value < 0) return `-$${Math.abs(value)}`;
    return '$0';
  };

  const formatROI = (value: string) => {
    const num = parseFloat(value);
    if (num > 0) return `+${value}%`;
    if (num < 0) return `${value}%`;
    return '0.0%';
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
          <View style={styles.summaryCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="trending-up" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel}>WINS</Text>
            <Text style={styles.summaryValue}>{wins}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="trending-down" size={20} color="#EF4444" />
            </View>
            <Text style={styles.summaryLabel}>LOSSES</Text>
            <Text style={styles.summaryValue}>{losses}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text-outline" size={20} color={getValueColor(netPL)} />
            </View>
            <Text style={styles.summaryLabel}>NET P/L</Text>
            <Text style={[styles.summaryValue, { color: getValueColor(netPL) }]}>
              {formatNetPL(netPL)}
            </Text>
          </View>
        </Animated.View>

        {/* Summary Cards - Row 2 */}
        <Animated.View style={[styles.summaryRow, { opacity: fadeAnim }]}>
          <View style={styles.summaryCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="cash-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel}>WAGERED</Text>
            <Text style={styles.summaryValue}>${totalWagered}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel}>WIN RATE</Text>
            <Text style={styles.summaryValue}>{winRate}%</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="bar-chart-outline" size={20} color={getValueColor(parseFloat(roi))} />
            </View>
            <Text style={styles.summaryLabel}>ROI</Text>
            <Text style={[styles.summaryValue, { color: getValueColor(parseFloat(roi)) }]}>
              {formatROI(roi)}
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
          {filteredBets.map((bet) => (
            <TouchableOpacity
              key={bet.id}
              style={styles.betCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/bet-details/${bet.id.replace('#', '')}`)}
            >
              <View style={styles.betHeader}>
                <View style={styles.betHeaderLeft}>
                  <Text style={styles.platformName}>{bet.platform}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: bet.statusBg }]}>
                    <Text style={[styles.statusBadgeText, { color: bet.statusColor }]}>
                      {bet.status}
                    </Text>
                  </View>
                </View>
                <Ionicons name={bet.iconName} size={24} color={bet.statusColor} />
              </View>

              <Text style={styles.betType}>{bet.betType}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>WAGER</Text>
                  <Text style={styles.statValue}>${bet.wager}</Text>
                </View>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>POTENTIAL</Text>
                  <Text style={styles.statValue}>${bet.potential}</Text>
                </View>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>ROI</Text>
                  <Text style={styles.roiValue}>+{bet.roi}%</Text>
                </View>
              </View>

              <View style={styles.betFooter}>
                <Text style={styles.betDate}>{bet.date}</Text>
                <Text style={styles.betId}>{bet.id}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
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
});
