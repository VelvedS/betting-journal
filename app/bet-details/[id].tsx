import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

interface ParlayLeg {
  pick: string;
  odds: string;
  status: 'WIN' | 'LOSS' | 'PENDING';
}

interface BetDetails {
  id: string;
  platform: string;
  status: 'WIN' | 'LOSS' | 'PENDING';
  betType: string;
  wager: number;
  payout: number;
  roi: number;
  date: string;
  legs?: ParlayLeg[];
  pick?: string;
  notes: string;
}

const allBetDetails: { [key: string]: BetDetails } = {
  '0001': {
    id: '#0001',
    platform: 'DraftKings',
    status: 'WIN',
    betType: 'Parlay (3 legs)',
    wager: 50,
    payout: 425,
    roi: 750,
    date: 'January 25, 2026, 3:45 PM',
    legs: [
      { pick: 'Lakers ML', odds: '+120', status: 'WIN' },
      { pick: 'Warriors -5.5', odds: '-110', status: 'WIN' },
      { pick: 'Celtics Over 215.5', odds: '-115', status: 'WIN' },
    ],
    notes: 'Feeling confident about this parlay. Lakers have been on a hot streak, and Warriors matchup looks favorable. Celtics games usually go over.',
  },
  '0002': {
    id: '#0002',
    platform: 'Kalshi',
    status: 'PENDING',
    betType: 'Spread',
    wager: 100,
    payout: 190,
    roi: 90,
    date: 'January 25, 2026, 1:20 PM',
    pick: 'Trump Yes -150',
    notes: 'Political spread bet. Feeling good about this one based on recent polling data.',
  },
  '0003': {
    id: '#0003',
    platform: 'PrizePicks',
    status: 'LOSS',
    betType: 'Over/Under',
    wager: 25,
    payout: 47.5,
    roi: 90,
    date: 'January 24, 2026, 8:30 PM',
    pick: 'LeBron Over 27.5 pts',
    notes: 'LeBron has been averaging 30+ lately but had an off night.',
  },
  '0004': {
    id: '#0004',
    platform: 'DraftKings',
    status: 'WIN',
    betType: 'Moneyline',
    wager: 75,
    payout: 142.5,
    roi: 90,
    date: 'January 23, 2026, 6:15 PM',
    pick: 'Chiefs ML -175',
    notes: 'Chiefs at home, should be a comfortable win.',
  },
  '0005': {
    id: '#0005',
    platform: 'FanDuel',
    status: 'LOSS',
    betType: 'Parlay (2 legs)',
    wager: 40,
    payout: 120,
    roi: 200,
    date: 'January 22, 2026, 4:00 PM',
    legs: [
      { pick: 'Knicks ML', odds: '-130', status: 'WIN' },
      { pick: 'Bucks -3.5', odds: '-110', status: 'LOSS' },
    ],
    notes: 'Knicks came through but Bucks couldn\'t cover. Tough break.',
  },
  '0006': {
    id: '#0006',
    platform: 'BetMGM',
    status: 'WIN',
    betType: 'Spread',
    wager: 60,
    payout: 114,
    roi: 90,
    date: 'December 28, 2025, 2:30 PM',
    pick: 'Bills -7.5 -110',
    notes: 'Bills defense has been dominant at home. Easy cover.',
  },
  '0007': {
    id: '#0007',
    platform: 'Caesars',
    status: 'WIN',
    betType: 'Over/Under',
    wager: 85,
    payout: 161.5,
    roi: 90,
    date: 'December 25, 2025, 7:45 PM',
    pick: 'Lakers/Warriors Over 230.5',
    notes: 'Christmas Day games always go over. Both teams playing fast.',
  },
  '0008': {
    id: '#0008',
    platform: 'DraftKings',
    status: 'LOSS',
    betType: 'Parlay (4 legs)',
    wager: 30,
    payout: 450,
    roi: 1400,
    date: 'December 20, 2025, 12:00 PM',
    legs: [
      { pick: '49ers ML', odds: '-140', status: 'WIN' },
      { pick: 'Eagles -3', odds: '-110', status: 'LOSS' },
      { pick: 'Ravens ML', odds: '-200', status: 'WIN' },
      { pick: 'Bengals +7', odds: '-105', status: 'WIN' },
    ],
    notes: 'Went big on this one. Eagles let me down but the other 3 hit.',
  },
};

export default function BetDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const betId = typeof id === 'string' ? id : '0001';
  const bet = allBetDetails[betId];

  if (!bet) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Bet not found</Text>
      </SafeAreaView>
    );
  }

  // Get status styling
  const getStatusStyling = () => {
    switch (bet.status) {
      case 'WIN':
        return {
          bgColor: '#E8F8F0',
          textColor: '#10B981',
          iconName: 'trending-up' as const,
          iconBg: '#C6F0DC',
        };
      case 'LOSS':
        return {
          bgColor: '#FEE2E2',
          textColor: '#EF4444',
          iconName: 'trending-down' as const,
          iconBg: '#FCA5A5',
        };
      case 'PENDING':
        return {
          bgColor: '#FEF3C7',
          textColor: '#F59E0B',
          iconName: 'time' as const,
          iconBg: '#FDE68A',
        };
    }
  };

  const statusStyle = getStatusStyling();
  const isParlay = bet.betType.toLowerCase().includes('parlay');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bet Details</Text>
        </View>

        {/* Status Banner Card */}
        <View style={[styles.statusBanner, { backgroundColor: statusStyle.bgColor }]}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>STATUS</Text>
              <Text style={[styles.statusValue, { color: statusStyle.textColor }]}>
                {bet.status === 'WIN' ? 'Win' : bet.status === 'LOSS' ? 'Loss' : 'Pending'}
              </Text>
              <Text style={styles.statusDate}>{bet.date}</Text>
            </View>
            <View style={[styles.statusIconCircle, { backgroundColor: statusStyle.iconBg }]}>
              <Ionicons name={statusStyle.iconName} size={24} color={statusStyle.textColor} />
            </View>
          </View>
        </View>

        {/* Sportsbook & Wager Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.sportsbookHeader}>
            <View style={styles.sportsbookIcon}>
              <Ionicons name="logo-usd" size={22} color="#10B981" />
            </View>
            <View style={styles.sportsbookInfo}>
              <Text style={styles.sportsbookName}>{bet.platform}</Text>
              <Text style={styles.sportsbookType}>{bet.betType}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>WAGER</Text>
              <Text style={styles.statValue}>${bet.wager}</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>PAYOUT</Text>
              <Text style={styles.statValue}>${bet.payout}</Text>
            </View>
            <View style={[styles.statColumn, styles.statColumnRight]}>
              <Text style={styles.statLabel}>ROI</Text>
              <Text style={styles.roiValue}>+{bet.roi}%</Text>
            </View>
          </View>
        </View>

        {/* Parlay Legs Card (conditional) */}
        {isParlay && bet.legs && (
          <View style={styles.parlayCard}>
            <View style={styles.parlayHeader}>
              <Text style={styles.parlayTitle}>Parlay Legs</Text>
              <View style={styles.legsBadge}>
                <Text style={styles.legsBadgeText}>{bet.legs.length}</Text>
              </View>
            </View>

            <View style={styles.legsContainer}>
              {bet.legs.map((leg, index) => {
                const legStatusStyle =
                  leg.status === 'WIN'
                    ? { bgColor: '#D1FAE5', textColor: '#10B981' }
                    : leg.status === 'LOSS'
                    ? { bgColor: '#FEE2E2', textColor: '#EF4444' }
                    : { bgColor: '#FEF3C7', textColor: '#F59E0B' };

                return (
                  <View key={index} style={styles.legCard}>
                    <View style={styles.legLeft}>
                      <Text style={styles.legPick}>{leg.pick}</Text>
                      <Text style={styles.legOdds}>{leg.odds}</Text>
                    </View>
                    <View style={[styles.legBadge, { backgroundColor: legStatusStyle.bgColor }]}>
                      <Text style={[styles.legBadgeText, { color: legStatusStyle.textColor }]}>
                        {leg.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Notes Card */}
        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <Ionicons name="document-text-outline" size={20} color="#6366F1" />
            <Text style={styles.notesTitle}>Notes</Text>
          </View>
          <Text style={styles.notesText}>{bet.notes}</Text>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusDate: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sportsbookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sportsbookIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportsbookInfo: {
    flex: 1,
  },
  sportsbookName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  sportsbookType: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statColumn: {
    flex: 1,
  },
  statColumnRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  roiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  parlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  parlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  parlayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  legsBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B6B6B',
  },
  legsContainer: {
    gap: 10,
  },
  legCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  legLeft: {
    flex: 1,
  },
  legPick: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  legOdds: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  legBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  legBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B6B6B',
  },
});
