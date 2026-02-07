import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  GestureResponderEvent,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency, formatPercent, formatPL } from '@/lib/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Chart data per time period ---

interface ChartDataPoint {
  label: string;
  profit: number;
}

const dailyData: ChartDataPoint[] = [
  { label: '12am', profit: 0 },
  { label: '3am', profit: 15 },
  { label: '6am', profit: -10 },
  { label: '9am', profit: 45 },
  { label: '12pm', profit: 120 },
  { label: '3pm', profit: 95 },
  { label: '6pm', profit: 210 },
  { label: '9pm', profit: 280 },
];

const weeklyData: ChartDataPoint[] = [
  { label: 'Mon', profit: 120 },
  { label: 'Wed', profit: -45 },
  { label: 'Thu', profit: 280 },
  { label: 'Fri', profit: 620 },
  { label: 'Sat', profit: 895 },
  { label: 'Sun', profit: 1400 },
];

const monthlyData: ChartDataPoint[] = [
  { label: 'W1', profit: 320 },
  { label: 'W2', profit: 580 },
  { label: 'W3', profit: 410 },
  { label: 'W4', profit: 1150 },
];

const yearlyData: ChartDataPoint[] = [
  { label: 'Jan', profit: 450 },
  { label: 'Feb', profit: -120 },
  { label: 'Mar', profit: 680 },
  { label: 'Apr', profit: 320 },
  { label: 'May', profit: 890 },
  { label: 'Jun', profit: 540 },
  { label: 'Jul', profit: -200 },
  { label: 'Aug', profit: 750 },
  { label: 'Sep', profit: 1100 },
  { label: 'Oct', profit: 960 },
  { label: 'Nov', profit: 1350 },
  { label: 'Dec', profit: 2450 },
];

type TimePeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

const chartDataMap: Record<TimePeriod, ChartDataPoint[]> = {
  Daily: dailyData,
  Weekly: weeklyData,
  Monthly: monthlyData,
  Yearly: yearlyData,
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'won': return { label: 'WIN', statusColor: '#2DC672', statusBg: '#E8F8F0', icon: 'checkmark-circle' };
    case 'lost': return { label: 'LOSS', statusColor: '#E85D5D', statusBg: '#FFECEC', icon: 'close-circle' };
    case 'pending': return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
    case 'void': return { label: 'VOID', statusColor: '#999999', statusBg: '#F0F0F0', icon: 'ban' };
    default: return { label: 'PENDING', statusColor: '#F5A623', statusBg: '#FFF5E0', icon: 'time' };
  }
};

const emptyChartData: ChartDataPoint[] = [
  { label: 'Mon', profit: 0 },
  { label: 'Tue', profit: 0 },
  { label: 'Wed', profit: 0 },
  { label: 'Thu', profit: 0 },
  { label: 'Fri', profit: 0 },
  { label: 'Sat', profit: 0 },
  { label: 'Sun', profit: 0 },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Weekly');
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [recentBets, setRecentBets] = useState<any[]>([]);
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [totalWagered, setTotalWagered] = useState<number>(0);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .limit(5);
    setRecentBets(bets || []);

    const { data: allBets } = await supabase
      .from('bets')
      .select('status, wager, potential_payout')
      .eq('user_id', user.id);
    if (allBets && allBets.length > 0) {
      let profit = 0;
      let wagered = 0;
      for (const b of allBets) {
        wagered += b.wager || 0;
        if (b.status === 'won') profit += (b.potential_payout || 0) - (b.wager || 0);
        else if (b.status === 'lost') profit -= b.wager || 0;
      }
      setTotalProfit(profit);
      setTotalWagered(wagered);
    } else {
      setTotalProfit(0);
      setTotalWagered(0);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const hasBets = recentBets.length > 0;

  const handleDismissTooltip = () => {
    setHoveredPoint(null);
  };

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Welcome Back, {displayName}</Text>
          <Text style={styles.headerQuote}>"Don't just play the books, keep your own."</Text>
        </View>

        {/* Total Profit/Loss Card */}
        <View style={styles.profitCard}>
          <Text style={styles.profitLabel}>TOTAL PROFIT/LOSS</Text>
          <View style={styles.profitValueRow}>
            {hasBets ? (
              <>
                <Text style={[styles.profitValue, { color: totalProfit >= 0 ? '#2DC672' : '#E85D5D' }]}>
                  {formatCurrency(totalProfit)}
                </Text>
                <View style={styles.percentageContainer}>
                  <Ionicons name={totalProfit >= 0 ? "trending-up" : "trending-down"} size={20} color={totalProfit >= 0 ? "#2DC672" : "#E85D5D"} />
                  <Text style={[styles.percentageText, { color: totalProfit >= 0 ? '#2DC672' : '#E85D5D' }]}>
                    {formatPercent(totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0, true)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.profitValueEmpty}>$0</Text>
            )}
          </View>
        </View>

        {/* Time Period Tabs */}
        <View style={styles.tabsContainer}>
          {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as TimePeriod[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.tab,
                selectedPeriod === period && styles.tabActive,
              ]}
              onPress={() => {
                setSelectedPeriod(period);
                setHoveredPoint(null);
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedPeriod === period && styles.tabTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Performance Curve Card */}
        <TouchableOpacity
          style={styles.chartCard}
          activeOpacity={1}
          onPress={handleDismissTooltip}
        >
          <Text style={styles.chartLabel}>PERFORMANCE CURVE</Text>
          <PerformanceChart
            data={hasBets ? chartDataMap[selectedPeriod] : emptyChartData}
            hoveredPoint={hoveredPoint}
            setHoveredPoint={hasBets ? setHoveredPoint : () => {}}
            period={selectedPeriod}
          />
        </TouchableOpacity>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <View style={styles.activityTitleRow}>
            <Text style={styles.activityTitle}>Recent Activity</Text>
            {hasBets && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/stats')}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="arrow-forward" size={16} color="#6366F1" />
              </TouchableOpacity>
            )}
          </View>

          {hasBets ? (
            recentBets.map((bet) => {
              const sc = getStatusConfig(bet.status);
              const roiPctValue = bet.wager > 0 ? ((bet.potential_payout || 0) - bet.wager) / bet.wager * 100 : 0;
              const ts = bet.placed_at ? new Date(bet.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
              return (
              <TouchableOpacity
                key={bet.id}
                style={styles.activityCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/bet-details/${bet.id}`)}
              >
                <View style={styles.activityHeader}>
                  <View style={styles.activityHeaderLeft}>
                    <Text style={styles.platformName}>{bet.sportsbook || 'Unknown'}</Text>
                    <View style={[styles.badge, { backgroundColor: sc.statusBg }]}>
                      <Text style={[styles.badgeText, { color: sc.statusColor }]}>
                        {sc.label}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={sc.icon as any} size={24} color={sc.statusColor} />
                </View>
                <Text style={styles.betType}>{bet.bet_type ? (bet.bet_type === 'over_under' ? 'Over/Under' : bet.bet_type.charAt(0).toUpperCase() + bet.bet_type.slice(1)) : ''}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>WAGER</Text>
                    <Text style={styles.statValue}>{formatCurrency(bet.wager)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>POTENTIAL</Text>
                    <Text style={styles.statValue}>{formatCurrency(bet.potential_payout || 0)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>ROI</Text>
                    <Text style={styles.roiValue}>{formatPercent(roiPctValue, true)}</Text>
                  </View>
                </View>
                <View style={styles.activityFooter}>
                  <Text style={styles.timestamp}>{ts}</Text>
                  <Text style={styles.betId}>#{String(bet.id).slice(-4)}</Text>
                </View>
              </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={36} color="#6366F1" />
              </View>
              <Text style={styles.emptyTitle}>No bets yet</Text>
              <Text style={styles.emptySubtitle}>
                Start tracking your bets to see your performance
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/add-bet')}
              >
                <Text style={styles.emptyButtonText}>Add Your First Bet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- Performance Chart Component ---

interface PerformanceChartProps {
  data: ChartDataPoint[];
  hoveredPoint: string | null;
  setHoveredPoint: (label: string | null) => void;
  period: TimePeriod;
}

function PerformanceChart({ data, hoveredPoint, setHoveredPoint, period }: PerformanceChartProps) {
  const chartWidth = SCREEN_WIDTH - 80;
  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;
  const effectiveWidth = chartWidth - paddingLeft - paddingRight;
  const effectiveHeight = chartHeight - paddingTop - paddingBottom;

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [period]);

  // Dynamic Y-axis range
  const profits = data.map(d => d.profit);
  const rawMin = Math.min(...profits);
  const rawMax = Math.max(...profits);
  const range = rawMax - rawMin || 1;
  const yMin = Math.min(0, Math.floor(rawMin - range * 0.1));
  const yMax = Math.ceil(rawMax + range * 0.2);

  // Round to nice increments
  const yRange = yMax - yMin;
  const step = Math.ceil(yRange / 4 / 50) * 50 || 50;
  const niceMin = Math.floor(yMin / step) * step;
  const niceMax = niceMin + step * 4;

  // Y-axis labels (5 labels)
  const yLabels: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yLabels.push(niceMin + i * step);
  }

  // Map data to pixel coordinates
  const points = data.map((d, index) => {
    const x = paddingLeft + (data.length > 1 ? (index / (data.length - 1)) * effectiveWidth : effectiveWidth / 2);
    const y = paddingTop + effectiveHeight - ((d.profit - niceMin) / (niceMax - niceMin)) * effectiveHeight;
    return { x, y, ...d };
  });

  // Smooth curve path using quadratic bezier
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      pathD += ` Q ${cpx} ${prev.y}, ${curr.x} ${curr.y}`;
    }
  }

  const handleDotPress = (label: string, e: GestureResponderEvent) => {
    e.stopPropagation();
    setHoveredPoint(hoveredPoint === label ? null : label);
  };

  const formatDollar = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    if (val <= -1000) return `-$${(Math.abs(val) / 1000).toFixed(Math.abs(val) % 1000 === 0 ? 0 : 1)}k`;
    if (val < 0) return `-$${Math.abs(val)}`;
    return `$${val}`;
  };

  return (
    <Animated.View style={[styles.chartWrapper, { opacity: fadeAnim }]}>
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Y-axis horizontal grid lines */}
          {yLabels.map((val, i) => {
            const y = paddingTop + effectiveHeight - ((val - niceMin) / (niceMax - niceMin)) * effectiveHeight;
            return (
              <Line
                key={`grid-${i}`}
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="#F0F0F0"
                strokeWidth="1"
              />
            );
          })}

          {/* Performance curve */}
          <Path d={pathD} stroke="#6366F1" strokeWidth="3" fill="none" />

          {/* Hovered dot only */}
          {points.map((point, index) =>
            hoveredPoint === point.label ? (
              <Circle
                key={`hovered-${index}`}
                cx={point.x}
                cy={point.y}
                r={8}
                fill="#6366F1"
                stroke="#FFFFFF"
                strokeWidth={3}
              />
            ) : null
          )}

          {/* Y-axis labels */}
          {yLabels.map((val, i) => {
            const y = paddingTop + effectiveHeight - ((val - niceMin) / (niceMax - niceMin)) * effectiveHeight;
            return (
              <SvgText
                key={`yaxis-${i}`}
                x={paddingLeft - 8}
                y={y + 4}
                fontSize="11"
                fill="#9CA3AF"
                textAnchor="end"
                fontWeight="400"
              >
                {formatDollar(val)}
              </SvgText>
            );
          })}

          {/* X-axis labels — dynamic per data point */}
          {points.map((point, index) => (
            <SvgText
              key={`xaxis-${index}`}
              x={point.x}
              y={chartHeight - 6}
              fontSize="11"
              fill="#9CA3AF"
              textAnchor="middle"
              fontWeight="400"
            >
              {point.label}
            </SvgText>
          ))}
        </Svg>

        {/* Invisible touch targets + tooltips */}
        {points.map((point, index) => {
          const isPositive = point.profit >= 0;
          const profitColor = isPositive ? '#10B981' : '#DC2626';
          const profitText = isPositive ? `+$${point.profit}` : `-$${Math.abs(point.profit)}`;

          return (
            <TouchableOpacity
              key={`touch-${index}`}
              style={[
                styles.dotTouchable,
                {
                  left: point.x - 18,
                  top: point.y - 18,
                },
              ]}
              onPress={(e) => handleDotPress(point.label, e)}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {hoveredPoint === point.label && (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipLabel}>{point.label}</Text>
                  <Text style={[styles.tooltipValue, { color: profitColor }]}>
                    {profitText}
                  </Text>
                  <View style={styles.tooltipArrow} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerQuote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#6B6B6B',
  },
  profitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  profitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  profitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profitValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10B981',
  },
  profitValueEmpty: {
    fontSize: 36,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  tab: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  chartWrapper: {
    position: 'relative',
  },
  chartContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  dotTouchable: {
    position: 'absolute',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: 44,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  tooltipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A1A1A',
  },
  activitySection: {
    marginBottom: 24,
  },
  activityTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.03)',
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  statItem: {
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
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  betId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
