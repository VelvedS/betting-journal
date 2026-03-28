import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';
import { useTheme } from '@/context/ThemeContext';

export default function SkeletonBetCard() {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* Top row: sportsbook name + status pill */}
      <View style={styles.topRow}>
        <SkeletonLoader width={100} height={16} borderRadius={8} />
        <SkeletonLoader width={60} height={24} borderRadius={6} />
      </View>
      {/* Matchup / bet type */}
      <SkeletonLoader width="70%" height={14} borderRadius={6} style={{ marginTop: 12 }} />
      {/* Stats row: wager, potential, ROI */}
      <View style={styles.statsRow}>
        <View style={{ flex: 1 }}>
          <SkeletonLoader width={40} height={10} borderRadius={4} />
          <SkeletonLoader width={60} height={16} borderRadius={6} style={{ marginTop: 4 }} />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonLoader width={50} height={10} borderRadius={4} />
          <SkeletonLoader width={60} height={16} borderRadius={6} style={{ marginTop: 4 }} />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonLoader width={30} height={10} borderRadius={4} />
          <SkeletonLoader width={50} height={16} borderRadius={6} style={{ marginTop: 4 }} />
        </View>
      </View>
      {/* Footer: date + bet id */}
      <View style={styles.footer}>
        <SkeletonLoader width={120} height={12} borderRadius={4} />
        <SkeletonLoader width={40} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
});
