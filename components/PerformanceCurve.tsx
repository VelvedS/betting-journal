import 'react-native-reanimated';

import React, { useMemo } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';

export type TimePeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Lifetime';

type ChartPoint = { timestamp: number; value: number };
type XLabel = { xPos: number; text: string };

// Always have ≥ 2 points so getDomain never crashes on an empty array
const DEFAULT_DATA: ChartPoint[] = [
  { timestamp: Date.now() - 86400000, value: 0 },
  { timestamp: Date.now(), value: 0 },
];

interface PerformanceCurveProps {
  allBets: any[];
  period: TimePeriod;
  onCursorChange?: (value: number | null) => void;
}

const CHART_HEIGHT = 150;
const Y_GUTTER = 20;
const Y_AXIS_WIDTH = 44;
const NUM_Y_LABELS = 5;

function getPeriodCutoff(period: TimePeriod): Date | null {
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
    case 'Lifetime':
      return null;
  }
}

function formatYLabel(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '$0';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

// Build X axis labels with per-period deduplication logic.
// xPos is a pixel offset within chartLineWidth (wagmi-charts spaces by index).
function buildXLabels(
  chartData: ChartPoint[],
  period: TimePeriod,
  chartLineWidth: number
): XLabel[] {
  const n = chartData.length;
  if (n < 2) return [];

  // Pixel position for data index i
  const xAt = (i: number) => (i / (n - 1)) * chartLineWidth;

  switch (period) {
    case 'Daily': {
      // Fixed clock-based slots; find nearest data point to each slot.
      // Skip any slot whose resolved position is too close to the previous one.
      const now = new Date();
      const todayMs = new Date(
        now.getFullYear(), now.getMonth(), now.getDate()
      ).getTime();
      const slots = [
        { hour: 0,  label: '12AM' },
        { hour: 6,  label: '6AM'  },
        { hour: 12, label: '12PM' },
        { hour: 18, label: '6PM'  },
        { hour: 23, label: '11PM' },
      ];
      const result: XLabel[] = [];
      let lastXPos = -50;
      for (const slot of slots) {
        const slotTs = todayMs + slot.hour * 3_600_000;
        let closestIdx = 0, closestDiff = Infinity;
        for (let i = 0; i < n; i++) {
          const diff = Math.abs(chartData[i].timestamp - slotTs);
          if (diff < closestDiff) { closestDiff = diff; closestIdx = i; }
        }
        const xPos = xAt(closestIdx);
        if (xPos - lastXPos >= 35) {
          result.push({ xPos, text: slot.label });
          lastXPos = xPos;
        }
      }
      return result;
    }

    case 'Weekly': {
      // One label per unique calendar day, at the first occurrence of that day.
      const seenDays = new Set<string>();
      const result: XLabel[] = [];
      for (let i = 0; i < n; i++) {
        const day = new Date(chartData[i].timestamp).toLocaleDateString('en-US', {
          weekday: 'short',
        });
        if (!seenDays.has(day) && result.length < 7) {
          seenDays.add(day);
          result.push({ xPos: xAt(i), text: day });
        }
      }
      return result;
    }

    case 'Monthly': {
      // ~5 evenly distributed indices; deduplicate by formatted date string.
      const count = 5;
      const result: XLabel[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < count; i++) {
        const idx = Math.round((i / (count - 1)) * (n - 1));
        const text = new Date(chartData[idx].timestamp).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric',
        });
        if (!seen.has(text)) {
          seen.add(text);
          result.push({ xPos: xAt(idx), text });
        }
      }
      return result;
    }

    case 'Lifetime': {
      // One label per unique month, at first occurrence; max 6.
      const seenMonths = new Set<string>();
      const result: XLabel[] = [];
      for (let i = 0; i < n; i++) {
        const month = new Date(chartData[i].timestamp).toLocaleDateString('en-US', {
          month: 'short',
        });
        if (!seenMonths.has(month) && result.length < 6) {
          seenMonths.add(month);
          result.push({ xPos: xAt(i), text: month });
        }
      }
      // Fewer than 2 months of data → fall back to date labels
      if (result.length < 2) {
        const fallback: XLabel[] = [];
        const seen2 = new Set<string>();
        for (let i = 0; i < 5; i++) {
          const idx = Math.round((i / 4) * (n - 1));
          const text = new Date(chartData[idx].timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric',
          });
          if (!seen2.has(text)) {
            seen2.add(text);
            fallback.push({ xPos: xAt(idx), text });
          }
        }
        return fallback;
      }
      return result;
    }
  }
}

export default function PerformanceCurve({
  allBets,
  period,
  onCursorChange,
}: PerformanceCurveProps) {
  const { chartData, isEmpty } = useMemo(() => {
    if (!allBets || allBets.length === 0) {
      return { chartData: DEFAULT_DATA, isEmpty: true };
    }

    // Sort ascending by date
    const sorted = [...allBets].sort((a, b) => {
      const da = new Date(a.placed_at ?? a.created_at ?? 0).getTime();
      const db = new Date(b.placed_at ?? b.created_at ?? 0).getTime();
      return da - db;
    });

    // Filter by period
    const cutoff = getPeriodCutoff(period);
    const filtered = cutoff
      ? sorted.filter((b) => {
          const raw = b.placed_at ?? b.created_at;
          if (!raw) return false;
          const d = new Date(raw);
          return !isNaN(d.getTime()) && d >= cutoff;
        })
      : sorted;

    // Only settled bets contribute to the P&L curve
    const settled = filtered.filter(
      (b) => b.status === 'won' || b.status === 'lost'
    );
    if (settled.length === 0) return { chartData: DEFAULT_DATA, isEmpty: true };

    // Zero-baseline starting point just before the first bet
    const firstTs = new Date(
      settled[0].placed_at ?? settled[0].created_at
    ).getTime();
    let cumulative = 0;
    const points: ChartPoint[] = [{ timestamp: firstTs - 1, value: 0 }];

    for (const bet of settled) {
      if (bet.status === 'won')
        cumulative += (bet.potential_payout || 0) - (bet.wager || 0);
      else if (bet.status === 'lost') cumulative -= bet.wager || 0;
      const raw = bet.placed_at ?? bet.created_at;
      const ts = raw ? new Date(raw).getTime() : Date.now();
      points.push({ timestamp: ts, value: cumulative });
    }

    const data = points.length >= 2 ? points : DEFAULT_DATA;
    return { chartData: data, isEmpty: false };
  }, [allBets, period]);

  const finalValue = chartData[chartData.length - 1].value;
  const isNegative = finalValue < 0;
  const lineColor = isNegative ? '#FF3B30' : '#2DC672';

  const outerWidth = Dimensions.get('window').width - 80;
  const chartLineWidth = outerWidth - Y_AXIS_WIDTH;

  const allValues = chartData.map((d) => d.value);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const yRange =
    minVal === maxVal ? { min: minVal - 1, max: maxVal + 1 } : undefined;

  const effectiveMin = yRange?.min ?? minVal;
  const effectiveMax = yRange?.max ?? maxVal;
  const drawHeight = CHART_HEIGHT - 2 * Y_GUTTER;

  // Y axis: 5 labels from top (max) to bottom (min), absolutely positioned
  const yLabels = useMemo(() => {
    return Array.from({ length: NUM_Y_LABELS }, (_, i) => {
      const t = i / (NUM_Y_LABELS - 1);
      const value = effectiveMax - t * (effectiveMax - effectiveMin);
      const yPos = Y_GUTTER + t * drawHeight;
      return { yPos, text: formatYLabel(value) };
    });
  }, [effectiveMin, effectiveMax, drawHeight]);

  const xLabels = useMemo(
    () => (isEmpty ? [] : buildXLabels(chartData, period, chartLineWidth)),
    [chartData, period, chartLineWidth, isEmpty]
  );

  const handleIndexChange = (index: number) => {
    if (!onCursorChange) return;
    if (index < 0 || index >= chartData.length) {
      onCursorChange(null);
    } else {
      onCursorChange(chartData[index].value);
    }
  };

  // wagmi-charts uses native modules not available on web
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>Chart available on mobile</Text>
      </View>
    );
  }

  // Daily with no settled bets today → show message instead of flat line
  if (period === 'Daily' && isEmpty) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No bets placed today</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Chart row: Y-axis labels + line chart */}
      <View style={{ flexDirection: 'row', height: CHART_HEIGHT }}>
        {/* Y axis labels — absolutely positioned within a fixed-width column */}
        <View style={{ width: Y_AXIS_WIDTH, height: CHART_HEIGHT, position: 'relative' }}>
          {yLabels.map((label, i) => (
            <Text
              key={i}
              style={{
                position: 'absolute',
                top: label.yPos - 6,
                right: 4,
                color: '#999',
                fontSize: 10,
              }}
            >
              {label.text}
            </Text>
          ))}
        </View>

        {/* Line chart */}
        <View style={{ width: chartLineWidth }}>
          <LineChart.Provider
            data={chartData}
            yRange={yRange}
            onCurrentIndexChange={handleIndexChange}
          >
            <LineChart width={chartLineWidth} height={CHART_HEIGHT} yGutter={Y_GUTTER}>
              <LineChart.Path color={lineColor}>
                <LineChart.Gradient />
              </LineChart.Path>
              <LineChart.CursorCrosshair color={lineColor} />
            </LineChart>
          </LineChart.Provider>
        </View>
      </View>

      {/* X axis labels — absolutely positioned to prevent duplicates */}
      <View style={{ marginLeft: Y_AXIS_WIDTH, height: 18, position: 'relative' }}>
        {xLabels.map((label, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              // Clamp so first label doesn't clip left and last doesn't clip right
              left: Math.max(0, Math.min(label.xPos - 12, chartLineWidth - 32)),
              top: 4,
              color: '#999',
              fontSize: 10,
            }}
          >
            {label.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFallbackText: {
    color: '#999',
    fontSize: 14,
  },
  emptyState: {
    height: CHART_HEIGHT + 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#999',
    fontSize: 14,
  },
});
