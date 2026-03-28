import React from 'react';
import { ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from '@/context/ThemeContext';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const { colors } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.7 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
        repeatReverse: true,
      }}
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    />
  );
}
