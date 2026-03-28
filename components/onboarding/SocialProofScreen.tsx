import React, { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SocialProofScreenProps {
  isActive: boolean;
}

const STATS = [
  { value: '10,000+', label: 'Bets Tracked' },
  { value: '4.9', label: 'App Rating', icon: 'star' as const },
  { value: '92%', label: 'Return Rate' },
];

const TESTIMONIALS = [
  {
    quote: '"Finally a clean app that tracks sports bets AND prediction markets. Exactly what I needed."',
    author: 'Jake M.',
    detail: 'DraftKings & Kalshi user',
  },
  {
    quote: '"I\'ve tried 5 other trackers. Ledgr is the only one that doesn\'t feel like a spreadsheet."',
    author: 'Sarah L.',
    detail: 'FanDuel & Polymarket user',
  },
];

export default function SocialProofScreen({ isActive }: SocialProofScreenProps) {
  const hasAnimated = useRef(false);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);

  const statOpacities = STATS.map(() => useSharedValue(0));
  const statScales = STATS.map(() => useSharedValue(0.8));

  const cardOpacities = TESTIMONIALS.map(() => useSharedValue(0));
  const cardTranslateYs = TESTIMONIALS.map(() => useSharedValue(30));

  useEffect(() => {
    if (isActive && !hasAnimated.current) {
      hasAnimated.current = true;

      // Title
      titleOpacity.value = withTiming(1, { duration: 400 });
      titleTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });

      // Stats — stagger 200ms each, starting at 200ms
      STATS.forEach((_, i) => {
        statOpacities[i].value = withDelay(200 + i * 200, withTiming(1, { duration: 350 }));
        statScales[i].value = withDelay(
          200 + i * 200,
          withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.1)) }),
        );
      });

      // Testimonials — stagger 150ms each, starting at 800ms
      TESTIMONIALS.forEach((_, i) => {
        cardOpacities[i].value = withDelay(800 + i * 150, withTiming(1, { duration: 400 }));
        cardTranslateYs[i].value = withDelay(
          800 + i * 150,
          withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
        );
      });
    }
  }, [isActive]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.titleSection, titleStyle]}>
        <Text style={styles.eyebrow}>TRUSTED BY BETTORS</Text>
        <Text style={styles.title}>Join Thousands{'\n'}Finding Their Edge</Text>
      </Animated.View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {STATS.map((stat, i) => {
          const style = useAnimatedStyle(() => ({
            opacity: statOpacities[i].value,
            transform: [{ scale: statScales[i].value }],
          }));
          return (
            <Animated.View key={i} style={[styles.statCard, style]}>
              <View style={styles.statValueRow}>
                {stat.icon === 'star' && (
                  <Ionicons name="star" size={16} color="#F5A623" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Testimonials */}
      <View style={styles.testimonials}>
        {TESTIMONIALS.map((t, i) => {
          const style = useAnimatedStyle(() => ({
            opacity: cardOpacities[i].value,
            transform: [{ translateY: cardTranslateYs[i].value }],
          }));
          return (
            <Animated.View key={i} style={[styles.testimonialCard, style]}>
              <Text style={styles.quoteText}>{t.quote}</Text>
              <View style={styles.authorRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{t.author[0]}</Text>
                </View>
                <View>
                  <Text style={styles.authorName}>{t.author}</Text>
                  <Text style={styles.authorDetail}>{t.detail}</Text>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 90,
  },

  titleSection: {
    marginBottom: 32,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2DC672',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    lineHeight: 34,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9B9B9B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  testimonials: {
    gap: 16,
  },
  testimonialCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  quoteText: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#4A4A4A',
    lineHeight: 21,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f9ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2DC672',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  authorDetail: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9B9B9B',
  },
});
