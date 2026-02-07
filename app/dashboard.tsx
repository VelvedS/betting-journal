import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Weekly performance data
const weeklyData = [
  { day: 'Mon', profit: 120 },
  { day: 'Tue', profit: 85 },
  { day: 'Wed', profit: 50 },
  { day: 'Thu', profit: 280 },
  { day: 'Fri', profit: 620 },
  { day: 'Sat', profit: 895 },
  { day: 'Sun', profit: 1400 },
];

// Sample bet data
const sampleBets = [
  {
    id: '#0001',
    platform: 'DraftKings',
    status: 'WIN',
    betType: 'Parlay (3 legs)',
    wager: 50,
    potential: 425,
    roi: 750,
    timestamp: 'Today, 3:45 PM',
    statusColor: '#059669',
    statusBg: '#D1FAE5',
    icon: 'checkmark-circle',
  },
  {
    id: '#0002',
    platform: 'Kalshi',
    status: 'PENDING',
    betType: 'Spread',
    wager: 100,
    potential: 190,
    roi: 90,
    timestamp: 'Today, 1:20 PM',
    statusColor: '#D97706',
    statusBg: '#FEF3C7',
    icon: 'time',
  },
  {
    id: '#0003',
    platform: 'PrizePicks',
    status: 'LOSS',
    betType: 'Over/Under',
    wager: 25,
    potential: 47.5,
    roi: 90,
    timestamp: 'Yesterday, 8:30 PM',
    statusColor: '#DC2626',
    statusBg: '#FEE2E2',
    icon: 'close-circle',
  },
];

type TimePeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export default function DashboardScreen() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Weekly');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleLogout = () => {
    router.replace('/');
  };

  const handleDismissTooltip = () => {
    setSelectedDay(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Welcome Back, John</Text>
          <Text style={styles.headerQuote}>"Don't just play the books, keep your own."</Text>
        </View>

        {/* Total Profit/Loss Card */}
        <View style={styles.profitCard}>
          <Text style={styles.profitLabel}>TOTAL PROFIT/LOSS</Text>
          <View style={styles.profitValueRow}>
            <Text style={styles.profitValue}>$ +2,450</Text>
            <View style={styles.percentageContainer}>
              <Ionicons name="trending-up" size={20} color="#10B981" />
              <Text style={styles.percentageText}>+245.0%</Text>
            </View>
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
              onPress={() => setSelectedPeriod(period)}
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
          <PerformanceChart selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
        </TouchableOpacity>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <View style={styles.activityTitleRow}>
            <Text style={styles.activityTitle}>Recent Activity</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/stats')}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="arrow-forward" size={16} color="#6366F1" />
            </TouchableOpacity>
          </View>

          {sampleBets.map((bet) => (
            <TouchableOpacity
              key={bet.id}
              style={styles.activityCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/bet-details/${bet.id.replace('#', '')}`)}
            >
              {/* Header Row */}
              <View style={styles.activityHeader}>
                <View style={styles.activityHeaderLeft}>
                  <Text style={styles.platformName}>{bet.platform}</Text>
                  <View style={[styles.badge, { backgroundColor: bet.statusBg }]}>
                    <Text style={[styles.badgeText, { color: bet.statusColor }]}>
                      {bet.status}
                    </Text>
                  </View>
                </View>
                <Ionicons name={bet.icon as any} size={24} color={bet.statusColor} />
              </View>

              {/* Bet Type */}
              <Text style={styles.betType}>{bet.betType}</Text>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>WAGER</Text>
                  <Text style={styles.statValue}>${bet.wager}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>POTENTIAL</Text>
                  <Text style={styles.statValue}>${bet.potential}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ROI</Text>
                  <Text style={styles.roiValue}>+{bet.roi}%</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.activityFooter}>
                <Text style={styles.timestamp}>{bet.timestamp}</Text>
                <Text style={styles.betId}>{bet.id}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Performance Chart Component
interface PerformanceChartProps {
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
}

function PerformanceChart({ selectedDay, setSelectedDay }: PerformanceChartProps) {
  const chartWidth = SCREEN_WIDTH - 80;
  const chartHeight = 220;
  const padding = 40;
  const effectiveWidth = chartWidth - padding * 2;
  const effectiveHeight = chartHeight - padding * 2 - 20;

  // Calculate max profit for Y-axis scaling
  const maxProfit = Math.max(...weeklyData.map(d => d.profit));
  const yAxisMax = Math.ceil(maxProfit / 350) * 350; // Round to nearest 350

  // Convert data points to chart coordinates
  const points = weeklyData.map((data, index) => {
    const x = padding + (index / 6) * effectiveWidth;
    const y = padding + effectiveHeight - (data.profit / yAxisMax) * effectiveHeight;
    return { x, y, ...data };
  });

  // Create smooth curve path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` Q ${cpx} ${prev.y}, ${curr.x} ${curr.y}`;
  }

  // Generate Y-axis labels with dollar amounts
  const yAxisLabels = [];
  for (let i = 0; i <= 4; i++) {
    yAxisLabels.push((i * yAxisMax) / 4);
  }

  const handleDotPress = (day: string, e: GestureResponderEvent) => {
    e.stopPropagation();
    setSelectedDay(selectedDay === day ? null : day);
  };

  const getSelectedDayData = () => {
    if (!selectedDay) return null;
    return weeklyData.find(d => d.day === selectedDay);
  };

  const selectedData = getSelectedDayData();

  return (
    <View style={styles.chartWrapper}>
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Y-axis reference lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <Line
              key={`line-${i}`}
              x1={padding}
              y1={padding + (i * effectiveHeight) / 4}
              x2={chartWidth - padding}
              y2={padding + (i * effectiveHeight) / 4}
              stroke="#F5F5F5"
              strokeWidth="1"
            />
          ))}

          {/* Performance curve */}
          <Path d={pathD} stroke="#6366F1" strokeWidth="3" fill="none" />

          {/* Data points as circles in SVG */}
          {points.map((point, index) => (
            <Circle
              key={`circle-${index}`}
              cx={point.x}
              cy={point.y}
              r={selectedDay === point.day ? 7 : 5}
              fill="#6366F1"
              stroke="#FFFFFF"
              strokeWidth={selectedDay === point.day ? 4 : 3}
            />
          ))}

          {/* X-axis labels */}
          {weeklyData.map((data, index) => (
            <SvgText
              key={`day-${index}`}
              x={padding + (index / 6) * effectiveWidth}
              y={chartHeight - 8}
              fontSize="11"
              fill="#9CA3AF"
              textAnchor="middle"
              fontWeight="500"
            >
              {data.day}
            </SvgText>
          ))}

          {/* Y-axis labels with dollar amounts */}
          {yAxisLabels.map((value, i) => (
            <SvgText
              key={`yaxis-${i}`}
              x={padding - 10}
              y={padding + (4 - i) * (effectiveHeight / 4) + 4}
              fontSize="10"
              fill="#9CA3AF"
              textAnchor="end"
            >
              ${Math.round(value).toLocaleString()}
            </SvgText>
          ))}
        </Svg>

        {/* Interactive Dots with Tooltips */}
        {points.map((point, index) => (
          <TouchableOpacity
            key={`dot-${index}`}
            style={[
              styles.dotTouchable,
              {
                left: point.x - 15,
                top: point.y - 15,
                transform: [{ scale: selectedDay === point.day ? 1.2 : 1 }],
              },
            ]}
            onPress={(e) => handleDotPress(point.day, e)}
            activeOpacity={0.8}
          >
            {/* Tooltip */}
            {selectedDay === point.day && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>
                  {point.day}: +${point.profit}
                </Text>
                <View style={styles.tooltipArrow} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
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
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#6B6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
});
