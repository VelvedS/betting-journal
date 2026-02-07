import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [betCount, setBetCount] = useState<number | null>(null);

  const fetchBetCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('bets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setBetCount(count ?? 0);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchBetCount();
    }, [fetchBetCount])
  );

  const hasBets = betCount !== null && betCount > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {hasBets ? (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={32} color="#6366F1" />
          </View>
          <Text style={styles.title}>Bet History</Text>
          <Text style={styles.subtitle}>Coming soon — view your full betting history.</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="time-outline" size={40} color="#6366F1" />
          </View>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySubtitle}>
            Your completed bets will show up here
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/add-bet')}
          >
            <Text style={styles.emptyButtonText}>Add Your First Bet</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
