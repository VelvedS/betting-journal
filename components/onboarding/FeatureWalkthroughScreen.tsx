import React, { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FeatureWalkthroughScreenProps {
  isActive: boolean;
}

const FEATURES = [
  {
    icon: 'camera-outline' as const,
    color: '#2DC672',
    bg: '#e8f9ef',
    title: 'Snap & Log',
    description: 'Take a photo of your bet slip and we extract all the details automatically.',
  },
  {
    icon: 'stats-chart-outline' as const,
    color: '#6366F1',
    bg: '#eef0ff',
    title: 'Track Everything',
    description: 'Performance curves, ROI breakdowns, and win rates across every platform.',
  },
  {
    icon: 'layers-outline' as const,
    color: '#F5A623',
    bg: '#fef5e7',
    title: 'All in One Place',
    description: 'Sports bets, parlays, prediction markets, and event contracts — unified.',
  },
];

export default function FeatureWalkthroughScreen({ isActive }: FeatureWalkthroughScreenProps) {
  const hasAnimated = useRef(false);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);

  const featureOpacities = FEATURES.map(() => useSharedValue(0));
  const featureTranslateXs = FEATURES.map(() => useSharedValue(40));

  useEffect(() => {
    if (isActive && !hasAnimated.current) {
      hasAnimated.current = true;

      // Title
      titleOpacity.value = withTiming(1, { duration: 400 });
      titleTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });

      // Features — slide from right, 150ms stagger, starting at 300ms
      FEATURES.forEach((_, i) => {
        featureOpacities[i].value = withDelay(300 + i * 150, withTiming(1, { duration: 400 }));
        featureTranslateXs[i].value = withDelay(
          300 + i * 150,
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
        <Text style={styles.eyebrow}>HOW IT WORKS</Text>
        <Text style={styles.title}>Three Steps to{'\n'}Smarter Betting</Text>
      </Animated.View>

      <View style={styles.features}>
        {FEATURES.map((feature, i) => {
          const style = useAnimatedStyle(() => ({
            opacity: featureOpacities[i].value,
            transform: [{ translateX: featureTranslateXs[i].value }],
          }));
          return (
            <Animated.View key={i} style={[styles.featureCard, style]}>
              <View style={[styles.iconCircle, { backgroundColor: feature.bg }]}>
                <Ionicons name={feature.icon} size={24} color={feature.color} />
              </View>
              <View style={styles.featureTextBlock}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Step connectors */}
      <View style={styles.stepIndicators}>
        {FEATURES.map((_, i) => {
          const style = useAnimatedStyle(() => ({
            opacity: featureOpacities[i].value,
          }));
          return (
            <Animated.View key={i} style={[styles.stepRow, style]}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
              </View>
              {i < FEATURES.length - 1 && <View style={styles.stepLine} />}
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
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F5A623',
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

  features: {
    gap: 16,
    flex: 1,
    justifyContent: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextBlock: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 19,
  },

  stepIndicators: {
    position: 'absolute',
    left: 24,
    top: 0,
    bottom: 0,
    width: 0,
    // Hidden — kept as a design element placeholder
    opacity: 0,
  },
  stepRow: {
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E5E5',
  },
});
