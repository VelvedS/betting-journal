import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  const handleLogout = () => {
    router.replace('/');
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
        <View style={styles.chartCard}>
          <Text style={styles.chartLabel}>PERFORMANCE CURVE</Text>
          <PerformanceChart />
        </View>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>Recent Activity</Text>

          {sampleBets.map((bet) => (
            <View key={bet.id} style={styles.activityCard}>
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
            </View>
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
function PerformanceChart() {
  const chartWidth = SCREEN_WIDTH - 80;
  const chartHeight = 180;
  const padding = 20;
  const effectiveWidth = chartWidth - padding * 2;
  const effectiveHeight = chartHeight - padding * 2;

  // Sample data points (Mon - Sun)
  const dataPoints = [
    { x: 0, y: 0.6 },
    { x: 1, y: 0.55 },
    { x: 2, y: 0.5 },
    { x: 3, y: 0.52 },
    { x: 4, y: 0.65 },
    { x: 5, y: 0.85 },
    { x: 6, y: 0.95 },
  ];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Convert data points to path coordinates
  const points = dataPoints.map((point, index) => {
    const x = padding + (point.x / 6) * effectiveWidth;
    const y = padding + effectiveHeight - point.y * effectiveHeight;
    return { x, y };
  });

  // Create smooth curve path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` Q ${cpx} ${prev.y}, ${curr.x} ${curr.y}`;
  }

  return (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis reference lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Line
            key={i}
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

        {/* Data points */}
        {points.map((point, index) => (
          <Circle key={index} cx={point.x} cy={point.y} r="4" fill="#6366F1" />
        ))}

        {/* X-axis labels */}
        {days.map((day, index) => (
          <SvgText
            key={day}
            x={padding + (index / 6) * effectiveWidth}
            y={chartHeight - 5}
            fontSize="10"
            fill="#9CA3AF"
            textAnchor="middle"
          >
            {day}
          </SvgText>
        ))}

        {/* Y-axis labels */}
        {[0, 1, 2, 3, 4].map((i) => (
          <SvgText
            key={i}
            x="5"
            y={padding + (4 - i) * (effectiveHeight / 4) + 3}
            fontSize="10"
            fill="#9CA3AF"
            textAnchor="start"
          >
            0
          </SvgText>
        ))}
      </Svg>
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
  chartContainer: {
    alignItems: 'center',
  },
  activitySection: {
    marginBottom: 24,
  },
  activityTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
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
