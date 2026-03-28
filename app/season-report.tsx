import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { usePreferences } from '@/context/PreferencesContext';
import { formatCurrency, formatROI } from '@/lib/formatters';
import { generateSeasonReport, SeasonReport } from '@/lib/seasonReport';
import FadeInView from '@/components/FadeInView';
import * as Haptics from 'expo-haptics';

const SPORT_EMOJI: Record<string, string> = {
  NFL: '\uD83C\uDFC8',
  NBA: '\uD83C\uDFC0',
  MLB: '\u26BE',
  NHL: '\uD83C\uDFD2',
  NCAAF: '\uD83C\uDFC8',
  NCAAB: '\uD83C\uDFC0',
};

const formatBetType = (type: string): string => {
  if (type === 'over_under') return 'Over/Under';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function SeasonReportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { currency, showBalance } = usePreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const params = useLocalSearchParams<{
    sport: string;
    seasonLabel: string;
    startDate: string;
    endDate: string;
  }>();

  const [report, setReport] = useState<SeasonReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    if (!user || !params.sport) return;
    (async () => {
      try {
        const result = await generateSeasonReport(user.id, {
          sport: params.sport,
          label: params.seasonLabel || '',
          startDate: params.startDate || '',
          endDate: params.endDate || '',
        });
        setReport(result);
      } catch (err) {
        console.error('[SeasonReport] Error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, params.sport, params.seasonLabel]);

  const getValueColor = (value: number) =>
    value >= 0 ? colors.accent : colors.loss;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Generating your report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Could not generate report</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: colors.accent, fontWeight: '600' }}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1 — Hero Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.heroCard}>
            <Text style={styles.heroEmoji}>
              {SPORT_EMOJI[report.season.sport] || '\uD83C\uDFC6'}
            </Text>
            <Text style={styles.heroLabel}>{report.season.label}</Text>
            <Text style={styles.heroSubtitle}>Your Season in Review</Text>
            <Text style={styles.heroRecord}>
              {report.record.wins}-{report.record.losses}
              {report.record.pushes > 0 ? `-${report.record.pushes}` : ''}
            </Text>
            <Text
              style={[styles.heroRoi, { color: getValueColor(report.roi) }]}
            >
              {showBalance ? formatROI(report.roi) + ' ROI' : '\u2022\u2022\u2022\u2022 ROI'}
            </Text>
          </View>
        </FadeInView>

        {/* Section 2 — Key Numbers (2x2) */}
        <FadeInView delay={150} direction="bottom">
          <View style={styles.gridRow}>
            <View style={styles.gridCard}>
              <Ionicons name="cash-outline" size={20} color={colors.accent} />
              <Text style={styles.gridLabel}>Total Wagered</Text>
              <Text style={styles.gridValue}>
                {formatCurrency(report.totalWagered, currency, showBalance)}
              </Text>
            </View>
            <View style={styles.gridCard}>
              <Ionicons
                name="trending-up"
                size={20}
                color={getValueColor(report.netProfit)}
              />
              <Text style={styles.gridLabel}>Net Profit</Text>
              <Text
                style={[
                  styles.gridValue,
                  { color: getValueColor(report.netProfit) },
                ]}
              >
                {showBalance
                  ? (report.netProfit >= 0 ? '+' : '') +
                    formatCurrency(report.netProfit, currency, true)
                  : '\u2022\u2022\u2022\u2022'}
              </Text>
            </View>
          </View>
          <View style={[styles.gridRow, { marginBottom: 24 }]}>
            <View style={styles.gridCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={styles.gridLabel}>Win Rate</Text>
              <Text style={styles.gridValue}>
                {Math.round(report.winRate)}%
              </Text>
            </View>
            <View style={styles.gridCard}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={styles.gridLabel}>Bets Per Week</Text>
              <Text style={styles.gridValue}>
                {report.betsPerWeek.toFixed(1)}
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* Section 3 — Highlights */}
        <FadeInView delay={300} direction="bottom">
          {report.biggestWin && (
            <View style={styles.highlightCard}>
              <View style={styles.highlightHeader}>
                <Ionicons name="trophy" size={18} color={colors.accent} />
                <Text style={styles.highlightTitle}>Biggest Win</Text>
              </View>
              <Text
                style={[styles.highlightAmount, { color: colors.accent }]}
              >
                {showBalance
                  ? '+' +
                    formatCurrency(report.biggestWin.amount, currency, true)
                  : '\u2022\u2022\u2022\u2022'}
              </Text>
              <Text style={styles.highlightDesc} numberOfLines={2}>
                {report.biggestWin.description}
              </Text>
              <Text style={styles.highlightDate}>
                {formatDate(report.biggestWin.date)}
              </Text>
            </View>
          )}

          {report.worstLoss && (
            <View style={styles.highlightCard}>
              <View style={styles.highlightHeader}>
                <Ionicons name="alert-circle" size={18} color={colors.loss} />
                <Text style={styles.highlightTitle}>Toughest Loss</Text>
              </View>
              <Text style={[styles.highlightAmount, { color: colors.loss }]}>
                {showBalance
                  ? '-' +
                    formatCurrency(report.worstLoss.amount, currency, true)
                  : '\u2022\u2022\u2022\u2022'}
              </Text>
              <Text style={styles.highlightDesc} numberOfLines={2}>
                {report.worstLoss.description}
              </Text>
              <Text style={styles.highlightDate}>
                {formatDate(report.worstLoss.date)}
              </Text>
            </View>
          )}

          <View style={styles.streakRow}>
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>{'\uD83D\uDD25'}</Text>
              <Text style={styles.streakLabel}>Longest Win Streak</Text>
              <Text style={styles.streakValue}>
                {report.longestWinStreak}
              </Text>
            </View>
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>{'\u2744\uFE0F'}</Text>
              <Text style={styles.streakLabel}>Longest Loss Streak</Text>
              <Text style={styles.streakValue}>
                {report.longestLossStreak}
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* Section 4 — What Worked / What Didn't */}
        <FadeInView delay={450} direction="bottom">
          <View style={{ marginBottom: 12 }}>
            {report.bestBetType && (
              <View
                style={[styles.edgeCard, { borderLeftColor: colors.accent }]}
              >
                <Text style={styles.edgeLabel}>Best Bet Type</Text>
                <Text style={styles.edgeType}>
                  {formatBetType(report.bestBetType.type)}
                </Text>
                <View style={styles.edgeRow}>
                  <Text style={[styles.edgeRoi, { color: colors.accent }]}>
                    {showBalance
                      ? formatROI(report.bestBetType.roi)
                      : '\u2022\u2022\u2022\u2022'}
                  </Text>
                  <Text style={styles.edgeRecord}>
                    {report.bestBetType.record}
                  </Text>
                </View>
              </View>
            )}

            {report.worstBetType &&
              report.worstBetType.type !== report.bestBetType?.type && (
                <View
                  style={[styles.edgeCard, { borderLeftColor: colors.loss }]}
                >
                  <Text style={styles.edgeLabel}>Worst Bet Type</Text>
                  <Text style={styles.edgeType}>
                    {formatBetType(report.worstBetType.type)}
                  </Text>
                  <View style={styles.edgeRow}>
                    <Text style={[styles.edgeRoi, { color: colors.loss }]}>
                      {showBalance
                        ? formatROI(report.worstBetType.roi)
                        : '\u2022\u2022\u2022\u2022'}
                    </Text>
                    <Text style={styles.edgeRecord}>
                      {report.worstBetType.record}
                    </Text>
                  </View>
                </View>
              )}

            {report.bestSportsbook && (
              <View
                style={[styles.edgeCard, { borderLeftColor: colors.accent }]}
              >
                <Text style={styles.edgeLabel}>Best Sportsbook</Text>
                <Text style={styles.edgeType}>
                  {report.bestSportsbook.name}
                </Text>
                <Text style={[styles.edgeRoi, { color: colors.accent }]}>
                  {showBalance
                    ? formatROI(report.bestSportsbook.roi)
                    : '\u2022\u2022\u2022\u2022'}
                </Text>
              </View>
            )}
          </View>
        </FadeInView>

        {/* Section 5 — Betting Personality */}
        <FadeInView delay={600} direction="bottom">
          <View style={styles.personalityCard}>
            <Text style={styles.personalityLabel}>
              {report.personalityLabel}
            </Text>
            <Text style={styles.personalityDesc}>
              {report.personalityDescription}
            </Text>
            {report.bestReasoningTag && (
              <Text style={styles.personalityDetail}>
                Most profitable approach: {report.bestReasoningTag.tag}
              </Text>
            )}
            {report.averageConfidence !== null && (
              <Text style={styles.personalityDetail}>
                Average confidence: {report.averageConfidence.toFixed(1)}/5
                stars
              </Text>
            )}
          </View>
        </FadeInView>

        {/* Section 6 — Year Over Year */}
        {report.previousSeasonROI !== null && report.roiChange !== null && (
          <FadeInView delay={750} direction="bottom">
            <View style={styles.yoyCard}>
              <Text style={styles.yoyTitle}>Year Over Year</Text>
              <View style={styles.yoyRow}>
                <View style={styles.yoyColumn}>
                  <Text style={styles.yoyLabel}>Last Season</Text>
                  <Text
                    style={[
                      styles.yoyValue,
                      { color: getValueColor(report.previousSeasonROI) },
                    ]}
                  >
                    {showBalance
                      ? formatROI(report.previousSeasonROI)
                      : '\u2022\u2022\u2022\u2022'}
                  </Text>
                </View>
                <Ionicons
                  name={
                    report.roiChange >= 0 ? 'trending-up' : 'trending-down'
                  }
                  size={28}
                  color={getValueColor(report.roiChange)}
                />
                <View style={styles.yoyColumn}>
                  <Text style={styles.yoyLabel}>This Season</Text>
                  <Text
                    style={[
                      styles.yoyValue,
                      { color: getValueColor(report.roi) },
                    ]}
                  >
                    {showBalance ? formatROI(report.roi) : '\u2022\u2022\u2022\u2022'}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.yoyChange,
                  { color: getValueColor(report.roiChange) },
                ]}
              >
                {report.roiChange >= 0
                  ? `Improved by +${Math.abs(report.roiChange).toFixed(1)}%`
                  : `Down ${Math.abs(report.roiChange).toFixed(1)}% from last season`}
              </Text>
            </View>
          </FadeInView>
        )}

        {/* Section 7 — Footer */}
        <FadeInView delay={900} direction="none">
          <Text style={styles.footerText}>Powered by Ledgr</Text>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
      marginTop: 4,
    },

    // Section 1 — Hero
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      alignItems: 'center',
      overflow: 'hidden',
    },
    heroEmoji: {
      position: 'absolute',
      right: 16,
      top: 16,
      fontSize: 80,
      opacity: 0.05,
    },
    heroLabel: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    heroRecord: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    heroRoi: {
      fontSize: 22,
      fontWeight: '600',
    },

    // Section 2 — Key Numbers
    gridRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    gridCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    gridLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 4,
    },
    gridValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },

    // Section 3 — Highlights
    highlightCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    highlightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    highlightTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    highlightAmount: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    highlightDesc: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 4,
    },
    highlightDate: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    streakRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    streakCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    streakEmoji: {
      fontSize: 24,
      marginBottom: 6,
    },
    streakLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
    },
    streakValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },

    // Section 4 — What Worked / What Didn't
    edgeCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 3,
    },
    edgeLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    edgeType: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    edgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    edgeRoi: {
      fontSize: 16,
      fontWeight: '700',
    },
    edgeRecord: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    // Section 5 — Personality
    personalityCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.accent + '40',
    },
    personalityLabel: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.accent,
      marginBottom: 8,
    },
    personalityDesc: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 12,
    },
    personalityDetail: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 4,
    },

    // Section 6 — Year Over Year
    yoyCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      alignItems: 'center',
    },
    yoyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    yoyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      width: '100%',
      marginBottom: 12,
    },
    yoyColumn: {
      alignItems: 'center',
    },
    yoyLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    yoyValue: {
      fontSize: 22,
      fontWeight: '700',
    },
    yoyChange: {
      fontSize: 14,
      fontWeight: '600',
    },

    // Section 7 — Footer
    footerText: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingBottom: 40,
      marginTop: 8,
    },
  });
}
