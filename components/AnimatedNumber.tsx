import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TextStyle } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delay?: number;
  duration?: number;
  style?: TextStyle;
}

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  delay = 0,
  duration = 800,
  style,
}: AnimatedNumberProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animValue.setValue(0);
    const timer = setTimeout(() => {
      const id = animValue.addListener(({ value: v }) => setDisplayValue(v));
      Animated.timing(animValue, {
        toValue: value,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        animValue.removeListener(id);
        setDisplayValue(value);
      });
    }, delay);
    return () => {
      clearTimeout(timer);
      animValue.removeAllListeners();
      animValue.stopAnimation();
    };
  }, [value, duration, delay]);

  const formatted = decimals > 0
    ? displayValue.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(displayValue).toLocaleString('en-US');

  return (
    <Text style={style}>
      {prefix}{formatted}{suffix}
    </Text>
  );
}
