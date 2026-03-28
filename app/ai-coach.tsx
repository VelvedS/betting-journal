import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { prepareCoachData } from '@/lib/coachDataPreparer';
import * as Haptics from 'expo-haptics';
import FadeInView from '@/components/FadeInView';

type Insight = {
  id?: string;
  title: string;
  body: string;
  type: 'strength' | 'weakness' | 'pattern' | 'warning' | 'opportunity';
  generated_at: string;
  is_read?: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  strength: '#2DC672',
  weakness: '#E85D5D',
  pattern: '#3B82F6',
  warning: '#F59E0B',
  opportunity: '#8B5CF6',
};

function PulsingText({ text, style }: { text: string; style: any }) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.Text style={[style, animStyle]}>{text}</Animated.Text>
  );
}

function SkeletonCard({ colors }: { colors: any }) {
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
          marginBottom: 12,
          height: 120,
        },
        style,
      ]}
    >
      <View style={{ width: 60, height: 22, borderRadius: 11, backgroundColor: colors.border, marginBottom: 10 }} />
      <View style={{ width: '70%', height: 16, borderRadius: 8, backgroundColor: colors.border, marginBottom: 8 }} />
      <View style={{ width: '100%', height: 12, borderRadius: 6, backgroundColor: colors.border, marginBottom: 4 }} />
      <View style={{ width: '85%', height: 12, borderRadius: 6, backgroundColor: colors.border }} />
    </Animated.View>
  );
}

export default function AICoachScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [pastInsights, setPastInsights] = useState<Insight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoursUntilRefresh, setHoursUntilRefresh] = useState<number | null>(null);
  const [settledCount, setSettledCount] = useState<number | null>(null);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);

  // Fetch existing insights + settled bet count
  const fetchInsights = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get settled bet count
    const { count } = await supabase
      .from('bets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['won', 'lost']);
    setSettledCount(count ?? 0);

    // Get all insights for this user (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .gte('generated_at', thirtyDaysAgo.toISOString())
      .order('generated_at', { ascending: false });

    const all = (data || []) as Insight[];

    if (all.length > 0) {
      // Group: latest generation vs past
      const latestTime = all[0].generated_at;
      const latest = all.filter((i) => i.generated_at === latestTime);
      const past = all.filter((i) => i.generated_at !== latestTime);
      setInsights(latest);
      setPastInsights(past);

      // Check rate limit
      const hoursSince = (Date.now() - new Date(latestTime).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        setHoursUntilRefresh(Math.ceil(24 - hoursSince));
      } else {
        setHoursUntilRefresh(null);
      }
    } else {
      setInsights([]);
      setPastInsights([]);
      setHoursUntilRefresh(null);
    }

    // Mark all as read
    await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleGenerate = useCallback(async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);

    try {
      const dataSnapshot = await prepareCoachData(user.id);
      const response = await supabase.functions.invoke('generate-insights', {
        body: { dataSnapshot },
      });

      const { data, error } = response;
      if (error) {
        // Extract the real error from FunctionsHttpError
        const context = (error as any)?.context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            throw new Error(body?.error || error.message || 'Failed to generate insights');
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('json')) throw parseErr;
          }
        }
        throw new Error(error.message || 'Failed to generate insights');
      }
      if (data?.error) throw new Error(data.error);

      // Set insights directly from response for instant display
      // (avoids DB propagation delay from re-querying ai_insights)
      if (data?.insights && Array.isArray(data.insights)) {
        const now = new Date().toISOString();
        const newInsights: Insight[] = data.insights.map((i: any) => ({
          title: i.title,
          body: i.body,
          type: i.type,
          generated_at: now,
        }));
        // Move current insights to past
        if (insights.length > 0) {
          setPastInsights((prev) => [...insights, ...prev]);
        }
        setInsights(newInsights);
        setHoursUntilRefresh(24);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [user, insights]);

  const canGenerate = hoursUntilRefresh === null && !generating;
  const tooFewBets = settledCount !== null && settledCount < 10;

  const buttonLabel = generating
    ? 'Analyzing your patterns...'
    : hoursUntilRefresh !== null
    ? `Available in ${hoursUntilRefresh}h`
    : 'Generate New Insights';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Ionicons name="sparkles" size={32} color={colors.accent} />
            <Text style={styles.title}>Your Betting Coach</Text>
            <Text style={styles.subtitle}>AI analysis of your betting patterns</Text>
          </View>
        </FadeInView>

        {tooFewBets ? (
          /* Empty state */
          <FadeInView delay={100} direction="bottom">
            <View style={styles.emptyCard}>
              <Ionicons name="sparkles" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>Log at least 10 bets to unlock your AI Coach</Text>
              <Text style={styles.emptySubtitle}>
                The more data Ledgr has, the smarter your insights become.
              </Text>
            </View>
          </FadeInView>
        ) : (
          <>
            {/* Generate button */}
            <FadeInView delay={80} direction="bottom">
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  !canGenerate && styles.generateButtonDisabled,
                ]}
                onPress={handleGenerate}
                disabled={!canGenerate}
                activeOpacity={0.8}
              >
                {generating ? (
                  <View style={styles.generatingRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <PulsingText
                      text="Analyzing your patterns..."
                      style={styles.generateButtonText}
                    />
                  </View>
                ) : (
                  <>
                    <Ionicons
                      name="sparkles"
                      size={18}
                      color={canGenerate ? '#fff' : colors.textTertiary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.generateButtonText,
                        !canGenerate && { color: colors.textTertiary },
                      ]}
                    >
                      {buttonLabel}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </FadeInView>

            {/* Loading skeleton */}
            {generating && insights.length === 0 && (
              <View style={{ marginTop: 16 }}>
                <SkeletonCard colors={colors} />
                <SkeletonCard colors={colors} />
                <SkeletonCard colors={colors} />
              </View>
            )}

            {/* Current insights */}
            {!loading && insights.length > 0 && (
              <View style={{ marginTop: 20 }}>
                {insights.map((insight, i) => {
                  const typeColor = TYPE_COLORS[insight.type] || TYPE_COLORS.pattern;
                  return (
                    <FadeInView key={insight.id || i} delay={120 + i * 100} direction="bottom">
                      <View style={[styles.insightCard, { borderLeftColor: typeColor }]}>
                        <View style={[styles.typeBadge, { backgroundColor: typeColor + '26' }]}>
                          <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                            {insight.type.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.insightTitle} numberOfLines={2}>{insight.title}</Text>
                        <Text style={styles.insightBody} numberOfLines={4}>{insight.body}</Text>
                        <Text style={styles.insightDate}>
                          Generated on{' '}
                          {new Date(insight.generated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </FadeInView>
                  );
                })}
              </View>
            )}

            {/* Past insights */}
            {!loading && pastInsights.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionTitle}>Past Insights</Text>
                {pastInsights.map((insight) => {
                  const typeColor = TYPE_COLORS[insight.type] || TYPE_COLORS.pattern;
                  const isExpanded = expandedPastId === insight.id;
                  return (
                    <TouchableOpacity
                      key={insight.id}
                      style={styles.pastCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExpandedPastId(isExpanded ? null : (insight.id ?? null));
                      }}
                    >
                      <View style={styles.pastCardHeader}>
                        <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
                        <Text style={styles.pastTitle} numberOfLines={isExpanded ? 0 : 1}>
                          {insight.title}
                        </Text>
                        <Text style={styles.pastDate}>
                          {new Date(insight.generated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      {isExpanded && (
                        <Text style={styles.pastBody} numberOfLines={3}>{insight.body}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Empty insights state */}
            {!loading && !generating && insights.length === 0 && (
              <FadeInView delay={100} direction="bottom">
                <View style={styles.emptyCard}>
                  <Ionicons name="sparkles" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No insights yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Tap the button above to generate your first AI coaching session.
                  </Text>
                </View>
              </FadeInView>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 100,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 10,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      height: 50,
      borderRadius: 12,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    generateButtonDisabled: {
      backgroundColor: colors.surface,
      shadowOpacity: 0,
      elevation: 0,
    },
    generateButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    generatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    insightCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    typeBadge: {
      alignSelf: 'flex-start',
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      justifyContent: 'center',
      marginBottom: 8,
    },
    typeBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    insightTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    insightBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 10,
    },
    insightDate: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    pastCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    pastCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    pastTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    pastDate: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    pastBody: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 8,
    },
    emptyCard: {
      alignItems: 'center',
      padding: 40,
      marginTop: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
  });
}
