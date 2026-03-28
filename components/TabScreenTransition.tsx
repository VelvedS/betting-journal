import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const DURATION = 350;
const DELAY = 50;

export default function TabScreenTransition({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();
  const { isDark } = useTheme();
  const opacity = useSharedValue(isFocused ? 1 : 0);
  const scale = useSharedValue(isFocused ? 1 : 0.95);
  const blurProgress = useSharedValue(isFocused ? 0 : 20);
  const [blurIntensity, setBlurIntensity] = useState(isFocused ? 0 : 20);
  const [showBlur, setShowBlur] = useState(!isFocused);

  // Only show the blur defrost transition when *returning* to the tab,
  // not on initial mount.  On first mount blurProgress starts at 0 and
  // the animated reaction that calls hideBlur has already fired, so
  // calling setShowBlur(true) would leave a zombie BlurView covering
  // the screen and blocking all touches.
  const hasUnfocused = useRef(false);

  const updateBlur = (value: number) => {
    setBlurIntensity(Math.round(value));
  };

  const hideBlur = () => {
    setShowBlur(false);
  };

  useAnimatedReaction(
    () => blurProgress.value,
    (current) => {
      runOnJS(updateBlur)(current);
      if (current <= 0.5) {
        runOnJS(hideBlur)();
      }
    },
  );

  useEffect(() => {
    const timingConfig = { duration: DURATION, easing: Easing.out(Easing.cubic) };

    if (isFocused) {
      if (hasUnfocused.current) {
        setShowBlur(true);
      }
      opacity.value = withDelay(DELAY, withTiming(1, timingConfig));
      scale.value = withDelay(DELAY, withTiming(1, timingConfig));
      blurProgress.value = withDelay(DELAY, withTiming(0, timingConfig));
    } else {
      hasUnfocused.current = true;
      opacity.value = 0;
      scale.value = 0.95;
      blurProgress.value = 20;
      setShowBlur(true);
      setBlurIntensity(20);
    }
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
      {showBlur && (
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  );
}
