import React, { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { View, Text, StyleSheet } from 'react-native';

interface PlatformShowcaseScreenProps {
  isActive: boolean;
}

const PLATFORMS = [
  { label: 'FanDuel', short: 'FD', bg: '#1493FF' },
  { label: 'DraftKings', short: 'DK', bg: '#53D337' },
  { label: 'BetMGM', short: 'M', bg: '#C4A44E' },
  { label: 'ESPN BET', short: 'E', bg: '#FF4545' },
  { label: 'Kalshi', short: 'K', bg: '#6366F1' },
  { label: 'Polymarket', short: 'P', bg: '#0052FF' },
  { label: 'Caesars', short: 'C', bg: '#1C3A13' },
  { label: 'Hard Rock', short: 'HR', bg: '#D4A017' },
  { label: 'Bet365', short: '365', bg: '#006B3A' },
];

export default function PlatformShowcaseScreen({ isActive }: PlatformShowcaseScreenProps) {
  const hasAnimated = useRef(false);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);

  const badgeOpacities = PLATFORMS.map(() => useSharedValue(0));
  const badgeScales = PLATFORMS.map(() => useSharedValue(0.5));

  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive && !hasAnimated.current) {
      hasAnimated.current = true;

      // Title
      titleOpacity.value = withTiming(1, { duration: 400 });
      titleTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });

      // Badges — pop in with 60ms stagger starting at 250ms
      PLATFORMS.forEach((_, i) => {
        badgeOpacities[i].value = withDelay(250 + i * 60, withTiming(1, { duration: 300 }));
        badgeScales[i].value = withDelay(
          250 + i * 60,
          withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.15)) }),
        );
      });

      // Footer text
      footerOpacity.value = withDelay(250 + PLATFORMS.length * 60 + 200, withTiming(1, { duration: 400 }));
    }
  }, [isActive]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.titleSection, titleStyle]}>
        <Text style={styles.eyebrow}>ALL YOUR PLATFORMS</Text>
        <Text style={styles.title}>One Journal for{'\n'}Everything You Bet</Text>
        <Text style={styles.subtitle}>
          Track sportsbooks, prediction markets, and event contracts — all in one place.
        </Text>
      </Animated.View>

      {/* 3x3 grid */}
      <View style={styles.grid}>
        {PLATFORMS.map((platform, i) => {
          const style = useAnimatedStyle(() => ({
            opacity: badgeOpacities[i].value,
            transform: [{ scale: badgeScales[i].value }],
          }));
          return (
            <Animated.View key={i} style={[styles.platformCard, style]}>
              <View style={[styles.badge, { backgroundColor: platform.bg }]}>
                <Text style={styles.badgeText}>{platform.short}</Text>
              </View>
              <Text style={styles.platformLabel}>{platform.label}</Text>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View style={[styles.footer, footerStyle]}>
        <Text style={styles.footerText}>
          More platforms added regularly
        </Text>
      </Animated.View>
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
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 21,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  platformCard: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  platformLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B6B6B',
  },

  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9B9B9B',
    fontStyle: 'italic',
  },
});
