/**
 * ──────────────────────────────────────────────
 * Supabase migration — run once via SQL editor:
 * ──────────────────────────────────────────────
 *
 * CREATE TABLE IF NOT EXISTS achievements (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   badge_id    text NOT NULL,
 *   unlocked_at timestamptz DEFAULT now(),
 *   UNIQUE (user_id, badge_id)
 * );
 *
 * ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can read own achievements"
 *   ON achievements FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own achievements"
 *   ON achievements FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 *
 * ──────────────────────────────────────────────
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';
import AnimatedNumber from '@/components/AnimatedNumber';

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

type TabKey = 'Insights' | 'Achievements';

interface Bet {
  id: string;
  user_id: string;
  status: string;
  bet_type: string | null;
  sport: string | null;
  wager: number;
  potential_payout: number;
  placed_at: string | null;
  created_at: string;
  odds: number | null;
}

interface Achievement {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
}

interface BreakdownRow {
  label: string;
  count: number;
  wins: number;
  losses: number;
  wagered: number;
  profit: number;
  winRate: number;
  roi: number;
}

interface BetSizeRange {
  label: string;
  min: number;
  max: number;
  count: number;
  wins: number;
  wagered: number;
  profit: number;
  winRate: number;
  roi: number;
}

interface DayStats {
  day: string;
  count: number;
  roi: number;
}

// ──────────────────────────────────────
// Badge definitions
// ──────────────────────────────────────

interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: 'activity' | 'performance';
  check: (bets: Bet[], unlocked: Set<string>) => boolean;
  progress: (bets: Bet[]) => { current: number; target: number };
}

const BADGE_DEFINITIONS: BadgeDef[] = [
  // Activity
  {
    id: 'first_bet',
    emoji: '🏆',
    name: 'First Bet',
    description: 'Upload your first bet',
    category: 'activity',
    check: (bets) => bets.length >= 1,
    progress: (bets) => ({ current: Math.min(bets.length, 1), target: 1 }),
  },
  {
    id: 'ten_bets',
    emoji: '📈',
    name: 'Getting Started',
    description: '10 bets uploaded',
    category: 'activity',
    check: (bets) => bets.length >= 10,
    progress: (bets) => ({ current: Math.min(bets.length, 10), target: 10 }),
  },
  {
    id: 'fifty_bets',
    emoji: '⚡',
    name: 'Committed',
    description: '50 bets uploaded',
    category: 'activity',
    check: (bets) => bets.length >= 50,
    progress: (bets) => ({ current: Math.min(bets.length, 50), target: 50 }),
  },
  {
    id: 'century',
    emoji: '🏆',
    name: 'Century Club',
    description: '100 bets uploaded',
    category: 'activity',
    check: (bets) => bets.length >= 100,
    progress: (bets) => ({ current: Math.min(bets.length, 100), target: 100 }),
  },
  {
    id: 'on_a_roll',
    emoji: '🔥',
    name: 'On a Roll',
    description: '7 day upload streak',
    category: 'activity',
    check: (bets) => calcUploadStreak(bets) >= 7,
    progress: (bets) => ({ current: Math.min(calcUploadStreak(bets), 7), target: 7 }),
  },
  {
    id: 'sharp_eye',
    emoji: '👁️',
    name: 'Sharp Eye',
    description: '5 bets in one day',
    category: 'activity',
    check: (bets) => calcMaxBetsInDay(bets) >= 5,
    progress: (bets) => ({ current: Math.min(calcMaxBetsInDay(bets), 5), target: 5 }),
  },
  // Performance
  {
    id: 'first_win',
    emoji: '🎯',
    name: 'First Win',
    description: 'Win your first bet',
    category: 'performance',
    check: (bets) => bets.some((b) => b.status === 'won'),
    progress: (bets) => ({
      current: Math.min(bets.filter((b) => b.status === 'won').length, 1),
      target: 1,
    }),
  },
  {
    id: 'hot_streak',
    emoji: '🔥',
    name: 'Hot Streak',
    description: '5 wins in a row',
    category: 'performance',
    check: (bets) => calcMaxConsecutiveWins(bets) >= 5,
    progress: (bets) => ({
      current: Math.min(calcMaxConsecutiveWins(bets), 5),
      target: 5,
    }),
  },
  {
    id: 'iceman',
    emoji: '❄️',
    name: 'Iceman',
    description: 'Win after 5 consecutive losses',
    category: 'performance',
    check: (bets) => checkIceman(bets),
    progress: (bets) => ({
      current: checkIcemanProgress(bets),
      target: 1,
    }),
  },
  {
    id: 'profit_zone',
    emoji: '📈',
    name: 'Profit Zone',
    description: 'Overall ROI goes positive',
    category: 'performance',
    check: (bets) => calcOverallROI(bets) > 0,
    progress: (bets) => ({
      current: calcOverallROI(bets) > 0 ? 1 : 0,
      target: 1,
    }),
  },
  {
    id: 'double_up',
    emoji: '⚡',
    name: 'Double Up',
    description: '100% ROI milestone',
    category: 'performance',
    check: (bets) => calcOverallROI(bets) >= 100,
    progress: (bets) => ({
      current: Math.min(Math.max(calcOverallROI(bets), 0), 100),
      target: 100,
    }),
  },
  {
    id: 'sharp',
    emoji: '🎯',
    name: 'Sharp',
    description: '55%+ win rate over 50+ bets',
    category: 'performance',
    check: (bets) => {
      const settled = bets.filter((b) => b.status === 'won' || b.status === 'lost');
      if (settled.length < 50) return false;
      return (settled.filter((b) => b.status === 'won').length / settled.length) * 100 >= 55;
    },
    progress: (bets) => {
      const settled = bets.filter((b) => b.status === 'won' || b.status === 'lost');
      return { current: Math.min(settled.length, 50), target: 50 };
    },
  },
  {
    id: 'underdog_hunter',
    emoji: '🏆',
    name: 'Underdog Hunter',
    description: '60%+ win rate at +150 or longer',
    category: 'performance',
    check: (bets) => {
      const underdogs = bets.filter((b) => b.odds != null && b.odds >= 150);
      if (underdogs.length < 5) return false;
      const wins = underdogs.filter((b) => b.status === 'won').length;
      return (wins / underdogs.length) * 100 >= 60;
    },
    progress: (bets) => {
      const underdogs = bets.filter((b) => b.odds != null && b.odds >= 150);
      return { current: Math.min(underdogs.length, 5), target: 5 };
    },
  },
];

// ──────────────────────────────────────
// Badge-check helpers
// ──────────────────────────────────────

function calcUploadStreak(bets: Bet[]): number {
  if (bets.length === 0) return 0;
  const days = new Set(
    bets.map((b) => {
      const d = new Date(b.placed_at ?? b.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const sorted = [...days].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 1.5) streak++;
    else break;
  }
  return streak;
}

function calcMaxBetsInDay(bets: Bet[]): number {
  const counts: Record<string, number> = {};
  bets.forEach((b) => {
    const d = new Date(b.placed_at ?? b.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Math.max(0, ...Object.values(counts));
}

function calcMaxConsecutiveWins(bets: Bet[]): number {
  const settled = [...bets]
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => {
      const da = new Date(a.placed_at ?? a.created_at).getTime();
      const db = new Date(b.placed_at ?? b.created_at).getTime();
      return da - db;
    });
  let max = 0;
  let current = 0;
  for (const bet of settled) {
    if (bet.status === 'won') {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

function checkIceman(bets: Bet[]): boolean {
  const settled = [...bets]
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => {
      const da = new Date(a.placed_at ?? a.created_at).getTime();
      const db = new Date(b.placed_at ?? b.created_at).getTime();
      return da - db;
    });
  let consecutiveLosses = 0;
  for (const bet of settled) {
    if (bet.status === 'lost') {
      consecutiveLosses++;
    } else {
      if (consecutiveLosses >= 5) return true;
      consecutiveLosses = 0;
    }
  }
  return false;
}

function checkIcemanProgress(bets: Bet[]): number {
  return checkIceman(bets) ? 1 : 0;
}

function calcOverallROI(bets: Bet[]): number {
  let wagered = 0;
  let profit = 0;
  bets.forEach((b) => {
    wagered += b.wager || 0;
    if (b.status === 'won') profit += (b.potential_payout || 0) - (b.wager || 0);
    else if (b.status === 'lost') profit -= b.wager || 0;
  });
  return wagered > 0 ? (profit / wagered) * 100 : 0;
}

// ──────────────────────────────────────
// Stat calculation helpers
// ──────────────────────────────────────

function buildBreakdown(bets: Bet[], key: 'bet_type' | 'sport'): BreakdownRow[] {
  const groups: Record<string, Bet[]> = {};
  bets.forEach((b) => {
    const val = b[key] || 'Unknown';
    const label =
      key === 'bet_type'
        ? val === 'over_under'
          ? 'Over/Under'
          : val.charAt(0).toUpperCase() + val.slice(1)
        : val;
    if (!groups[label]) groups[label] = [];
    groups[label].push(b);
  });

  return Object.entries(groups)
    .map(([label, group]) => {
      const settled = group.filter((b) => b.status === 'won' || b.status === 'lost');
      const wins = group.filter((b) => b.status === 'won').length;
      const losses = group.filter((b) => b.status === 'lost').length;
      const wagered = group.reduce((s, b) => s + (b.wager || 0), 0);
      let profit = 0;
      group.forEach((b) => {
        if (b.status === 'won') profit += (b.potential_payout || 0) - (b.wager || 0);
        else if (b.status === 'lost') profit -= b.wager || 0;
      });
      const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
      const roi = wagered > 0 ? (profit / wagered) * 100 : 0;
      return { label, count: group.length, wins, losses, wagered, profit, winRate, roi };
    })
    .sort((a, b) => b.roi - a.roi);
}

function buildBetSizeRanges(bets: Bet[]): BetSizeRange[] {
  const ranges: { label: string; min: number; max: number }[] = [
    { label: '$0 – $25', min: 0, max: 25 },
    { label: '$25 – $50', min: 25, max: 50 },
    { label: '$50 – $100', min: 50, max: 100 },
    { label: '$100+', min: 100, max: Infinity },
  ];

  return ranges.map(({ label, min, max }) => {
    const group = bets.filter((b) => (b.wager || 0) >= min && (b.wager || 0) < max);
    const settled = group.filter((b) => b.status === 'won' || b.status === 'lost');
    const wins = group.filter((b) => b.status === 'won').length;
    const wagered = group.reduce((s, b) => s + (b.wager || 0), 0);
    let profit = 0;
    group.forEach((b) => {
      if (b.status === 'won') profit += (b.potential_payout || 0) - (b.wager || 0);
      else if (b.status === 'lost') profit -= b.wager || 0;
    });
    const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
    const roi = wagered > 0 ? (profit / wagered) * 100 : 0;
    return { label, min, max, count: group.length, wins, wagered, profit, winRate, roi };
  });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildDayOfWeek(bets: Bet[]): DayStats[] {
  const dayBuckets: Bet[][] = Array.from({ length: 7 }, () => []);

  bets.forEach((b) => {
    const d = new Date(b.placed_at ?? b.created_at);
    if (isNaN(d.getTime())) return;
    // JS getDay(): 0=Sun,1=Mon...6=Sat → remap to Mon=0
    const idx = (d.getDay() + 6) % 7;
    dayBuckets[idx].push(b);
  });

  return DAY_LABELS.map((day, i) => {
    const group = dayBuckets[i];
    const wagered = group.reduce((s, b) => s + (b.wager || 0), 0);
    let profit = 0;
    group.forEach((b) => {
      if (b.status === 'won') profit += (b.potential_payout || 0) - (b.wager || 0);
      else if (b.status === 'lost') profit -= b.wager || 0;
    });
    const roi = wagered > 0 ? (profit / wagered) * 100 : 0;
    return { day, count: group.length, roi };
  });
}

// ──────────────────────────────────────
// Progress ring SVG-free (pure View)
// ──────────────────────────────────────

function ProgressRing({
  progress,
  size,
  strokeWidth,
  activeColor,
  trackColor,
  children,
}: {
  progress: number; // 0..1
  size: number;
  strokeWidth: number;
  activeColor: string;
  trackColor: string;
  children?: React.ReactNode;
}) {
  const p = Math.min(Math.max(progress, 0), 1);
  const degrees = p * 360;
  const innerSize = size - strokeWidth * 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track circle */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        }}
      />
      {/* Active arc – approximated with four quadrant clips */}
      {degrees > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: degrees > 0 ? activeColor : 'transparent',
            borderRightColor: degrees > 90 ? activeColor : 'transparent',
            borderBottomColor: degrees > 180 ? activeColor : 'transparent',
            borderLeftColor: degrees > 270 ? activeColor : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }}
        />
      )}
      {/* Inner content */}
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ──────────────────────────────────────
// Main screen
// ──────────────────────────────────────

export default function EdgeScreen() {
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<TabKey>('Insights');
  const [bets, setBets] = useState<Bet[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Data fetching ────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [betsRes, achRes] = await Promise.all([
      supabase
        .from('bets')
        .select('id, user_id, status, bet_type, sport, wager, potential_payout, placed_at, created_at, odds')
        .eq('user_id', user.id)
        .order('placed_at', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id),
    ]);

    const fetchedBets: Bet[] = betsRes.data || [];
    const fetchedAch: Achievement[] = achRes.data || [];

    setBets(fetchedBets);
    setAchievements(fetchedAch);

    // Auto-unlock badges
    const unlockedIds = new Set(fetchedAch.map((a) => a.badge_id));
    const newlyUnlocked: string[] = [];
    BADGE_DEFINITIONS.forEach((badge) => {
      if (!unlockedIds.has(badge.id) && badge.check(fetchedBets, unlockedIds)) {
        newlyUnlocked.push(badge.id);
      }
    });

    if (newlyUnlocked.length > 0) {
      const rows = newlyUnlocked.map((badge_id) => ({
        user_id: user.id,
        badge_id,
      }));
      const { data: inserted } = await supabase
        .from('achievements')
        .insert(rows)
        .select();
      if (inserted) {
        setAchievements((prev) => [...prev, ...inserted]);
      }
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // ── Computed stats ───────────────────
  const settled = useMemo(() => bets.filter((b) => b.status === 'won' || b.status === 'lost'), [bets]);
  const totalWins = useMemo(() => bets.filter((b) => b.status === 'won').length, [bets]);
  const overallWinRate = useMemo(() => (settled.length > 0 ? (totalWins / settled.length) * 100 : 0), [settled, totalWins]);
  const overallROI = useMemo(() => calcOverallROI(bets), [bets]);
  const betTypeBreakdown = useMemo(() => buildBreakdown(bets, 'bet_type'), [bets]);
  const sportBreakdown = useMemo(() => buildBreakdown(bets, 'sport'), [bets]);
  const betSizeRanges = useMemo(() => buildBetSizeRanges(bets), [bets]);
  const dayOfWeek = useMemo(() => buildDayOfWeek(bets), [bets]);

  // Best bet size range (highest win rate with at least a few bets)
  const bestRange = useMemo(() => {
    const qualifying = betSizeRanges.filter((r) => r.count >= 2);
    if (qualifying.length === 0) return null;
    return qualifying.reduce((a, b) => (a.winRate > b.winRate ? a : b));
  }, [betSizeRanges]);

  // ── Achievement helpers ──────────────
  const unlockedSet = useMemo(() => new Set(achievements.map((a) => a.badge_id)), [achievements]);
  const unlockedBadges = useMemo(
    () =>
      achievements
        .sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())
        .map((ach) => ({
          ...ach,
          def: BADGE_DEFINITIONS.find((d) => d.id === ach.badge_id),
        }))
        .filter((a) => a.def != null),
    [achievements]
  );

  const inProgressBadges = useMemo(() => {
    return BADGE_DEFINITIONS.filter((d) => !unlockedSet.has(d.id))
      .map((d) => {
        const { current, target } = d.progress(bets);
        return { def: d, current, target, pct: target > 0 ? current / target : 0 };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [bets, unlockedSet]);

  const GREEN = '#2DC672';
  const RED = '#E85D5D';

  // ── Renders ──────────────────────────
  const renderInsights = () => {
    if (bets.length === 0) {
      return (
        <FadeInView delay={0} direction="bottom">
          <View style={styles.emptyStateCard}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.chipBg }]}>
              <Ionicons name="flash-outline" size={36} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Start tracking bets to unlock your competitive edge
            </Text>
          </View>
        </FadeInView>
      );
    }

    return (
      <>
        {/* Best Bet Size highlight card */}
        {bestRange && (
          <FadeInView delay={0} direction="bottom">
            <View style={styles.highlightCard}>
              <View style={styles.highlightHeader}>
                <View style={[styles.highlightIcon, { backgroundColor: colors.chipBg }]}>
                  <Text style={{ fontSize: 20 }}>💰</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightLabel}>Best Bet Size Range</Text>
                  <Text style={styles.highlightSub}>Optimal performance zone</Text>
                </View>
              </View>
              <View style={styles.highlightRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.highlightValue, { color: GREEN }]}>{bestRange.label}</Text>
                  <Text style={styles.highlightMeta}>{bestRange.count} bets placed</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.highlightBigNum, { color: colors.text }]}>
                    {bestRange.winRate.toFixed(0)}%
                  </Text>
                  <Text style={styles.highlightMeta}>Win Rate</Text>
                </View>
              </View>
            </View>
          </FadeInView>
        )}

        {/* Top stat row — Win Rate & ROI */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <Ionicons name="checkmark-circle-outline" size={16} color={GREEN} />
                <Text style={styles.statCardLabel}>WIN RATE</Text>
              </View>
              <AnimatedNumber
                value={overallWinRate}
                suffix="%"
                decimals={1}
                delay={200}
                style={styles.statCardValue}
              />
              {settled.length > 0 && (
                <View style={styles.statCardFooter}>
                  <Ionicons name="arrow-up" size={12} color={GREEN} />
                  <Text style={[styles.statCardFooterText, { color: GREEN }]}>
                    {totalWins}W / {settled.length - totalWins}L
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <Ionicons name="trending-up" size={16} color={overallROI >= 0 ? GREEN : RED} />
                <Text style={styles.statCardLabel}>ROI</Text>
              </View>
              <AnimatedNumber
                value={Math.abs(overallROI)}
                prefix={overallROI >= 0 ? '+' : '-'}
                suffix="%"
                decimals={1}
                delay={200}
                style={{
                  ...styles.statCardValue,
                  color: overallROI >= 0 ? GREEN : RED,
                }}
              />
              {settled.length > 0 && (
                <View style={styles.statCardFooter}>
                  <Ionicons name="arrow-up" size={12} color={overallROI >= 0 ? GREEN : RED} />
                  <Text style={[styles.statCardFooterText, { color: overallROI >= 0 ? GREEN : RED }]}>
                    vs avg
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeInView>

        {/* Bet Type Breakdown */}
        {betTypeBreakdown.length > 0 && (
          <FadeInView delay={160} direction="bottom">
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="bar-chart-outline" size={18} color={colors.text} />
                <Text style={styles.sectionTitle}>Bet Type Performance</Text>
              </View>
              {betTypeBreakdown.map((row, idx) => (
                <View key={row.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownRank}>
                    <Text style={styles.breakdownRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.breakdownContent}>
                    <View style={styles.breakdownLabelRow}>
                      <Text style={styles.breakdownLabel}>{row.label}</Text>
                      <View style={styles.breakdownStats}>
                        <Text style={styles.breakdownWR}>{row.winRate.toFixed(0)}% WR</Text>
                        <Text
                          style={[
                            styles.breakdownROI,
                            { color: row.roi >= 0 ? GREEN : RED },
                          ]}
                        >
                          {row.roi >= 0 ? '+' : ''}
                          {row.roi.toFixed(0)}% ROI
                        </Text>
                      </View>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(row.winRate, 100)}%`,
                            backgroundColor: GREEN,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </FadeInView>
        )}

        {/* Sport Breakdown */}
        {sportBreakdown.length > 0 && (
          <FadeInView delay={240} direction="bottom">
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="trophy-outline" size={18} color={colors.text} />
                <Text style={styles.sectionTitle}>Sport Breakdown</Text>
              </View>
              {sportBreakdown.map((row) => (
                <View key={row.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownContent}>
                    <View style={styles.breakdownLabelRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.breakdownLabel}>{row.label}</Text>
                        <View style={[styles.countBadge, { backgroundColor: colors.chipBg }]}>
                          <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                            {row.count} bets
                          </Text>
                        </View>
                      </View>
                      <View style={styles.breakdownStats}>
                        <Text style={styles.breakdownWR}>{row.winRate.toFixed(0)}% WR</Text>
                        <Text
                          style={[
                            styles.breakdownROI,
                            { color: row.roi >= 0 ? GREEN : RED },
                          ]}
                        >
                          {row.roi >= 0 ? '+' : ''}
                          {row.roi.toFixed(0)}% ROI
                        </Text>
                      </View>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(row.winRate, 100)}%`,
                            backgroundColor: GREEN,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </FadeInView>
        )}

        {/* Best Bet Size — horizontal scroll */}
        <FadeInView delay={320} direction="bottom">
          <Text style={styles.standaloneSectionTitle}>Bet Size Performance</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {betSizeRanges.map((range) => (
              <View
                key={range.label}
                style={[
                  styles.betSizeCard,
                  bestRange && range.label === bestRange.label && styles.betSizeCardBest,
                ]}
              >
                <Text style={styles.betSizeLabel}>{range.label}</Text>
                <Text style={styles.betSizeCount}>{range.count} bets</Text>
                <View style={styles.betSizeDivider} />
                <Text style={styles.betSizeStatLabel}>Win Rate</Text>
                <Text style={[styles.betSizeStatValue, { color: range.winRate >= 50 ? GREEN : RED }]}>
                  {range.winRate.toFixed(0)}%
                </Text>
                <Text style={styles.betSizeStatLabel}>ROI</Text>
                <Text style={[styles.betSizeStatValue, { color: range.roi >= 0 ? GREEN : RED }]}>
                  {range.roi >= 0 ? '+' : ''}
                  {range.roi.toFixed(0)}%
                </Text>
              </View>
            ))}
          </ScrollView>
        </FadeInView>

        {/* Day of Week */}
        <FadeInView delay={400} direction="bottom">
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitleSolo}>Day of Week Performance</Text>
            <View style={styles.dayRow}>
              {dayOfWeek.map((d) => {
                const intensity = d.count === 0 ? 0 : Math.min(Math.abs(d.roi) / 100, 1);
                const isPositive = d.roi >= 0;
                const bgColor =
                  d.count === 0
                    ? colors.chipBg
                    : isPositive
                      ? `rgba(45, 198, 114, ${0.15 + intensity * 0.55})`
                      : `rgba(232, 93, 93, ${0.15 + intensity * 0.55})`;
                const textColor =
                  d.count === 0
                    ? colors.textTertiary
                    : isPositive
                      ? GREEN
                      : RED;

                return (
                  <View key={d.day} style={styles.dayColumn}>
                    <View style={[styles.dayBubble, { backgroundColor: bgColor }]}>
                      <Text style={[styles.dayBubbleText, { color: textColor }]}>
                        {d.count === 0 ? '—' : `${d.roi.toFixed(0)}%`}
                      </Text>
                    </View>
                    <Text style={styles.dayLabel}>{d.day.charAt(0)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeInView>
      </>
    );
  };

  const renderAchievements = () => {
    return (
      <>
        {/* Recently Unlocked */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.sectionTitleRow}>
            <Ionicons name="star-outline" size={18} color={GREEN} />
            <Text style={styles.sectionTitle}>Recently Unlocked</Text>
          </View>
          {unlockedBadges.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {unlockedBadges.map((ach) => (
                <View key={ach.badge_id} style={styles.unlockedCard}>
                  <View style={[styles.unlockedIconCircle, { backgroundColor: `rgba(45, 198, 114, 0.12)` }]}>
                    <Text style={{ fontSize: 24 }}>{ach.def!.emoji}</Text>
                  </View>
                  <Text style={styles.unlockedName}>{ach.def!.name}</Text>
                  <Text style={styles.unlockedDate}>
                    {new Date(ach.unlocked_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyBadgeRow}>
              <Text style={styles.emptyBadgeText}>
                Keep betting to unlock your first badge!
              </Text>
            </View>
          )}
        </FadeInView>

        {/* In Progress */}
        {inProgressBadges.length > 0 && (
          <FadeInView delay={80} direction="bottom">
            <View style={[styles.sectionTitleRow, { marginTop: 24 }]}>
              <Ionicons name="flash-outline" size={18} color={colors.text} />
              <Text style={styles.sectionTitle}>In Progress</Text>
            </View>
            {inProgressBadges.map((item) => {
              const pctDisplay = Math.round(item.pct * 100);
              const remaining = item.target - item.current;
              return (
                <View key={item.def.id} style={styles.progressCard}>
                  <ProgressRing
                    progress={item.pct}
                    size={48}
                    strokeWidth={3}
                    activeColor={GREEN}
                    trackColor={colors.chipBg}
                  >
                    <Text style={{ fontSize: 16 }}>{item.def.emoji}</Text>
                  </ProgressRing>
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressName}>{item.def.name}</Text>
                    <Text style={styles.progressSub}>
                      {remaining} away
                    </Text>
                  </View>
                  <View style={[styles.progressPctBadge, { backgroundColor: `rgba(45, 198, 114, 0.12)` }]}>
                    <Text style={[styles.progressPctText, { color: GREEN }]}>
                      {pctDisplay}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </FadeInView>
        )}

        {/* All Badges grid */}
        <FadeInView delay={160} direction="bottom">
          <View style={[styles.sectionTitleRow, { marginTop: 24 }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>All Badges</Text>
          </View>
          <View style={styles.badgeGrid}>
            {BADGE_DEFINITIONS.map((badge) => {
              const isUnlocked = unlockedSet.has(badge.id);
              return (
                <View key={badge.id} style={styles.badgeCell}>
                  <View
                    style={[
                      styles.badgeIconCircle,
                      {
                        backgroundColor: isUnlocked
                          ? `rgba(45, 198, 114, 0.12)`
                          : colors.chipBg,
                      },
                    ]}
                  >
                    {isUnlocked ? (
                      <Text style={{ fontSize: 22 }}>{badge.emoji}</Text>
                    ) : (
                      <Ionicons name="lock-closed" size={20} color={colors.textTertiary} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.badgeName,
                      !isUnlocked && { color: colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {badge.name}
                  </Text>
                  {!isUnlocked && (
                    <Ionicons
                      name="lock-closed"
                      size={10}
                      color={colors.textTertiary}
                      style={{ marginTop: 2 }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </FadeInView>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Edge</Text>
              <Text style={styles.headerSubtitle}>Your competitive advantage analysis</Text>
            </View>
            <AnimatedPressable
              style={[styles.themeButton, { backgroundColor: colors.surface }]}
              onPress={toggleTheme}
              scaleDown={0.9}
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={20}
                color={colors.text}
              />
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* Segmented control */}
        <FadeInView delay={40} direction="bottom">
          <View style={styles.segmentedControl}>
            {(['Insights', 'Achievements'] as TabKey[]).map((tab) => (
              <AnimatedPressable
                key={tab}
                style={[
                  styles.segmentTab,
                  activeTab === tab && styles.segmentTabActive,
                ]}
                onPress={() => setActiveTab(tab)}
                scaleDown={0.96}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    activeTab === tab && styles.segmentTabTextActive,
                  ]}
                >
                  {tab}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </FadeInView>

        {/* Tab content */}
        {activeTab === 'Insights' ? renderInsights() : renderAchievements()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────
// Styles
// ──────────────────────────────────────

function createStyles(colors: ThemeColors) {
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

    // ── Header ─────────────────────────
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    themeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
      elevation: 2,
    },

    // ── Segmented control ──────────────
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.chipBg,
      borderRadius: 20,
      padding: 3,
      marginBottom: 24,
    },
    segmentTab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 18,
    },
    segmentTabActive: {
      backgroundColor: colors.chipActiveBg,
    },
    segmentTabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTabTextActive: {
      color: colors.chipActiveText,
    },

    // ── Empty state ────────────────────
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
    },

    // ── Highlight card ─────────────────
    highlightCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
      elevation: 3,
    },
    highlightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    highlightIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    highlightSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    highlightValue: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 4,
    },
    highlightBigNum: {
      fontSize: 28,
      fontWeight: '700',
    },
    highlightMeta: {
      fontSize: 12,
      color: colors.textTertiary,
    },

    // ── Top stat row ───────────────────
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
      elevation: 3,
    },
    statCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    statCardLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    statCardValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
    },
    statCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    statCardFooterText: {
      fontSize: 12,
      fontWeight: '500',
    },

    // ── Section card ───────────────────
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
      elevation: 3,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    sectionTitleSolo: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    standaloneSectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },

    // ── Breakdown rows ─────────────────
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    breakdownRank: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.chipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    breakdownRankText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    breakdownContent: {
      flex: 1,
    },
    breakdownLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    breakdownLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    breakdownStats: {
      flexDirection: 'row',
      gap: 12,
    },
    breakdownWR: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    breakdownROI: {
      fontSize: 13,
      fontWeight: '700',
    },
    barTrack: {
      height: 5,
      backgroundColor: colors.chipBg,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: 5,
      borderRadius: 3,
    },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // ── Bet size horizontal scroll ─────
    horizontalScroll: {
      gap: 12,
      paddingBottom: 4,
      marginBottom: 16,
    },
    betSizeCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      width: 130,
      boxShadow: '0px 1px 6px rgba(0, 0, 0, 0.04)',
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    betSizeCardBest: {
      borderColor: 'rgba(45, 198, 114, 0.4)',
      borderWidth: 1.5,
    },
    betSizeLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    betSizeCount: {
      fontSize: 12,
      color: colors.textTertiary,
      marginBottom: 10,
    },
    betSizeDivider: {
      height: 1,
      backgroundColor: colors.dividerLine,
      marginBottom: 10,
    },
    betSizeStatLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textTertiary,
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    betSizeStatValue: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },

    // ── Day of Week ────────────────────
    dayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayColumn: {
      alignItems: 'center',
      gap: 6,
    },
    dayBubble: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBubbleText: {
      fontSize: 11,
      fontWeight: '700',
    },
    dayLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textTertiary,
    },

    // ── Achievements: recently unlocked ─
    unlockedCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      width: 140,
      alignItems: 'center',
      boxShadow: '0px 1px 6px rgba(0, 0, 0, 0.04)',
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unlockedIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    unlockedName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    unlockedDate: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    emptyBadgeRow: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    emptyBadgeText: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    // ── Achievements: in progress ──────
    progressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: 14,
      boxShadow: '0px 1px 6px rgba(0, 0, 0, 0.04)',
      elevation: 2,
    },
    progressInfo: {
      flex: 1,
    },
    progressName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    progressSub: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    progressPctBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    progressPctText: {
      fontSize: 13,
      fontWeight: '700',
    },

    // ── Achievements: all badges grid ──
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    badgeCell: {
      width: '30%' as any,
      alignItems: 'center',
      marginBottom: 12,
    },
    badgeIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    badgeName: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
  });
}
