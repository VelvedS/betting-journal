import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import FadeInView from '@/components/FadeInView';
import type { PatternAlert } from '@/lib/patternDetection';

const PRIORITY_COLORS: Record<string, { icon: string; bg: string }> = {
  low: { icon: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  medium: { icon: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  high: { icon: '#2DC672', bg: 'rgba(45, 198, 114, 0.12)' },
};

// High-priority warnings get red instead of green
const WARNING_TYPES = new Set(['losing_market', 'cold_streak']);

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InsightsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [alerts, setAlerts] = useState<(PatternAlert & { timestamp?: string })[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const raw = await AsyncStorage.getItem('recent_alerts');
        const parsed: (PatternAlert & { timestamp?: string })[] = raw ? JSON.parse(raw) : [];
        setAlerts(parsed);
      })();
    }, []),
  );

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
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>Patterns detected in your betting</Text>
          </View>
        </FadeInView>

        {alerts.length === 0 ? (
          <FadeInView delay={100} direction="bottom">
            <View style={styles.emptyCard}>
              <Ionicons name="sparkles" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>
                As you log more bets, Ledgr will surface patterns in your data here.
              </Text>
              <Text style={styles.emptySubtitle}>
                Patterns are detected each time you settle a bet.
              </Text>
            </View>
          </FadeInView>
        ) : (
          alerts.map((alert, i) => {
            const isWarning = WARNING_TYPES.has(alert.type) && alert.priority === 'high';
            const colorSet = isWarning
              ? { icon: colors.loss, bg: 'rgba(232, 93, 93, 0.12)' }
              : PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.low;

            return (
              <FadeInView key={`${alert.type}-${alert.timestamp}-${i}`} delay={60 + i * 50} direction="bottom">
                <View style={styles.alertCard}>
                  <View style={[styles.alertIconCircle, { backgroundColor: colorSet.bg }]}>
                    <Ionicons name={(alert.icon || 'bulb-outline') as any} size={18} color={colorSet.icon} />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertMessage} numberOfLines={3}>
                      {alert.message}
                    </Text>
                    {alert.timestamp && (
                      <Text style={styles.alertTimestamp}>
                        {formatRelativeTime(alert.timestamp)}
                      </Text>
                    )}
                  </View>
                </View>
              </FadeInView>
            );
          })
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
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    alertCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    alertIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    alertContent: {
      flex: 1,
    },
    alertMessage: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    alertTimestamp: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 6,
    },
    emptyCard: {
      alignItems: 'center',
      padding: 40,
      marginTop: 40,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 22,
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
