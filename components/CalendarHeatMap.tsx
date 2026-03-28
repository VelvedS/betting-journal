import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { usePreferences } from '@/context/PreferencesContext';
import { formatCurrency } from '@/lib/formatters';
import * as Haptics from 'expo-haptics';

const HEAT_MAP_THRESHOLD = 50;
const CELL_SIZE = 14;
const CELL_GAP = 3;
const CELL_RADIUS = 3;
const WEEKS = 16;
const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

interface DayData {
  date: string;
  netPL: number;
  bets: number;
  wins: number;
  losses: number;
}

interface CalendarHeatMapProps {
  bets: any[];
}

export default function CalendarHeatMap({ bets }: CalendarHeatMapProps) {
  const { colors } = useTheme();
  const { currency, showBalance } = usePreferences();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ col: number; row: number } | null>(null);

  // Build daily P&L map from settled bets
  const dailyMap = useMemo(() => {
    const map: Record<string, { netPL: number; bets: number; wins: number; losses: number }> = {};
    bets
      .filter((b) => b.status === 'won' || b.status === 'lost')
      .forEach((bet) => {
        const dateStr = (bet.placed_at || bet.created_at || '').slice(0, 10);
        if (!dateStr) return;
        if (!map[dateStr]) map[dateStr] = { netPL: 0, bets: 0, wins: 0, losses: 0 };
        const entry = map[dateStr];
        entry.bets++;
        if (bet.status === 'won') {
          entry.wins++;
          entry.netPL += (bet.potential_payout || 0) - (bet.wager || 0);
        } else {
          entry.losses++;
          entry.netPL -= bet.wager || 0;
        }
      });
    return map;
  }, [bets]);

  // Build 16-week grid (Mon=row0 … Sun=row6)
  const { grid, startDate, endDate, monthLabels } = useMemo(() => {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const thisMon = new Date(today);
    thisMon.setDate(today.getDate() - daysFromMon);

    const startMon = new Date(thisMon);
    startMon.setDate(thisMon.getDate() - (WEEKS - 1) * 7);

    const grid: (DayData | null)[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let prevMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      const week: (DayData | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startMon);
        cellDate.setDate(startMon.getDate() + w * 7 + d);

        if (cellDate > today) {
          week.push(null);
          continue;
        }

        const yyyy = cellDate.getFullYear();
        const mm = String(cellDate.getMonth() + 1).padStart(2, '0');
        const dd = String(cellDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const entry = dailyMap[dateStr];

        week.push({
          date: dateStr,
          netPL: entry?.netPL || 0,
          bets: entry?.bets || 0,
          wins: entry?.wins || 0,
          losses: entry?.losses || 0,
        });

        if (d === 0) {
          const month = cellDate.getMonth();
          if (month !== prevMonth) {
            monthLabels.push({
              col: w,
              label: cellDate.toLocaleDateString('en-US', { month: 'short' }),
            });
            prevMonth = month;
          }
        }
      }
      grid.push(week);
    }

    return { grid, startDate: startMon, endDate: today, monthLabels };
  }, [dailyMap]);

  const totalDaysWithData = Object.keys(dailyMap).length;

  const getCellColor = useCallback(
    (day: DayData | null): string => {
      if (!day || day.bets === 0) return colors.surface;
      const pl = day.netPL;
      if (pl > HEAT_MAP_THRESHOLD) return colors.accent;
      if (pl > 0) return colors.accent + '99';
      if (pl === 0) return colors.border;
      if (pl > -HEAT_MAP_THRESHOLD) return '#EF444499';
      return '#DC2626';
    },
    [colors],
  );

  const handleCellPress = useCallback(
    (col: number, row: number, day: DayData | null) => {
      if (!day || day.bets === 0) {
        setSelectedDay(null);
        setSelectedPos(null);
        return;
      }
      Haptics.selectionAsync();
      if (selectedPos?.col === col && selectedPos?.row === row) {
        setSelectedDay(null);
        setSelectedPos(null);
      } else {
        setSelectedPos({ col, row });
        setSelectedDay(day);
      }
    },
    [selectedPos],
  );

  const formatTooltipDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Auto-scroll to right (most recent week)
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const dateRangeStr = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Daily Activity</Text>
        <Text style={styles.dateRange}>{dateRangeStr}</Text>
      </View>

      {/* Selected cell info bar */}
      {selectedDay && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.infoBar}>
          <Text style={styles.infoDate}>{formatTooltipDate(selectedDay.date)}</Text>
          <Text
            style={[
              styles.infoPL,
              { color: selectedDay.netPL >= 0 ? colors.accent : '#EF4444' },
            ]}
          >
            {showBalance
              ? (selectedDay.netPL > 0 ? '+' : '') +
                formatCurrency(selectedDay.netPL, currency, true)
              : '\u2022\u2022\u2022\u2022'}
          </Text>
          <Text style={styles.infoMeta}>
            {selectedDay.bets} bet{selectedDay.bets !== 1 ? 's' : ''} \u00B7{' '}
            {selectedDay.wins}W-{selectedDay.losses}L
          </Text>
        </Animated.View>
      )}

      {totalDaysWithData < 7 ? (
        <Text style={styles.emptyText}>Keep logging bets to fill your calendar</Text>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View>
              {/* Month labels */}
              <View style={styles.monthRow}>
                <View style={{ width: 20 + CELL_GAP }} />
                {Array.from({ length: WEEKS }, (_, w) => {
                  const label = monthLabels.find((m) => m.col === w);
                  return (
                    <View key={w} style={styles.monthCell}>
                      {label ? (
                        <Text style={styles.monthLabel} numberOfLines={1}>
                          {label.label}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {/* Grid body */}
              <View style={styles.gridBody}>
                {/* Day labels column */}
                <View style={styles.dayLabelsCol}>
                  {DAY_LABELS.map((label, i) => (
                    <View key={i} style={styles.dayLabelCell}>
                      <Text style={styles.dayLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {/* Week columns with stagger animation */}
                {grid.map((week, colIdx) => (
                  <Animated.View
                    key={colIdx}
                    entering={FadeIn.delay(colIdx * 5).duration(200)}
                    style={styles.weekCol}
                  >
                    {week.map((day, rowIdx) => {
                      const isSelected =
                        selectedPos?.col === colIdx && selectedPos?.row === rowIdx;
                      return (
                        <Pressable
                          key={rowIdx}
                          onPress={() => handleCellPress(colIdx, rowIdx, day)}
                          style={[
                            styles.cell,
                            { backgroundColor: day ? getCellColor(day) : 'transparent' },
                            isSelected && {
                              borderWidth: 1.5,
                              borderColor: colors.text,
                            },
                          ]}
                        />
                      );
                    })}
                  </Animated.View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legendRow}>
            <Text style={styles.legendLabel}>Loss</Text>
            {[
              '#DC2626',
              '#EF444499',
              colors.border,
              colors.accent + '99',
              colors.accent,
            ].map((c, i) => (
              <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
            ))}
            <Text style={styles.legendLabel}>Win</Text>
          </View>
        </>
      )}
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'],
) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    dateRange: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    infoBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    infoDate: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    infoPL: {
      fontSize: 12,
      fontWeight: '700',
    },
    infoMeta: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    monthRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    monthCell: {
      width: CELL_SIZE + CELL_GAP,
      overflow: 'visible' as const,
    },
    monthLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      minWidth: 28,
      flexShrink: 0,
    },
    gridBody: {
      flexDirection: 'row',
    },
    dayLabelsCol: {
      width: 20,
      marginRight: CELL_GAP,
    },
    dayLabelCell: {
      height: CELL_SIZE + CELL_GAP,
      justifyContent: 'center',
    },
    dayLabel: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    weekCol: {
      marginRight: CELL_GAP,
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: CELL_RADIUS,
      marginBottom: CELL_GAP,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 12,
    },
    legendLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginHorizontal: 4,
    },
    legendCell: {
      width: 12,
      height: 12,
      borderRadius: 2,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textTertiary,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 16,
    },
  });
}
