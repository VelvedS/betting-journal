import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  withRepeat,
  interpolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePreferences } from '@/context/PreferencesContext';
import { formatCurrency, formatROI } from '@/lib/formatters';
import {
  WhatIfFilters,
  SimulationResult,
  FilterOptions,
  fetchWhatIfData,
  computeSimulation,
} from '@/lib/whatIfEngine';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import SkeletonLoader from '@/components/SkeletonLoader';
import * as Haptics from 'expo-haptics';

// ── Constants ──

const CHART_HEIGHT = 200;
const AMBER = '#F59E0B';
const GREEN = '#2DC672';
const RED = '#E85D5D';
const BLUE = '#3B82F6';
const PURPLE = '#8B5CF6';

const REASONING_LABELS: Record<string, string> = {
  stats: 'Stats',
  value: 'Value',
  gut_feel: 'Gut Feel',
  revenge: 'Revenge',
  fade: 'Fade',
  tail: 'Tail',
  system: 'System',
  hedge: 'Hedge',
};

type PresetConfig = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const PRESETS: PresetConfig[] = [
  { id: 'no-parlays', label: 'No Parlays', description: 'Remove all parlay bets', icon: 'close-circle-outline', color: RED },
  { id: 'no-revenge', label: 'No Revenge Bets', description: 'Cut emotion-driven wagers', icon: 'flame-outline', color: AMBER },
  { id: 'high-conf', label: 'High Confidence', description: 'Only 4\u2605 and 5\u2605 rated bets', icon: 'star-outline', color: GREEN },
  { id: 'nba-only', label: 'NBA Only', description: 'Isolate basketball performance', icon: 'basketball-outline', color: BLUE },
  { id: 'spreads-only', label: 'Spreads Only', description: 'Only spread bet types', icon: 'grid-outline', color: GREEN },
  { id: 'value-only', label: 'Value Bets Only', description: 'Only value-tagged reasoning', icon: 'diamond-outline', color: PURPLE },
];

// ── Helpers ──

function formatBetType(type: string): string {
  if (type === 'over_under') return 'Over/Under';
  if (type === 'moneyline') return 'Moneyline';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatYLabel(value: number): string {
  const absVal = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absVal >= 1000) return `${sign}$${(absVal / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}$${Math.round(absVal)}`;
}

function getDefaultFilters(options: FilterOptions): WhatIfFilters {
  return {
    betTypes: [...options.betTypes],
    sports: [...options.sports],
    sportsbooks: [...options.sportsbooks],
    confidenceLevels: [1, 2, 3, 4, 5],
    reasoningTags: [...options.reasoningTags],
    includeUntagged: true,
    minOdds: null,
    maxOdds: null,
  };
}

function applyPreset(presetId: string, options: FilterOptions): WhatIfFilters {
  const base = getDefaultFilters(options);
  switch (presetId) {
    case 'no-parlays':
      return { ...base, betTypes: base.betTypes.filter((t) => !t.toLowerCase().includes('parlay')) };
    case 'no-revenge':
      return { ...base, reasoningTags: base.reasoningTags.filter((t) => t !== 'revenge') };
    case 'high-conf':
      return { ...base, confidenceLevels: [4, 5], includeUntagged: false };
    case 'spreads-only':
      return { ...base, betTypes: base.betTypes.filter((t) => t.toLowerCase().includes('spread')) };
    case 'nba-only':
      return { ...base, sports: base.sports.filter((s) => s.toLowerCase().includes('nba')) };
    case 'value-only':
      return { ...base, reasoningTags: base.reasoningTags.filter((t) => t === 'value'), includeUntagged: false };
    default:
      return base;
  }
}

function buildPath(
  timeline: Array<{ cumulativePL: number }>,
  width: number,
  height: number,
  yMin: number,
  yRange: number,
): string {
  if (timeline.length === 0) return '';
  const padTop = 12;
  const padBot = 8;
  const h = height - padTop - padBot;
  return timeline
    .map((d, i) => {
      const x = timeline.length > 1 ? (i / (timeline.length - 1)) * width : width / 2;
      const y = padTop + h - ((d.cumulativePL - yMin) / yRange) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildFillPath(
  timeline: Array<{ cumulativePL: number }>,
  width: number,
  height: number,
  yMin: number,
  yRange: number,
): string {
  if (timeline.length === 0) return '';
  const linePath = buildPath(timeline, width, height, yMin, yRange);
  const lastX = timeline.length > 1 ? width : width / 2;
  const firstX = timeline.length > 1 ? 0 : width / 2;
  return `${linePath} L${lastX.toFixed(1)},${height.toFixed(1)} L${firstX.toFixed(1)},${height.toFixed(1)} Z`;
}

// ── Skeleton components ──

function ChartSkeleton({ colors }: { colors: any }) {
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
    <Animated.View style={[{ height: CHART_HEIGHT, borderRadius: 8, backgroundColor: colors.surface }, style]} />
  );
}

function StatSkeleton({ colors }: { colors: any }) {
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
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 10,
          height: 80,
        },
        style,
      ]}
    >
      <View style={{ width: 80, height: 10, borderRadius: 5, backgroundColor: colors.border, marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: 60, height: 20, borderRadius: 6, backgroundColor: colors.border }} />
        <View style={{ width: 60, height: 20, borderRadius: 6, backgroundColor: colors.border }} />
      </View>
    </Animated.View>
  );
}

// ── Main Component ──

export default function WhatIfScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { currency, showBalance } = usePreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bets, setBets] = useState<any[]>([]);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<WhatIfFilters | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  // Animation values
  const customHeight = useSharedValue(0);
  const resultsTranslateY = useSharedValue(20);
  const resultsOpacity = useSharedValue(0);
  const hasShownResults = useRef(false);


  // Fetch data on mount — auto-select "No Parlays"
  useEffect(() => {
    if (!user) return;
    fetchWhatIfData(user.id).then(({ bets: b, options: o }) => {
      setBets(b);
      setOptions(o);
      setLoading(false);
      if (b.length >= 10) {
        setActivePreset('no-parlays');
        setFilters(applyPreset('no-parlays', o));
      }
    });
  }, [user]);

  // Debounced simulation on filter change
  useEffect(() => {
    if (!filters || bets.length === 0) return;
    setComputing(true);
    const timer = setTimeout(() => {
      const res = computeSimulation(bets, filters);
      setResult(res);
      setComputing(false);
      if (!hasShownResults.current) {
        hasShownResults.current = true;
        resultsOpacity.value = withTiming(1, { duration: 400 });
        resultsTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [filters, bets]);

  // Custom filters expand/collapse animation
  const customAnimStyle = useAnimatedStyle(() => ({
    height: customHeight.value,
    overflow: 'hidden' as const,
    opacity: interpolate(customHeight.value, [0, 50], [0, 1]),
  }));

  const resultsAnimStyle = useAnimatedStyle(() => ({
    opacity: resultsOpacity.value,
    transform: [{ translateY: resultsTranslateY.value }],
  }));


  // ── Handlers ──

  const handlePreset = useCallback(
    (presetId: string) => {
      if (!options) return;
      Haptics.selectionAsync();
      if (activePreset === presetId) {
        setActivePreset(null);
        setFilters(null);
        setResult(null);
        hasShownResults.current = false;
        resultsOpacity.value = 0;
        resultsTranslateY.value = 20;
      } else {
        setActivePreset(presetId);
        setCustomOpen(false);
        customHeight.value = withTiming(0, { duration: 250 });
        setFilters(applyPreset(presetId, options));
      }
    },
    [options, activePreset],
  );

  const toggleCustomFilters = useCallback(() => {
    Haptics.selectionAsync();
    const opening = !customOpen;
    setCustomOpen(opening);
    if (opening && options && !filters) {
      setFilters(getDefaultFilters(options));
    }
    customHeight.value = withTiming(opening ? 400 : 0, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [customOpen, options, filters]);

  const toggleArrayFilter = useCallback(
    (key: 'betTypes' | 'sports' | 'sportsbooks' | 'reasoningTags', value: string) => {
      if (!filters || !options) return;
      Haptics.selectionAsync();
      setActivePreset(null);
      const arr = filters[key];
      const updated = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      setFilters({ ...filters, [key]: updated });
    },
    [filters, options],
  );

  const toggleConfidence = useCallback(
    (level: number) => {
      if (!filters) return;
      Haptics.selectionAsync();
      setActivePreset(null);
      const arr = filters.confidenceLevels;
      const updated = arr.includes(level) ? arr.filter((v) => v !== level) : [...arr, level];
      setFilters({ ...filters, confidenceLevels: updated });
    },
    [filters],
  );

  const toggleUntagged = useCallback(() => {
    if (!filters) return;
    Haptics.selectionAsync();
    setActivePreset(null);
    setFilters({ ...filters, includeUntagged: !filters.includeUntagged });
  }, [filters]);

  const getValueColor = (v: number) => (v >= 0 ? GREEN : RED);

  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  // ── Chart data ──

  const chartData = useMemo(() => {
    if (!result || chartWidth <= 0) return null;
    const all = [
      ...result.actualTimeline.map((d) => d.cumulativePL),
      ...result.simulatedTimeline.map((d) => d.cumulativePL),
      0,
    ];
    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);
    const yPad = Math.max((rawMax - rawMin) * 0.1, 20);
    const yMin = rawMin - yPad;
    const yMax = rawMax + yPad;
    const yRange = yMax - yMin || 1;

    const actualD = buildPath(result.actualTimeline, chartWidth, CHART_HEIGHT, yMin, yRange);
    const simD = buildPath(result.simulatedTimeline, chartWidth, CHART_HEIGHT, yMin, yRange);
    const fillD = buildFillPath(result.actualTimeline, chartWidth, CHART_HEIGHT, yMin, yRange);

    // Y labels
    const labelCount = 4;
    const yLabels = Array.from({ length: labelCount }, (_, i) => {
      const val = yMin + yRange * (i / (labelCount - 1));
      const padTop = 12;
      const padBot = 8;
      const h = CHART_HEIGHT - padTop - padBot;
      const y = padTop + h - ((val - yMin) / yRange) * h;
      return { label: formatYLabel(val), y };
    });

    // X labels — smart formatting: use "Mon Day" if all in same month, deduplicate
    const tl = result.actualTimeline;
    if (!tl || tl.length < 2) return { actualD: '', simD: '', fillD: '', yLabels: [], xLabels: [] };
    const xCount = Math.min(4, tl.length);
    let xLabels: Array<{ label: string; x: number }> = [];

    if (xCount > 1) {
      const firstDate = new Date(tl[0].date + 'T00:00:00');
      const lastDate = new Date(tl[tl.length - 1].date + 'T00:00:00');
      const sameMonth =
        firstDate.getMonth() === lastDate.getMonth() &&
        firstDate.getFullYear() === lastDate.getFullYear();

      const rawLabels = Array.from({ length: xCount }, (_, i) => {
        const idx = Math.round((i * (tl.length - 1)) / (xCount - 1));
        const d = new Date(tl[idx].date + 'T00:00:00');
        const label = sameMonth
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : d.toLocaleDateString('en-US', { month: 'short' });
        return { label, x: (idx / (tl.length - 1)) * chartWidth };
      });

      // Deduplicate consecutive labels
      xLabels = rawLabels.filter((item, i) => i === 0 || item.label !== rawLabels[i - 1].label);
    }

    return { actualD, simD, fillD, yLabels, xLabels };
  }, [result, chartWidth]);

  // ── Difference banner data ──
  const diffData = useMemo(() => {
    if (!result) return null;
    const diff = result.difference.plDifference;
    if (diff > 0) {
      return {
        text: `\u2191 You'd be ${formatCurrency(Math.abs(diff), currency, true)} MORE profitable`,
        bgColor: GREEN + '14',
        textColor: GREEN,
      };
    } else if (diff < 0) {
      return {
        text: `\u2193 You'd lose ${formatCurrency(Math.abs(diff), currency, true)} in profit`,
        bgColor: RED + '14',
        textColor: RED,
      };
    }
    return {
      text: "No difference \u2014 this filter doesn't change your results",
      bgColor: colors.border + '40',
      textColor: colors.textSecondary,
    };
  }, [result, currency, colors]);

  // ── Ticker pill renderer ──
  const renderTickerPills = (keyPrefix: string) =>
    PRESETS.map((preset) => {
      const active = activePreset === preset.id;
      return (
        <AnimatedPressable
          key={`${keyPrefix}-${preset.id}`}
          style={[
            styles.tickerPill,
            active && styles.tickerPillActive,
          ]}
          onPress={() => handlePreset(preset.id)}
          scaleDown={0.97}
        >
          <Ionicons
            name={preset.icon}
            size={20}
            color={active ? '#FFFFFF' : preset.color}
          />
          <Text
            style={[styles.tickerPillText, active && styles.tickerPillTextActive]}
            numberOfLines={1}
          >
            {preset.label}
          </Text>
        </AnimatedPressable>
      );
    });

  // ── Renders ──

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.headerArea}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>What-If Engine</Text>
          <Text style={styles.subtitle}>See how different strategies would have played out</Text>
        </View>
        <View style={styles.loadingWrap}>
          <SkeletonLoader width="100%" height={52} borderRadius={26} style={{ marginBottom: 10 }} />
          <SkeletonLoader width="100%" height={180} borderRadius={16} style={{ marginTop: 20 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (bets.length < 10) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.headerArea}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="git-branch-outline" size={56} color={colors.textTertiary} style={{ opacity: 0.4 }} />
          <Text style={styles.emptyTitle}>Not Enough Data Yet</Text>
          <Text style={styles.emptyDesc}>
            Log at least 10 settled bets to unlock the What-If Engine. The more bets you track, the more powerful these simulations become.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.headerArea}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>What-If Engine</Text>
            <Text style={styles.subtitle}>See how different strategies would have played out</Text>
          </View>
        </FadeInView>

        {/* ── Scenario Ticker ── */}
        <FadeInView delay={100} direction="bottom">
          <Text style={styles.scenarioLabel}>SIMULATE A SCENARIO</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tickerScrollContent}
            bounces
            style={styles.tickerContainer}
          >
            {renderTickerPills('p')}
          </ScrollView>

          {/* Custom Filters toggle */}
          <TouchableOpacity
            style={styles.customToggle}
            onPress={toggleCustomFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.customToggleText}>Custom Filters</Text>
            <Ionicons
              name={customOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.accent}
            />
          </TouchableOpacity>

          {/* Custom Filters panel */}
          <Animated.View style={customAnimStyle}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {options && filters && (
                <View style={styles.filtersInner}>
                  {options.betTypes.length > 0 && (
                    <View style={styles.filterGroup}>
                      <Text style={styles.filterCatLabel}>BET TYPE:</Text>
                      <View style={styles.chipRow}>
                        {options.betTypes.map((t) => {
                          const sel = filters.betTypes.includes(t);
                          return (
                            <TouchableOpacity
                              key={t}
                              style={[styles.chip, !sel && styles.chipDeselected]}
                              onPress={() => toggleArrayFilter('betTypes', t)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chipText, !sel && styles.chipTextDeselected]}>
                                {formatBetType(t)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {options.sports.length > 0 && (
                    <View style={styles.filterGroup}>
                      <Text style={styles.filterCatLabel}>SPORT:</Text>
                      <View style={styles.chipRow}>
                        {options.sports.map((s) => {
                          const sel = filters.sports.includes(s);
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[styles.chip, !sel && styles.chipDeselected]}
                              onPress={() => toggleArrayFilter('sports', s)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chipText, !sel && styles.chipTextDeselected]}>{s}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {options.sportsbooks.length > 0 && (
                    <View style={styles.filterGroup}>
                      <Text style={styles.filterCatLabel}>SPORTSBOOK:</Text>
                      <View style={styles.chipRow}>
                        {options.sportsbooks.map((b) => {
                          const sel = filters.sportsbooks.includes(b);
                          return (
                            <TouchableOpacity
                              key={b}
                              style={[styles.chip, !sel && styles.chipDeselected]}
                              onPress={() => toggleArrayFilter('sportsbooks', b)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chipText, !sel && styles.chipTextDeselected]}>{b}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterCatLabel}>CONFIDENCE:</Text>
                    <View style={styles.chipRow}>
                      {[1, 2, 3, 4, 5].map((lv) => {
                        const sel = filters.confidenceLevels.includes(lv);
                        return (
                          <TouchableOpacity
                            key={lv}
                            style={[styles.chip, !sel && styles.chipDeselected]}
                            onPress={() => toggleConfidence(lv)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.chipText, !sel && styles.chipTextDeselected]}>
                              {lv}{'\u2605'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={[styles.chip, !filters.includeUntagged && styles.chipDeselected]}
                        onPress={toggleUntagged}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, !filters.includeUntagged && styles.chipTextDeselected]}>
                          Untagged
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {options.reasoningTags.length > 0 && (
                    <View style={styles.filterGroup}>
                      <Text style={styles.filterCatLabel}>REASONING:</Text>
                      <View style={styles.chipRow}>
                        {options.reasoningTags.map((tag) => {
                          const sel = filters.reasoningTags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              style={[styles.chip, !sel && styles.chipDeselected]}
                              onPress={() => toggleArrayFilter('reasoningTags', tag)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chipText, !sel && styles.chipTextDeselected]}>
                                {REASONING_LABELS[tag] || tag}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </FadeInView>

        {/* ── Results Section ── */}
        {!result && !computing && !activePreset && (
          <FadeInView delay={200} direction="bottom">
            <View style={styles.placeholder}>
              <Ionicons name="git-branch-outline" size={48} color={colors.textTertiary} style={{ opacity: 0.3 }} />
              <Text style={styles.placeholderText}>
                Select a scenario above to see how your results would change
              </Text>
            </View>
          </FadeInView>
        )}

        {computing && !result && (
          <FadeInView delay={0} direction="bottom">
            <View style={{ marginTop: 20 }}>
              <ChartSkeleton colors={colors} />
              <View style={{ marginTop: 16 }}>
                <StatSkeleton colors={colors} />
                <StatSkeleton colors={colors} />
                <StatSkeleton colors={colors} />
              </View>
            </View>
          </FadeInView>
        )}

        {result && (
          <Animated.View style={resultsAnimStyle}>
            {/* ── Comparison Hero Card ── */}
            <FadeInView delay={0} direction="bottom">
              <View style={styles.heroCard}>
                {/* Actual column */}
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>ACTUAL</Text>
                  <Text
                    style={[styles.heroValue, { color: getValueColor(result.actualSummary.netPL) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {showBalance
                      ? (result.actualSummary.netPL >= 0 ? '+' : '') + formatCurrency(result.actualSummary.netPL, currency, true)
                      : '\u2022\u2022\u2022\u2022'}
                  </Text>
                  <Text style={styles.heroRoi}>
                    {showBalance ? formatROI(result.actualSummary.roi) + ' ROI' : '\u2022\u2022 ROI'}
                  </Text>
                  <Text style={styles.heroRecord}>
                    {result.actualSummary.wins}-{result.actualSummary.losses}
                  </Text>
                </View>

                {/* Center arrow */}
                <View style={styles.heroCenter}>
                  {result.difference.plDifference > 0 ? (
                    <Ionicons name="arrow-forward-outline" size={22} color={GREEN} />
                  ) : result.difference.plDifference < 0 ? (
                    <Ionicons name="arrow-forward-outline" size={22} color={RED} />
                  ) : (
                    <Text style={[styles.heroEquals, { color: colors.textTertiary }]}>=</Text>
                  )}
                </View>

                {/* What-If column */}
                <View style={[styles.heroCol, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.heroLabel, { color: AMBER }]}>WHAT-IF</Text>
                  <Text
                    style={[styles.heroValue, { color: AMBER }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {showBalance
                      ? (result.simulatedSummary.netPL >= 0 ? '+' : '') + formatCurrency(result.simulatedSummary.netPL, currency, true)
                      : '\u2022\u2022\u2022\u2022'}
                  </Text>
                  <Text style={[styles.heroRoi, { textAlign: 'right' }]}>
                    {showBalance ? formatROI(result.simulatedSummary.roi) + ' ROI' : '\u2022\u2022 ROI'}
                  </Text>
                  <Text style={[styles.heroRecord, { textAlign: 'right' }]}>
                    {result.simulatedSummary.wins}-{result.simulatedSummary.losses}
                  </Text>
                </View>
              </View>
            </FadeInView>

            {/* ── Difference Banner ── */}
            {diffData && (
              <FadeInView delay={100} direction="bottom">
                <View style={[styles.diffBanner, { backgroundColor: diffData.bgColor }]}>
                  <Text style={[styles.diffText, { color: diffData.textColor }]}>
                    {showBalance ? diffData.text : 'Balance hidden'}
                  </Text>
                </View>
              </FadeInView>
            )}

            {/* ── Chart Card ── */}
            <FadeInView delay={200} direction="bottom">
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>PERFORMANCE COMPARISON</Text>

                {computing && (
                  <Text style={styles.recalcText}>Recalculating...</Text>
                )}

                <View style={styles.chartLayout}>
                  {/* Y-axis labels */}
                  {chartData && (
                    <View style={styles.yAxisCol}>
                      {chartData.yLabels.map((yl, i) => (
                        <Text
                          key={i}
                          style={[styles.yLabel, { position: 'absolute', top: yl.y - 6 }]}
                        >
                          {showBalance ? yl.label : '\u2022\u2022'}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* SVG chart */}
                  <View style={styles.chartArea} onLayout={onChartLayout}>
                    {chartWidth > 0 && chartData && (
                      <Svg width={chartWidth} height={CHART_HEIGHT}>
                        <Defs>
                          <LinearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={GREEN} stopOpacity="0.12" />
                            <Stop offset="1" stopColor={GREEN} stopOpacity="0.01" />
                          </LinearGradient>
                        </Defs>

                        {/* Horizontal grid lines */}
                        {chartData.yLabels.map((yl, i) => (
                          <Line
                            key={i}
                            x1={0}
                            y1={yl.y}
                            x2={chartWidth}
                            y2={yl.y}
                            stroke={colors.border}
                            strokeWidth={0.5}
                            strokeOpacity={0.2}
                          />
                        ))}

                        {/* Fill area under actual line */}
                        <Path d={chartData.fillD} fill="url(#actualFill)" />

                        {/* Actual line */}
                        <Path
                          d={chartData.actualD}
                          fill="none"
                          stroke={GREEN}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Simulated line (dashed) */}
                        <Path
                          d={chartData.simD}
                          fill="none"
                          stroke={AMBER}
                          strokeWidth={2}
                          strokeDasharray="8,5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    )}

                    {/* X-axis labels */}
                    {chartData && (
                      <View style={styles.xAxisRow}>
                        {chartData.xLabels.map((xl, i) => (
                          <Text
                            key={i}
                            style={[styles.xLabel, { position: 'absolute', left: xl.x - 16 }]}
                          >
                            {xl.label}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Initial layout capture when no data */}
                    {!chartData && <View style={{ height: CHART_HEIGHT }} />}
                  </View>
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
                    <Text style={styles.legendText}>Actual</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: AMBER }]} />
                    <Text style={styles.legendText}>What-If</Text>
                  </View>
                </View>
              </View>
            </FadeInView>

            {/* ── Breakdown Cards ── */}
            <FadeInView delay={300} direction="bottom">
              {/* Card 1: Bets Analyzed */}
              <View style={styles.breakdownCard}>
                <View style={styles.breakdownColumns}>
                  <View style={styles.breakdownCol}>
                    <Text style={styles.breakdownColLabel}>Actual</Text>
                    <Text style={styles.breakdownColValue}>
                      {result.actualSummary.totalBets} bets
                    </Text>
                  </View>
                  <View style={styles.breakdownDivider} />
                  <View style={[styles.breakdownCol, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.breakdownColLabel, { color: AMBER }]}>What-If</Text>
                    <Text style={[styles.breakdownColValue, { color: AMBER }]}>
                      {result.simulatedSummary.totalBets} bets
                    </Text>
                  </View>
                </View>
                <Text style={styles.breakdownFooter}>
                  {result.difference.betsRemoved > 0
                    ? `${result.difference.betsRemoved} bets removed by this filter`
                    : 'No bets removed'}
                </Text>
              </View>

              {/* Card 2: Net Profit/Loss */}
              <View style={styles.breakdownCard}>
                <View style={styles.breakdownColumns}>
                  <View style={styles.breakdownCol}>
                    <Text style={styles.breakdownColLabel}>Net Profit/Loss</Text>
                    <Text
                      style={[styles.breakdownColValue, { color: getValueColor(result.actualSummary.netPL) }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {showBalance ? formatCurrency(result.actualSummary.netPL, currency, true) : '\u2022\u2022\u2022\u2022'}
                    </Text>
                  </View>
                  <View style={styles.breakdownDivider} />
                  <View style={[styles.breakdownCol, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.breakdownColLabel, { color: AMBER }]}>What-If</Text>
                    <Text
                      style={[styles.breakdownColValue, { color: AMBER }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {showBalance ? formatCurrency(result.simulatedSummary.netPL, currency, true) : '\u2022\u2022\u2022\u2022'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.breakdownFooter,
                    { color: getValueColor(result.difference.plDifference) },
                  ]}
                >
                  {showBalance
                    ? `Difference: ${result.difference.plDifference >= 0 ? '+' : ''}${formatCurrency(result.difference.plDifference, currency, true)}`
                    : '\u2022\u2022\u2022\u2022'}
                </Text>
              </View>

              {/* Card 3: ROI */}
              <View style={styles.breakdownCard}>
                <View style={styles.breakdownColumns}>
                  <View style={styles.breakdownCol}>
                    <Text style={styles.breakdownColLabel}>Return on Investment</Text>
                    <Text
                      style={[styles.breakdownColValue, { color: getValueColor(result.actualSummary.roi) }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {showBalance ? formatROI(result.actualSummary.roi) : '\u2022\u2022'}
                    </Text>
                  </View>
                  <View style={styles.breakdownDivider} />
                  <View style={[styles.breakdownCol, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.breakdownColLabel, { color: AMBER }]}>What-If</Text>
                    <Text
                      style={[styles.breakdownColValue, { color: AMBER }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {showBalance ? formatROI(result.simulatedSummary.roi) : '\u2022\u2022'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.breakdownFooter,
                    { color: getValueColor(result.difference.roiDifference) },
                  ]}
                >
                  {showBalance
                    ? result.difference.roiDifference >= 0
                      ? `+${Math.abs(result.difference.roiDifference).toFixed(1)}% improvement`
                      : `-${Math.abs(result.difference.roiDifference).toFixed(1)}% decline`
                    : '\u2022\u2022\u2022\u2022'}
                </Text>
              </View>
            </FadeInView>
          </Animated.View>
        )}

        {/* Bottom safe area */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 20,
    },

    // Header
    headerArea: {
      paddingTop: 8,
      marginBottom: 24,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },

    // Loading
    loadingWrap: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },

    // Empty state
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: 16,
    },
    emptyDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 21,
      maxWidth: 280,
    },

    // Scenario label
    scenarioLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 1,
      marginBottom: 10,
    },

    // Ticker
    tickerContainer: {
      height: 52,
      marginHorizontal: -20,
      marginBottom: 10,
    },
    tickerScrollContent: {
      paddingHorizontal: 20,
      gap: 10,
      alignItems: 'center',
    },
    tickerPill: {
      height: 52,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tickerPillActive: {
      borderColor: GREEN,
      borderWidth: 2,
      backgroundColor: GREEN + '1A',
    },
    tickerPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tickerPillTextActive: {
      color: colors.text,
    },

    // Custom filters toggle
    customToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    customToggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },

    // Custom filters
    filtersInner: {
      paddingTop: 12,
    },
    filterGroup: {
      marginBottom: 14,
    },
    filterCatLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    chipDeselected: {
      opacity: 0.4,
      backgroundColor: colors.chipBg,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    chipTextDeselected: {
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
    },

    // Placeholder
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    placeholderText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 22,
    },

    // Hero card
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    heroCol: {
      flex: 2,
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    heroValue: {
      fontSize: 26,
      fontWeight: '700',
    },
    heroRoi: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 4,
    },
    heroRecord: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    heroCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroEquals: {
      fontSize: 24,
      fontWeight: '700',
    },

    // Difference banner
    diffBanner: {
      height: 48,
      borderRadius: 12,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    diffText: {
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },

    // Chart card
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    chartTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 1,
      marginBottom: 16,
    },
    recalcText: {
      fontSize: 11,
      color: colors.textTertiary,
      position: 'absolute',
      top: 20,
      right: 20,
    },
    chartLayout: {
      flexDirection: 'row',
    },
    yAxisCol: {
      width: 44,
      height: CHART_HEIGHT,
      position: 'relative',
    },
    yLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      textAlign: 'right',
      width: 40,
    },
    chartArea: {
      flex: 1,
      height: CHART_HEIGHT,
    },
    xAxisRow: {
      height: 20,
      position: 'relative',
      marginTop: 4,
    },
    xLabel: {
      fontSize: 10,
      color: colors.textTertiary,
    },

    // Legend
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginTop: 16,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    // Breakdown cards
    breakdownCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    breakdownColumns: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    breakdownCol: {
      flex: 1,
    },
    breakdownColLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textTertiary,
      letterSpacing: 0.3,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    breakdownColValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    breakdownDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
      opacity: 0.3,
      marginHorizontal: 16,
    },
    breakdownFooter: {
      fontSize: 12,
      color: colors.textTertiary,
    },
  });
}
