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

interface PricingScreenProps {
  isActive: boolean;
}

const FREE_FEATURES = [
  'Track up to 50 bets/month',
  'Manual bet entry',
  'Basic stats & ROI',
  'Single sportsbook',
];

const PRO_FEATURES = [
  'Unlimited bets',
  'Photo slip extraction',
  'Advanced analytics',
  'All platforms',
  'Performance curves',
  'Weekly recap reports',
];

export default function PricingScreen({ isActive }: PricingScreenProps) {
  const hasAnimated = useRef(false);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);

  const freeCardOpacity = useSharedValue(0);
  const freeCardTranslateY = useSharedValue(30);

  const proCardOpacity = useSharedValue(0);
  const proCardTranslateY = useSharedValue(30);
  const proCardScale = useSharedValue(0.95);

  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive && !hasAnimated.current) {
      hasAnimated.current = true;

      // Title
      titleOpacity.value = withTiming(1, { duration: 400 });
      titleTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });

      // Free card
      freeCardOpacity.value = withDelay(250, withTiming(1, { duration: 400 }));
      freeCardTranslateY.value = withDelay(
        250,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );

      // Pro card — slight delay + scale bounce
      proCardOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
      proCardTranslateY.value = withDelay(
        400,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );
      proCardScale.value = withDelay(
        400,
        withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.08)) }),
      );

      // Footer
      footerOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    }
  }, [isActive]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const freeCardStyle = useAnimatedStyle(() => ({
    opacity: freeCardOpacity.value,
    transform: [{ translateY: freeCardTranslateY.value }],
  }));

  const proCardStyle = useAnimatedStyle(() => ({
    opacity: proCardOpacity.value,
    transform: [
      { translateY: proCardTranslateY.value },
      { scale: proCardScale.value },
    ],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  const cardWidth = (SCREEN_WIDTH - 24 * 2 - 12) / 2;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.titleSection, titleStyle]}>
        <Text style={styles.eyebrow}>PRICING</Text>
        <Text style={styles.title}>Start Free,{'\n'}Upgrade Anytime</Text>
        <Text style={styles.subtitle}>
          No commitment required. Try everything with the free plan.
        </Text>
      </Animated.View>

      {/* Cards row */}
      <View style={styles.cardsRow}>
        {/* Free card */}
        <Animated.View style={[styles.card, { width: cardWidth }, freeCardStyle]}>
          <Text style={styles.cardTier}>Free</Text>
          <Text style={styles.cardPrice}>$0</Text>
          <Text style={styles.cardPeriod}>forever</Text>
          <View style={styles.divider} />
          {FREE_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color="#2DC672" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Pro card */}
        <Animated.View style={[styles.card, styles.proCard, { width: cardWidth }, proCardStyle]}>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>POPULAR</Text>
          </View>
          <Text style={[styles.cardTier, styles.proTier]}>Pro</Text>
          <Text style={[styles.cardPrice, styles.proPrice]}>$4.99</Text>
          <Text style={[styles.cardPeriod, styles.proPeriod]}>/month</Text>
          <View style={[styles.divider, styles.proDivider]} />
          {PRO_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#2DC672" />
              <Text style={[styles.featureText, styles.proFeatureText]}>{f}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, footerStyle]}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#9B9B9B" />
        <Text style={styles.footerText}>Cancel anytime. No hidden fees.</Text>
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
    marginBottom: 28,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 21,
  },

  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  proCard: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2DC672',
    borderWidth: 1.5,
  },
  proBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#2DC672',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  cardTier: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 4,
  },
  proTier: {
    color: '#9B9B9B',
  },
  cardPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  proPrice: {
    color: '#fff',
  },
  cardPeriod: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9B9B9B',
    marginBottom: 12,
  },
  proPeriod: {
    color: '#6B6B6B',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginBottom: 12,
  },
  proDivider: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 11.5,
    fontWeight: '400',
    color: '#4A4A4A',
    flex: 1,
  },
  proFeatureText: {
    color: '#d4d4d4',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9B9B9B',
  },
});
