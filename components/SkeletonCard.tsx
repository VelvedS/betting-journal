import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from './SkeletonLoader';
import { useTheme } from '@/context/ThemeContext';

export default function SkeletonCard() {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <SkeletonLoader width="100%" height={16} borderRadius={8} />
      <SkeletonLoader width="60%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
      <SkeletonLoader width="40%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
});
