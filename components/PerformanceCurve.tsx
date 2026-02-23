import 'react-native-reanimated'; // must be first — ensures reanimated initializes before wagmi-charts
import * as Haptics from 'expo-haptics';
import * as d3Shape from 'd3-shape';
import React, { useCallback, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import { Stop } from 'react-native-svg';

export type TimePeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

interface PerformanceCurveProps {
  allBets: any[];
  period: TimePeriod;
  onCursorChange?: (value: number | null) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// scrollContent paddingHorizontal 20 + chartCard padding 20 = 40 each side = 80 total
const CHART_WIDTH = SCREEN_WIDTH - 80;
const CHART_HEIGHT = 220;

function getTimeCutoff(period: TimePeriod): Date {
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

/** Returns the effective date for a bet, falling back to created_at if placed_at is absent. */
function getBetDate(bet: any): Date | null {
  const raw = bet.placed_at ?? bet.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatXLabel(date: Date, period: TimePeriod): string {
  if (period === 'Daily') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (period === 'Yearly') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildChartData(allBets: any[], period: TimePeriod) {
  const cutoff = getTimeCutoff(period);
  const now = new Date();

  // Filter to the selected period and sort chronologically
  const filtered = allBets
    .filter((b) => {
      const d = getBetDate(b);
      return d !== null && d >= cutoff;
    })
    .sort((a, b) => {
      const da = getBetDate(a)!.getTime();
      const db = getBetDate(b)!.getTime();
      return da - db;
    });

  if (filtered.length === 0) {
    // Two-point flat $0 line spanning the entire period
    return [
      { timestamp: cutoff.getTime(), value: 0 },
      { timestamp: now.getTime(), value: 0 },
    ];
  }

  // Always start the line at $0 at the period boundary
  const points: { timestamp: number; value: number }[] = [
    { timestamp: cutoff.getTime(), value: 0 },
  ];

  let cum = 0;
  for (const bet of filtered) {
    if (bet.status === 'won') {
      cum += (bet.potential_payout || 0) - (bet.wager || 0);
    } else if (bet.status === 'lost') {
      cum -= bet.wager || 0;
    }
    // pending / void bets don't shift the P&L line
    points.push({
      timestamp: getBetDate(bet)!.getTime(),
      value: parseFloat(cum.toFixed(2)),
    });
  }

  // Extend the line to "now" so the right edge is always the current moment
  const lastTs = points[points.length - 1].timestamp;
  if (now.getTime() - lastTs > 60 * 1000) {
    points.push({ timestamp: now.getTime(), value: parseFloat(cum.toFixed(2)) });
  }

  return points;
}

export default function PerformanceCurve({
  allBets,
  period,
  onCursorChange,
}: PerformanceCurveProps) {
  const chartData = useMemo(
    () => buildChartData(allBets, period),
    [allBets, period]
  );

  const currentPL = chartData[chartData.length - 1]?.value ?? 0;
  const lineColor = currentPL >= 0 ? '#00D632' : '#FF3B30';

  // When all values are identical (flat line), give the y-axis a small range so
  // the line renders at the vertical centre rather than producing a degenerate scale.
  const allSame = chartData.every((p) => p.value === chartData[0].value);
  const yRange = allSame
    ? { min: chartData[0].value - 1, max: chartData[0].value + 1 }
    : undefined;

  const handleIndexChange = useCallback(
    (index: number) => {
      if (index >= 0 && index < chartData.length) {
        onCursorChange?.(chartData[index].value);
      }
    },
    [chartData, onCursorChange]
  );

  const cutoff = getTimeCutoff(period);
  const leftLabel = formatXLabel(cutoff, period);
  const rightLabel = formatXLabel(new Date(), period);

  return (
    <View style={styles.container}>
      {/*
       * key={period} forces a clean remount whenever the time period changes.
       * This re-triggers the 800 ms draw-on animation and flushes any stale
       * internal wagmi-charts state (cursor position, path cache, etc.).
       */}
      <LineChart.Provider
        key={period}
        data={chartData}
        yRange={yRange}
        onCurrentIndexChange={handleIndexChange}
      >
        <LineChart
          height={CHART_HEIGHT}
          width={CHART_WIDTH}
          shape={d3Shape.curveMonotoneX}
          yGutter={12}
        >
          <LineChart.Path
            color={lineColor}
            width={2.5}
            animateOnMount="foreground"
            mountAnimationDuration={800}
          >
            <LineChart.Gradient>
              <Stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
              <Stop offset="60%" stopColor={lineColor} stopOpacity={0.05} />
              <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </LineChart.Gradient>
          </LineChart.Path>

          <LineChart.Cursor
            type="line"
            onActivated={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onEnded={() => {
              onCursorChange?.(null);
            }}
          >
            <LineChart.CursorLine
              color={lineColor}
              lineProps={{ strokeDasharray: '4 3', strokeWidth: '1.5' }}
              textStyle={styles.cursorDateLabel}
            />
          </LineChart.Cursor>
        </LineChart>
      </LineChart.Provider>

      {/* Static start / end labels beneath the chart */}
      <View style={styles.xAxisRow}>
        <Text style={styles.xAxisLabel}>{leftLabel}</Text>
        <Text style={styles.xAxisLabel}>{rightLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CHART_WIDTH,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -32,
    paddingHorizontal: 2,
  },
  xAxisLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  cursorDateLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
});
