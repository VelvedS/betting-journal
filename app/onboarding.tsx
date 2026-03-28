import React, { useCallback, useRef, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  interpolateColor,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedPressable from '@/components/AnimatedPressable';

import PhysicsHeroScreen from '@/components/onboarding/PhysicsHeroScreen';
import SocialProofScreen from '@/components/onboarding/SocialProofScreen';
import PlatformShowcaseScreen from '@/components/onboarding/PlatformShowcaseScreen';
import FeatureWalkthroughScreen from '@/components/onboarding/FeatureWalkthroughScreen';
import FirstBetScreen from '@/components/onboarding/FirstBetScreen';
import PricingScreen from '@/components/onboarding/PricingScreen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_COUNT = 6;

function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 24, 8],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    );
    const backgroundColor = interpolateColor(
      scrollX.value,
      inputRange,
      ['#C4C4C4', '#1a1a1a', '#C4C4C4'],
    );
    return { width, opacity, backgroundColor };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.value = e.nativeEvent.contentOffset.x;
  }, []);

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(page);
  }, []);

  const goToPage = useCallback((page: number) => {
    scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
    // activeIndex will be set by onMomentumScrollEnd, but also set it eagerly
    // for immediate button label change
    setActiveIndex(page);
  }, []);

  const markOnboardingDone = useCallback(async () => {
    await AsyncStorage.setItem('@onboarding_complete', 'true');
  }, []);

  const handleNext = useCallback(() => {
    if (activeIndex < PAGE_COUNT - 1) {
      goToPage(activeIndex + 1);
    } else {
      // Last page — Get Started
      markOnboardingDone().catch(() => {}).then(() => router.replace('/signup'));
    }
  }, [activeIndex]);

  const handleSkip = useCallback(() => {
    markOnboardingDone().catch(() => {}).then(() => router.replace('/'));
  }, []);

  const isLastPage = activeIndex === PAGE_COUNT - 1;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Horizontal pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        <View style={styles.page}>
          <PhysicsHeroScreen isActive={activeIndex === 0} />
        </View>
        <View style={styles.page}>
          <SocialProofScreen isActive={activeIndex >= 1} />
        </View>
        <View style={styles.page}>
          <PlatformShowcaseScreen isActive={activeIndex >= 2} />
        </View>
        <View style={styles.page}>
          <FeatureWalkthroughScreen isActive={activeIndex >= 3} />
        </View>
        <View style={styles.page}>
          <FirstBetScreen isActive={activeIndex >= 4} />
        </View>
        <View style={styles.page}>
          <PricingScreen isActive={activeIndex >= 5} />
        </View>
      </ScrollView>

      {/* Bottom navigation bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Skip */}
        <AnimatedPressable
          style={styles.skipButton}
          onPress={handleSkip}
          scaleDown={0.94}
        >
          <Text style={styles.skipText}>Skip</Text>
        </AnimatedPressable>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: PAGE_COUNT }).map((_, i) => (
            <Dot key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        {/* Next / Get Started */}
        <AnimatedPressable
          style={[styles.nextButton, isLastPage && styles.getStartedButton]}
          onPress={handleNext}
          scaleDown={0.95}
        >
          <Text style={[styles.nextText, isLastPage && styles.getStartedText]}>
            {isLastPage ? 'Get Started' : 'Next'}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f6',
  },

  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    overflow: 'hidden',
  },

  // ── Bottom bar ─────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(248,248,246,0.95)',
  },

  skipButton: {
    width: 80,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9B9B9B',
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  nextButton: {
    width: 80,
    alignItems: 'flex-end',
  },
  nextText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },

  getStartedButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: 'auto',
    alignItems: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
