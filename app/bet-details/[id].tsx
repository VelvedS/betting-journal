import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import RAnimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';

type BetStatus = 'pending' | 'won' | 'lost' | 'void';

const getLegStatusStyle = (status: string) => {
  switch (status) {
    case 'won':
      return { pillBg: '#1B3A2D', pillText: '#86EFAC' };
    case 'lost':
      return { pillBg: '#3B1515', pillText: '#FCA5A5' };
    default:
      return { pillBg: '#2D3748', pillText: '#9CA3AF' };
  }
};

const getStatusStyling = (status: string) => {
  switch (status) {
    case 'won':
      return {
        bgColor: '#E8F8F0',
        textColor: '#2DC672',
        iconName: 'trending-up' as const,
        iconBg: '#C6F0DC',
        label: 'Win',
      };
    case 'lost':
      return {
        bgColor: '#FFECEC',
        textColor: '#E85D5D',
        iconName: 'trending-down' as const,
        iconBg: '#FCA5A5',
        label: 'Loss',
      };
    case 'void':
      return {
        bgColor: '#F5F5F5',
        textColor: '#999999',
        iconName: 'ban' as const,
        iconBg: '#E5E5E5',
        label: 'Void',
      };
    case 'pending':
    default:
      return {
        bgColor: '#FFF5E0',
        textColor: '#F5A623',
        iconName: 'time' as const,
        iconBg: '#FDE68A',
        label: 'Pending',
      };
  }
};

function StatusPill({ value, selected, onPress }: { value: BetStatus; selected: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
  };

  const getStyles = () => {
    if (!selected) return { bg: '#F0F0F0', text: '#1A1A1A', border: '#F0F0F0', bw: 0 };
    switch (value) {
      case 'pending': return { bg: 'transparent', text: '#2DC672', border: '#2DC672', bw: 1 };
      case 'won': return { bg: '#2DC672', text: '#FFFFFF', border: '#2DC672', bw: 0 };
      case 'lost': return { bg: '#E85D5D', text: '#FFFFFF', border: '#E85D5D', bw: 0 };
      case 'void': return { bg: '#999999', text: '#FFFFFF', border: '#999999', bw: 0 };
    }
  };

  const s = getStyles();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.updatePill, { backgroundColor: s.bg, borderColor: s.border, borderWidth: s.bw }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <Text style={[styles.updatePillText, { color: s.text }]}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function BetDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const [bet, setBet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const betId = typeof id === 'string' ? id : '';

  // Pulse animation for pending status
  const pendingPulseOpacity = useSharedValue(1);
  const pendingPulseStyle = useAnimatedStyle(() => ({
    opacity: pendingPulseOpacity.value,
  }));

  useEffect(() => {
    if (bet?.status === 'pending') {
      pendingPulseOpacity.value = withRepeat(
        withTiming(0.5, { duration: 1000 }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pendingPulseOpacity);
      pendingPulseOpacity.value = 1;
    }
  }, [bet?.status]);

  const fetchBet = useCallback(async () => {
    if (!betId) return;
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('id', betId)
      .single();
    if (data) setBet(data);
    setLoading(false);
  }, [betId]);

  useFocusEffect(
    useCallback(() => {
      fetchBet();
    }, [fetchBet])
  );

  const handleUpdateStatus = async (newStatus: BetStatus) => {
    if (!bet) return;
    setUpdatingStatus(true);
    const { error } = await supabase
      .from('bets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', bet.id);
    if (error) {
      console.error('Failed to update status:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } else {
      setBet({ ...bet, status: newStatus });
      setShowStatusUpdate(false);
    }
    setUpdatingStatus(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!bet) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 16, color: '#6B6B6B' }}>Bet not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 16, color: '#6366F1', fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = getStatusStyling(bet.status);
  const betType = bet.bet_type ? (bet.bet_type === 'over_under' ? 'Over/Under' : bet.bet_type.charAt(0).toUpperCase() + bet.bet_type.slice(1)) : '';
  const roiPct = bet.wager > 0 ? (((bet.potential_payout || 0) - bet.wager) / bet.wager * 100).toFixed(0) : '0';
  const dateStr = bet.placed_at ? new Date(bet.placed_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <AnimatedPressable
              style={styles.backButton}
              onPress={() => router.back()}
              scaleDown={0.9}
            >
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </AnimatedPressable>
            <Text style={styles.headerTitle}>Bet Details</Text>
          </View>
        </FadeInView>

        {/* Status Banner Card */}
        <FadeInView delay={80} direction="bottom">
          <View style={[styles.statusBanner, { backgroundColor: statusStyle.bgColor }]}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.statusLabel}>STATUS</Text>
                <Text style={[styles.statusValue, { color: statusStyle.textColor }]}>
                  {statusStyle.label}
                </Text>
                <Text style={styles.statusDate}>{dateStr}</Text>
              </View>
              <RAnimated.View style={bet.status === 'pending' ? pendingPulseStyle : undefined}>
                <View style={[styles.statusIconCircle, { backgroundColor: statusStyle.iconBg }]}>
                  <Ionicons name={statusStyle.iconName} size={24} color={statusStyle.textColor} />
                </View>
              </RAnimated.View>
            </View>
          </View>
        </FadeInView>

        {/* Update Status Button */}
        <FadeInView delay={140} direction="none">
          <AnimatedPressable
            style={styles.updateStatusButton}
            onPress={() => setShowStatusUpdate(!showStatusUpdate)}
            scaleDown={0.95}
          >
            <Ionicons name="swap-horizontal" size={16} color="#6366F1" />
            <Text style={styles.updateStatusText}>Update Status</Text>
          </AnimatedPressable>
        </FadeInView>

        {/* Status Update Pills */}
        {showStatusUpdate && (
          <FadeInView delay={0} direction="bottom">
            <View style={styles.updateStatusContainer}>
              <View style={styles.updatePillsRow}>
                {(['pending', 'won', 'lost', 'void'] as BetStatus[]).map((s) => (
                  <StatusPill
                    key={s}
                    value={s}
                    selected={bet.status === s}
                    onPress={() => handleUpdateStatus(s)}
                  />
                ))}
              </View>
              {updatingStatus && (
                <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 8 }} />
              )}
            </View>
          </FadeInView>
        )}

        {/* Sportsbook & Wager Info Card */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.infoCard}>
            <View style={styles.sportsbookHeader}>
              <View style={styles.sportsbookIcon}>
                <Ionicons name="logo-usd" size={22} color="#10B981" />
              </View>
              <View style={styles.sportsbookInfo}>
                <Text style={styles.sportsbookName}>{bet.sportsbook || 'Unknown'}</Text>
                <Text style={styles.sportsbookType}>{betType}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <Text style={styles.statLabel}>WAGER</Text>
                <Text style={styles.statValue}>${bet.wager}</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={styles.statLabel}>PAYOUT</Text>
                <Text style={styles.statValue}>${(bet.potential_payout || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.statColumn, styles.statColumnRight]}>
                <Text style={styles.statLabel}>ROI</Text>
                <Text style={styles.roiValue}>+{roiPct}%</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Description Card (if exists) */}
        {bet.description ? (
          <FadeInView delay={220} direction="bottom">
            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <Ionicons name="baseball-outline" size={20} color="#6366F1" />
                <Text style={styles.notesTitle}>Pick</Text>
              </View>
              <Text style={styles.notesText}>{bet.description}</Text>
              {bet.matchup ? <Text style={[styles.notesText, { marginTop: 4, color: '#9CA3AF' }]}>{bet.matchup}</Text> : null}
            </View>
          </FadeInView>
        ) : null}

        {/* Parlay Legs */}
        {bet.bet_type === 'parlay' && Array.isArray(bet.parlay_legs) && bet.parlay_legs.length > 0 && (
          <FadeInView delay={280} direction="bottom">
            <View style={styles.parlayLegsCard}>
              <View style={styles.parlayLegsHeader}>
                <Text style={styles.parlayLegsTitle}>Parlay Legs</Text>
                <Text style={styles.parlayLegsCount}> ({bet.parlay_legs.length})</Text>
              </View>
              {bet.parlay_legs.map((leg: any, index: number) => {
                const legStyle = getLegStatusStyle(leg.status);
                return (
                  <FadeInView key={index} delay={index * 80} direction="bottom">
                    <AnimatedPressable style={styles.legCard} scaleDown={0.97}>
                      <View style={styles.legCardInner}>
                        <View style={styles.legInfo}>
                          <Text style={styles.legDescription}>{leg.description}</Text>
                          <Text style={styles.legOdds}>{leg.odds}</Text>
                        </View>
                        <View style={[styles.legStatusPill, { backgroundColor: legStyle.pillBg }]}>
                          <Text style={[styles.legStatusText, { color: legStyle.pillText }]}>
                            {leg.status === 'won' ? 'win' : leg.status === 'lost' ? 'loss' : 'pending'}
                          </Text>
                        </View>
                      </View>
                    </AnimatedPressable>
                  </FadeInView>
                );
              })}
            </View>
          </FadeInView>
        )}

        {/* Notes Card */}
        {bet.notes ? (
          <FadeInView delay={360} direction="bottom">
            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <Ionicons name="document-text-outline" size={20} color="#6366F1" />
                <Text style={styles.notesTitle}>Notes</Text>
              </View>
              <Text style={styles.notesText}>{bet.notes}</Text>
            </View>
          </FadeInView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusDate: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  updateStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  updateStatusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
    alignItems: 'center',
  },
  updatePillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  updatePill: {
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 38,
    justifyContent: 'center',
  },
  updatePillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  sportsbookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sportsbookIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportsbookInfo: {
    flex: 1,
  },
  sportsbookName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  sportsbookType: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statColumn: {
    flex: 1,
  },
  statColumnRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  roiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B6B6B',
  },
  parlayLegsCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  parlayLegsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  parlayLegsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  parlayLegsCount: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  legCard: {
    backgroundColor: '#1C2333',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3347',
    marginBottom: 12,
  },
  legCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  legInfo: {
    flex: 1,
    marginRight: 12,
  },
  legDescription: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  legOdds: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  legStatusPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  legStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
