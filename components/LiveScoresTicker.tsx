import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  AppState,
  AppStateStatus,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { fetchAllScores, SPORTS, type Game, type SportFilter } from '@/lib/fetchScores';

const COLLAPSED_HEIGHT = 52;
const EXPANDED_HEIGHT = 340;
const POLL_INTERVAL = 30_000;

// ─── Pulsing red dot for live games ──────────────────────────────────
function LiveDot() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 4 },
        style,
      ]}
    />
  );
}

// ─── Skeleton shimmer for loading state ──────────────────────────────
function SkeletonBar({ width, colors }: { width: number; colors: any }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width, height: 14, borderRadius: 7, backgroundColor: colors.border, marginRight: 16 },
        style,
      ]}
    />
  );
}

// ─── Collapsed ticker row (Reanimated translateX, no ScrollView) ─────
function TickerStrip({ games, colors }: { games: Game[]; colors: any }) {
  const translateX = useSharedValue(0);
  const contentWidth = useRef(0);

  const startAnimation = useCallback((w: number) => {
    if (w <= 0) return;
    cancelAnimation(translateX);
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(-w, { duration: w * 25, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== contentWidth.current) {
      contentWidth.current = w;
      startAnimation(w);
    }
  }, [startAnimation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const items = games.map((g) => {
    const isLive = g.status === 'in';
    const isFinal = g.status === 'post';
    const scoreText =
      g.status === 'pre'
        ? `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`
        : `${g.awayTeam.abbreviation} ${g.awayTeam.score} - ${g.homeTeam.abbreviation} ${g.homeTeam.score}`;
    const statusText = g.statusDetail;

    return (
      <View key={g.id} style={stripStyles.item}>
        {isLive && <LiveDot />}
        <Text style={[stripStyles.score, { color: colors.text }]} numberOfLines={1}>
          {scoreText}
        </Text>
        <Text
          style={[
            stripStyles.status,
            {
              color: isLive ? '#EF4444' : isFinal ? colors.textTertiary : colors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {statusText}
        </Text>
        <View style={[stripStyles.divider, { backgroundColor: `${colors.border}4D` }]} />
      </View>
    );
  });

  return (
    <View style={stripStyles.container} pointerEvents="none">
      <Animated.View style={[stripStyles.row, animStyle]} pointerEvents="none">
        <View onLayout={handleLayout} style={stripStyles.row} pointerEvents="none">
          {items}
        </View>
        <View style={stripStyles.row} pointerEvents="none">
          {items}
        </View>
      </Animated.View>
    </View>
  );
}

const stripStyles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  score: { fontSize: 13, fontWeight: '600', marginRight: 6 },
  status: { fontSize: 11, fontWeight: '500', marginRight: 6 },
  divider: { width: 1, height: 16, marginLeft: 4 },
});

// ─── Expanded game card ──────────────────────────────────────────────
function GameCard({
  game,
  colors,
  onPress,
}: {
  game: Game;
  colors: any;
  onPress?: () => void;
}) {
  const isLive = game.status === 'in';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        cardStyles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: isLive ? colors.accent : colors.border,
          borderLeftWidth: isLive ? 3 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Away team */}
      <View style={cardStyles.teamRow}>
        <Image source={{ uri: game.awayTeam.logo }} style={cardStyles.logo} />
        <Text style={[cardStyles.abbr, { color: colors.text }]}>{game.awayTeam.abbreviation}</Text>
        <Text style={[cardStyles.teamScore, { color: colors.text }]}>
          {game.status !== 'pre' ? game.awayTeam.score : ''}
        </Text>
      </View>
      {/* Home team */}
      <View style={cardStyles.teamRow}>
        <Image source={{ uri: game.homeTeam.logo }} style={cardStyles.logo} />
        <Text style={[cardStyles.abbr, { color: colors.text }]}>{game.homeTeam.abbreviation}</Text>
        <Text style={[cardStyles.teamScore, { color: colors.text }]}>
          {game.status !== 'pre' ? game.homeTeam.score : ''}
        </Text>
      </View>
      {/* Status */}
      <View style={cardStyles.statusRow}>
        {isLive && <LiveDot />}
        <Text
          style={[
            cardStyles.statusText,
            {
              color: isLive ? '#EF4444' : game.status === 'post' ? colors.textTertiary : colors.textSecondary,
            },
          ]}
        >
          {game.statusDetail}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  logo: { width: 20, height: 20, borderRadius: 10 },
  abbr: { fontSize: 13, fontWeight: '700', width: 42 },
  teamScore: { fontSize: 15, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
    justifyContent: 'flex-end',
  },
  statusText: { fontSize: 11, fontWeight: '600' },
});

// ─── Main component ──────────────────────────────────────────────────
interface LiveScoresTickerProps {
  onGamePress?: (gameId: string, sport: string) => void;
}

export default function LiveScoresTicker({ onGamePress }: LiveScoresTickerProps) {
  const { colors } = useTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sportFilter, setSportFilter] = useState<SportFilter>('All');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated height + content opacity
  const animHeight = useSharedValue(COLLAPSED_HEIGHT);
  const contentOpacity = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));
  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchAllScores();
      setGames(data);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();

    const startPoll = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchData, POLL_INTERVAL);
    };
    startPoll();

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        fetchData();
        startPoll();
      } else {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      sub.remove();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  // Expand / collapse
  const toggle = useCallback(() => {
    Haptics.selectionAsync();
    const next = !expanded;
    setExpanded(next);
    if (next) {
      animHeight.value = withSpring(EXPANDED_HEIGHT, { damping: 18, stiffness: 140 });
      contentOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
    } else {
      contentOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(COLLAPSED_HEIGHT, { duration: 250, easing: Easing.out(Easing.cubic) });
      setSportFilter('All');
    }
  }, [expanded]);

  // ─── Render guards ───────────────────────────────────────────────
  if (failed && !loading && games.length === 0) return null;
  if (!loading && games.length === 0) return null;

  const filteredGames =
    sportFilter === 'All' ? games : games.filter((g) => g.sport === sportFilter);
  const liveSports = [...new Set(games.filter((g) => g.status === 'in').map((g) => g.sport))];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          overflow: 'hidden',
          borderRadius: 12,
          backgroundColor: colors.surface,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        },
        containerStyle,
      ]}
    >
      {/* ── Collapsed ticker bar ── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggle}
        style={[
          styles.collapsedBar,
          { borderBottomColor: expanded ? colors.border : 'transparent' },
        ]}
      >
        {/* Sport pills */}
        {liveSports.length > 0 && (
          <View style={styles.sportPills}>
            {liveSports.slice(0, 3).map((s) => (
              <View key={s} style={[styles.sportPill, { backgroundColor: `${colors.accent}18` }]}>
                <Text style={[styles.sportPillText, { color: colors.accent }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.skeletonRow}>
            <SkeletonBar width={100} colors={colors} />
            <SkeletonBar width={80} colors={colors} />
            <SkeletonBar width={110} colors={colors} />
          </View>
        ) : (
          <TickerStrip games={games} colors={colors} />
        )}

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textTertiary}
          style={{ marginLeft: 6, marginRight: 4 }}
        />
      </TouchableOpacity>

      {/* ── Expanded content ── */}
      {expanded && (
        <Animated.View style={[styles.expandedContent, expandedContentStyle]}>
          {/* Sport filter chips */}
          <View style={styles.chipRow}>
            {SPORTS.map((s) => {
              const active = sportFilter === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSportFilter(s);
                  }}
                  activeOpacity={0.7}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.accent : 'transparent',
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Game list */}
          <ScrollView
            style={styles.gameList}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            bounces
          >
            {filteredGames.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No {sportFilter} games today
              </Text>
            ) : (
              filteredGames.slice(0, 6).map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  colors={colors}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onGamePress?.(game.id, game.sport);
                  }}
                />
              ))
            )}
          </ScrollView>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  collapsedBar: {
    height: COLLAPSED_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sportPills: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  sportPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skeletonRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gameList: { maxHeight: 260 },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
