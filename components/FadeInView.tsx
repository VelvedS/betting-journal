import React, { useEffect } from 'react';
import { ViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { staggeredEntry } from '@/lib/animations';

interface FadeInViewProps extends ViewProps {
  children?: React.ReactNode;
  delay?: number;
  direction?: 'none' | 'bottom' | 'left' | 'right';
  offset?: number;
  duration?: number;
}

export default function FadeInView({
  children,
  delay = 0,
  direction = 'bottom',
  offset = 20,
  style,
  ...rest
}: FadeInViewProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(direction === 'bottom' ? offset : 0);
  const translateX = useSharedValue(
    direction === 'left' ? -offset : direction === 'right' ? offset : 0
  );

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, staggeredEntry));
    if (direction === 'bottom') {
      translateY.value = withDelay(delay, withSpring(0, staggeredEntry));
    } else if (direction === 'left' || direction === 'right') {
      translateX.value = withDelay(delay, withSpring(0, staggeredEntry));
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]} {...rest}>
      {children}
    </Animated.View>
  );
}
