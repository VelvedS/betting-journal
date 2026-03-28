import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedPressable from '@/components/AnimatedPressable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

interface FirstBetScreenProps {
  isActive: boolean;
}

export default function FirstBetScreen({ isActive }: FirstBetScreenProps) {
  const hasAnimated = useRef(false);
  const [imageSelected, setImageSelected] = useState(false);
  const [manualToast, setManualToast] = useState(false);
  const manualToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animations
  const headlineOpacity = useSharedValue(0);
  const headlineTranslateY = useSharedValue(20);

  const card1Opacity = useSharedValue(0);
  const card1TranslateY = useSharedValue(30);

  const card2Opacity = useSharedValue(0);
  const card2TranslateY = useSharedValue(30);

  const skipOpacity = useSharedValue(0);

  // Success bounce for card 1
  const card1Scale = useSharedValue(1);

  // Manual toast
  const toastOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive && !hasAnimated.current) {
      hasAnimated.current = true;

      // Headline
      headlineOpacity.value = withTiming(1, { duration: 400 });
      headlineTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });

      // Card 1 — 200ms delay
      card1Opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      card1TranslateY.value = withDelay(
        200,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );

      // Card 2 — 350ms delay
      card2Opacity.value = withDelay(350, withTiming(1, { duration: 400 }));
      card2TranslateY.value = withDelay(
        350,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      );

      // Skip text — 500ms
      skipOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    }
  }, [isActive]);

  const handleSnapBet = useCallback(async () => {
    if (imageSelected) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await AsyncStorage.setItem('@onboarding_bet_image', result.assets[0].uri);
      setImageSelected(true);

      // Success bounce
      card1Scale.value = withSpring(1.03, { damping: 8, stiffness: 300 }, () => {
        card1Scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      });
    }
  }, [imageSelected]);

  const handleManualTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (manualToastTimer.current) clearTimeout(manualToastTimer.current);

    setManualToast(true);
    toastOpacity.value = withTiming(1, { duration: 200 });

    manualToastTimer.current = setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 300 });
      setTimeout(() => setManualToast(false), 300);
    }, 2000);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (manualToastTimer.current) clearTimeout(manualToastTimer.current);
    };
  }, []);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ translateY: headlineTranslateY.value }],
  }));

  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [
      { translateY: card1TranslateY.value },
      { scale: card1Scale.value },
    ],
  }));

  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateY: card2TranslateY.value }],
  }));

  const skipStyle = useAnimatedStyle(() => ({
    opacity: skipOpacity.value,
  }));

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Headline */}
      <Animated.View style={[styles.headlineSection, headlineStyle]}>
        <Text style={styles.eyebrow}>TRY IT NOW</Text>
        <Text style={styles.title}>Log Your First Bet.</Text>
        <Text style={styles.subtitle}>
          Snap a screenshot from any sportsbook or prediction market.
        </Text>
      </Animated.View>

      {/* Card 1 — Snap a Screenshot */}
      <Animated.View style={[styles.cardWrapper, card1Style]}>
        <AnimatedPressable
          style={[styles.card, imageSelected && styles.cardSuccess]}
          onPress={handleSnapBet}
          scaleDown={0.98}
        >
          <View
            style={[
              styles.iconSquare,
              { backgroundColor: imageSelected ? '#22c55e' : 'rgba(34,197,94,0.1)' },
            ]}
          >
            <Ionicons
              name={imageSelected ? 'checkmark-circle' : 'camera-outline'}
              size={26}
              color={imageSelected ? '#fff' : '#22c55e'}
            />
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitle}>
              {imageSelected ? 'Screenshot Saved!' : 'Snap a Screenshot'}
            </Text>
            <Text style={styles.cardDescription}>
              {imageSelected ? "We'll process it when you sign up" : 'Our AI reads it instantly'}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="rgba(0,0,0,0.2)"
          />
        </AnimatedPressable>
      </Animated.View>

      {/* Card 2 — Enter Manually */}
      <Animated.View style={[styles.cardWrapper, card2Style]}>
        <AnimatedPressable
          style={styles.card}
          onPress={handleManualTap}
          scaleDown={0.98}
        >
          <View style={[styles.iconSquare, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
            <Ionicons name="create-outline" size={26} color="#6366f1" />
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitle}>Enter Manually</Text>
            <Text style={styles.cardDescription}>Type in bet details yourself</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="rgba(0,0,0,0.2)"
          />
        </AnimatedPressable>

        {/* Inline toast */}
        {manualToast && (
          <Animated.View style={[styles.toast, toastStyle]}>
            <Text style={styles.toastText}>Available after sign-up</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Skip for now */}
      <Animated.View style={[styles.skipSection, skipStyle]}>
        <Text style={styles.skipText}>Skip for now</Text>
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
    alignItems: 'center',
  },

  headlineSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.35)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.4)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 21,
  },

  cardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 20,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardSuccess: {
    borderColor: 'rgba(34,197,94,0.3)',
  },
  iconSquare: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.4)',
  },

  toast: {
    marginTop: 8,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.35)',
    fontStyle: 'italic',
  },

  skipSection: {
    marginTop: 8,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.3)',
  },
});
