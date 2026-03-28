import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
  withRepeat,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import AnimatedPressable from '@/components/AnimatedPressable';

interface ESPNTeam {
  name: string;
  abbreviation: string;
  color: string;
  score?: string;
  record?: string;
}

interface ESPNLeader {
  category: string;
  playerName: string;
  displayValue: string;
}

interface ESPNGameData {
  status: 'in' | 'post' | 'pre';
  statusDetail: string;
  awayTeam: ESPNTeam;
  homeTeam: ESPNTeam;
  venue?: string;
  broadcast?: string;
  leaders?: ESPNLeader[];
}

interface KalshiMarketData {
  title: string;
  subtitle?: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  volume24h?: number;
  openInterest?: number;
  closeTime?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TickerDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  itemType: 'espn' | 'kalshi' | null;
  itemId: string | null;
  itemSport?: string;
}

// Category color mapping (matches KalshiTicker)
const CATEGORY_COLORS: Record<string, string> = {
  Economics: '#3B82F6',
  Finance: '#3B82F6',
  Financials: '#3B82F6',
  Politics: '#8B5CF6',
  Weather: '#F59E0B',
  Climate: '#F59E0B',
  Tech: '#06B6D4',
  Science: '#06B6D4',
  Sports: '#2DC672',
  World: '#8B5CF6',
};

function getCategoryColor(category: string): string {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#8B5CF6';
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatCloseTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function SkeletonBar({ width, colors }: { width: number | string; colors: ThemeColors }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.border,
          marginBottom: 12,
        },
        style,
      ]}
    />
  );
}

export default function TickerDetailSheet({
  visible,
  onClose,
  itemType,
  itemId,
  itemSport,
}: TickerDetailSheetProps) {
  if (!visible) return null;

  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const closeSheet = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 300 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [onClose]);

  // Open animation
  useEffect(() => {
    if (visible && itemId) {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;

      // Animate in
      translateY.value = withSpring(0, { damping: 25, stiffness: 200 });
      backdropOpacity.value = withTiming(1, { duration: 300 });

      // Fetch data
      setLoading(true);
      setError(false);
      setData(null);

      supabase.functions
        .invoke('get-game-detail', {
          body: { type: itemType, id: itemId, sport: itemSport },
        })
        .then(({ data: result, error: err }) => {
          if (err || result?.error) {
            setError(true);
          } else {
            setData(result);
          }
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [visible, itemId, itemType, itemSport]);

  // Swipe down to dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 80) {
        runOnJS(closeSheet)();
      } else {
        translateY.value = withSpring(0, { damping: 25, stiffness: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleLogBetESPN = useCallback(() => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeSheet();
    setTimeout(() => {
      router.push({
        pathname: '/manual-add-bet',
        params: {
          sport: data.sport,
          matchup: `${data.awayTeam.name} vs ${data.homeTeam.name}`,
          date: data.startTime,
          platform: '',
        },
      });
    }, 300);
  }, [data, closeSheet, router]);

  const handleLogBetKalshi = useCallback(() => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeSheet();
    setTimeout(() => {
      router.push({
        pathname: '/manual-add-bet',
        params: {
          platform: 'Kalshi',
          matchup: data.title,
          description: data.subtitle || '',
          odds: `YES ${data.yesPrice}¢`,
          date: data.closeTime,
        },
      });
    }, 300);
  }, [data, closeSheet, router]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet}>
          <BlurView
            intensity={10}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          />
        </Pressable>
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              shadowOpacity: isDark ? 0.3 : 0.1,
            },
            sheetStyle,
          ]}
        >
          {/* Drag handle */}
          <View style={sheetStyles.handleContainer}>
            <View style={[sheetStyles.handle, { backgroundColor: `${colors.textTertiary}4D` }]} />
          </View>

          {/* Content */}
          {loading ? (
            <View style={sheetStyles.content}>
              <SkeletonBar width="60%" colors={colors} />
              <SkeletonBar width="80%" colors={colors} />
              <SkeletonBar width="40%" colors={colors} />
            </View>
          ) : error ? (
            <View style={sheetStyles.content}>
              <Text style={[sheetStyles.errorText, { color: colors.textSecondary }]}>
                Unable to load details. Try again later.
              </Text>
            </View>
          ) : data?.type === 'espn' ? (
            <ESPNDetailView data={data} colors={colors} onLogBet={handleLogBetESPN} />
          ) : data?.type === 'kalshi' ? (
            <KalshiDetailView data={data} colors={colors} isDark={isDark} onLogBet={handleLogBetKalshi} />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

// ── ESPN Detail View ──────────────────────────────────────────

function ESPNDetailView({
  data,
  colors,
  onLogBet,
}: {
  data: ESPNGameData;
  colors: ThemeColors;
  onLogBet: () => void;
}) {
  const isLive = data.status === 'in';
  const isFinal = data.status === 'post';
  const isPregame = data.status === 'pre';

  return (
    <View style={sheetStyles.content}>
      {/* Header: Away vs Home */}
      <View style={sheetStyles.teamsRow}>
        {/* Away team */}
        <View style={sheetStyles.teamSide}>
          <View style={[sheetStyles.teamCircle, { backgroundColor: data.awayTeam.color }]}>
            <Text style={sheetStyles.teamAbbr}>{data.awayTeam.abbreviation}</Text>
          </View>
          <Text style={[sheetStyles.teamName, { color: colors.text }]} numberOfLines={2}>
            {data.awayTeam.name}
          </Text>
          {data.awayTeam.record ? (
            <Text style={[sheetStyles.teamRecord, { color: colors.textSecondary }]}>
              {data.awayTeam.record}
            </Text>
          ) : null}
        </View>

        {/* Center: score or vs */}
        <View style={sheetStyles.centerSection}>
          {isPregame ? (
            <Text style={[sheetStyles.vsText, { color: colors.textTertiary }]}>vs</Text>
          ) : (
            <Text style={[sheetStyles.scoreText, { color: colors.text }]}>
              {data.awayTeam.score} - {data.homeTeam.score}
            </Text>
          )}
          <View style={sheetStyles.statusDetailRow}>
            {isLive && <LiveDot />}
            <Text
              style={[
                sheetStyles.statusDetailText,
                {
                  color: isLive
                    ? '#2DC672'
                    : isFinal
                      ? colors.textSecondary
                      : colors.textTertiary,
                },
              ]}
            >
              {data.statusDetail}
            </Text>
          </View>
        </View>

        {/* Home team */}
        <View style={sheetStyles.teamSide}>
          <View style={[sheetStyles.teamCircle, { backgroundColor: data.homeTeam.color }]}>
            <Text style={sheetStyles.teamAbbr}>{data.homeTeam.abbreviation}</Text>
          </View>
          <Text style={[sheetStyles.teamName, { color: colors.text }]} numberOfLines={2}>
            {data.homeTeam.name}
          </Text>
          {data.homeTeam.record ? (
            <Text style={[sheetStyles.teamRecord, { color: colors.textSecondary }]}>
              {data.homeTeam.record}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Info row */}
      {(data.venue || data.broadcast) && (
        <View style={sheetStyles.infoRow}>
          {data.venue ? (
            <View style={sheetStyles.infoItem}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={[sheetStyles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {data.venue}
              </Text>
            </View>
          ) : null}
          {data.venue && data.broadcast ? (
            <Text style={[sheetStyles.infoDot, { color: colors.textSecondary }]}> · </Text>
          ) : null}
          {data.broadcast ? (
            <View style={sheetStyles.infoItem}>
              <Ionicons name="tv-outline" size={13} color={colors.textSecondary} />
              <Text style={[sheetStyles.infoText, { color: colors.textSecondary }]}>
                {data.broadcast}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Leaders */}
      {data.leaders && data.leaders.length > 0 && (
        <View style={sheetStyles.leadersSection}>
          <Text style={[sheetStyles.leadersTitle, { color: colors.text }]}>Game Leaders</Text>
          {data.leaders.map((leader, i) => (
            <View key={i} style={sheetStyles.leaderRow}>
              <Text style={[sheetStyles.leaderCategory, { color: colors.textSecondary }]}>
                {leader.category}
              </Text>
              <Text style={[sheetStyles.leaderValue, { color: colors.text }]}>
                {leader.playerName} — {leader.displayValue}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Log Bet button */}
      <AnimatedPressable
        style={sheetStyles.logBetButton}
        onPress={onLogBet}
        scaleDown={0.96}
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text style={sheetStyles.logBetText}>Log Bet on This Game</Text>
      </AnimatedPressable>
    </View>
  );
}

// ── Kalshi Detail View ────────────────────────────────────────

function KalshiDetailView({
  data,
  colors,
  isDark,
  onLogBet,
}: {
  data: KalshiMarketData;
  colors: ThemeColors;
  isDark: boolean;
  onLogBet: () => void;
}) {
  const catColor = getCategoryColor(data.category ?? '');
  const yesWidth = Math.max(data.yesPrice, 5);
  const noWidth = Math.max(data.noPrice, 5);

  return (
    <View style={sheetStyles.content}>
      {/* Title */}
      <Text style={[sheetStyles.kalshiTitle, { color: colors.text }]}>{data.title}</Text>
      {data.subtitle ? (
        <Text style={[sheetStyles.kalshiSubtitle, { color: colors.textSecondary }]}>
          {data.subtitle}
        </Text>
      ) : null}

      {/* Category badge */}
      {data.category ? (
        <View
          style={[
            sheetStyles.categoryBadge,
            { backgroundColor: `${catColor}1F` },
          ]}
        >
          <Text style={[sheetStyles.categoryBadgeText, { color: catColor }]}>
            {data.category}
          </Text>
        </View>
      ) : null}

      {/* Probability bar */}
      <View style={sheetStyles.probBar}>
        <View
          style={[
            sheetStyles.probYes,
            {
              width: `${yesWidth}%` as any,
              backgroundColor: '#2DC672',
            },
          ]}
        >
          <Text style={sheetStyles.probYesText}>YES {data.yesPrice}¢</Text>
        </View>
        <View
          style={[
            sheetStyles.probNo,
            {
              width: `${noWidth}%` as any,
              backgroundColor: 'rgba(232, 93, 93, 0.3)',
            },
          ]}
        >
          <Text style={[sheetStyles.probNoText, { color: colors.loss }]}>NO {data.noPrice}¢</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={sheetStyles.statsRow}>
        <View style={sheetStyles.statCol}>
          <Text style={[sheetStyles.statLabel, { color: colors.textTertiary }]}>VOLUME</Text>
          <Text style={[sheetStyles.statValue, { color: colors.text }]}>{formatNumber(data.volume ?? 0)}</Text>
        </View>
        <View style={sheetStyles.statCol}>
          <Text style={[sheetStyles.statLabel, { color: colors.textTertiary }]}>24H VOL</Text>
          <Text style={[sheetStyles.statValue, { color: colors.text }]}>{formatNumber(data.volume24h ?? 0)}</Text>
        </View>
        <View style={sheetStyles.statCol}>
          <Text style={[sheetStyles.statLabel, { color: colors.textTertiary }]}>OPEN INTEREST</Text>
          <Text style={[sheetStyles.statValue, { color: colors.text }]}>{formatNumber(data.openInterest ?? 0)}</Text>
        </View>
      </View>

      {/* Close time */}
      {data.closeTime ? (
        <View style={sheetStyles.closeTimeRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={[sheetStyles.closeTimeText, { color: colors.textSecondary }]}>
            Closes: {formatCloseTime(data.closeTime)}
          </Text>
        </View>
      ) : null}

      {/* Log Bet button */}
      <AnimatedPressable
        style={sheetStyles.logBetButton}
        onPress={onLogBet}
        scaleDown={0.96}
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text style={sheetStyles.logBetText}>Log Bet on This Market</Text>
      </AnimatedPressable>
    </View>
  );
}

// ── Live Dot (reused from LiveScoresTicker pattern) ───────────

function LiveDot() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#2DC672',
          marginRight: 4,
        },
        style,
      ]}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 20,
    elevation: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // ESPN teams header
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  teamSide: {
    flex: 1,
    alignItems: 'center',
  },
  teamCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  teamAbbr: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamRecord: {
    fontSize: 12,
    marginTop: 2,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  vsText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '800',
  },
  statusDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDetailText: {
    fontSize: 13,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
  },
  infoDot: {
    fontSize: 12,
  },

  // Leaders
  leadersSection: {
    marginTop: 16,
    marginBottom: 4,
  },
  leadersTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  leaderCategory: {
    fontSize: 12,
  },
  leaderValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Log bet button
  logBetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2DC672',
    marginTop: 20,
  },
  logBetText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Kalshi
  kalshiTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  kalshiSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  probBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  probYes: {
    justifyContent: 'center',
    paddingLeft: 8,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  probYesText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  probNo: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  probNoText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  closeTimeText: {
    fontSize: 13,
  },
});
