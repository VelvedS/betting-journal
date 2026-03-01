import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useTheme } from '@/context/ThemeContext';

type BetStatus = 'pending' | 'won' | 'lost' | 'void';
type ToastState = { message: string; type: 'error' } | null;

const getLegStatusStyle = (status: string) => {
  switch (status) {
    case 'won':
      return { pillBg: '#E8F5E9', pillText: '#00C853' };
    case 'lost':
      return { pillBg: '#FFEBEE', pillText: '#FF3B30' };
    default:
      return { pillBg: '#F5F5F5', pillText: '#999999' };
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
        style={[{ borderRadius: 9, paddingHorizontal: 16, paddingVertical: 10, height: 38, justifyContent: 'center' }, { backgroundColor: s.bg, borderColor: s.border, borderWidth: s.bw }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <Text style={[{ fontSize: 14, fontWeight: '600' }, { color: s.text }]}>
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
  const [parlayLegs, setParlayLegs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
    const [betResult, legsResult] = await Promise.all([
      supabase.from('bets').select('*').eq('id', betId).single(),
      supabase.from('parlay_legs').select('*').eq('bet_id', betId).order('order', { ascending: true }),
    ]);
    if (betResult.data) setBet(betResult.data);
    if (legsResult.data) setParlayLegs(legsResult.data);
    setLoading(false);
  }, [betId]);

  useFocusEffect(
    useCallback(() => {
      fetchBet();
    }, [fetchBet])
  );

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type: 'error' });
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
        () => setToast(null)
      );
    }, 3000);
  }, [toastOpacity]);

  const handleDeleteBet = useCallback(() => {
    Alert.alert(
      'Delete Bet',
      'Are you sure you want to delete this bet? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!bet) return;
            setDeleting(true);
            try {
              const { error } = await supabase.from('bets').delete().eq('id', bet.id);
              if (error) throw error;
              router.back();
            } catch (err: any) {
              showToast(err.message || 'Failed to delete bet');
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [bet, router, showToast]);

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
        <StatusBar style={colors.statusBar} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!bet) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 16, color: colors.textSecondary }}>Bet not found</Text>
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
      <StatusBar style={colors.statusBar} />
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
              <Ionicons name="arrow-back" size={24} color={colors.text} />
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
            <Ionicons name="swap-horizontal" size={16} color={colors.text} />
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

        {/* Pick — only shown when there are no parlay legs */}
        {parlayLegs.length === 0 && (
          <FadeInView delay={220} direction="bottom">
            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <Ionicons name="baseball-outline" size={20} color="#6366F1" />
                <Text style={styles.notesTitle}>Pick</Text>
              </View>
              <Text style={styles.notesText}>{bet.description || '—'}</Text>
              {bet.matchup ? <Text style={[styles.notesText, { marginTop: 4, color: colors.textTertiary }]}>{bet.matchup}</Text> : null}
            </View>
          </FadeInView>
        )}

        {/* Parlay Legs — shown whenever valid legs exist */}
        {parlayLegs.length > 0 && (
          <FadeInView delay={280} direction="bottom">
            <View style={styles.parlayLegsCard}>
              <View style={styles.parlayLegsHeader}>
                <Text style={styles.parlayLegsTitle}>Parlay Legs</Text>
                <Text style={styles.parlayLegsCount}> ({parlayLegs.length})</Text>
              </View>
              {parlayLegs.map((leg: any, index: number) => {
                const legStyle = getLegStatusStyle(leg.status);
                return (
                  <FadeInView key={leg.id ?? index} delay={index * 80} direction="bottom">
                    <View style={styles.legCard}>
                      <View style={styles.legCardInner}>
                        <View style={styles.legInfo}>
                          <Text style={styles.legDescription}>{leg.description}</Text>
                          <Text style={styles.legOdds}>{leg.odds}</Text>
                        </View>
                        <View style={[styles.legStatusPill, { backgroundColor: legStyle.pillBg }]}>
                          <Text style={[styles.legStatusText, { color: legStyle.pillText }]}>
                            {leg.status === 'won' ? 'Win' : leg.status === 'lost' ? 'Loss' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>
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

        {/* Delete Bet */}
        <FadeInView delay={440} direction="bottom">
          <AnimatedPressable
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteBet}
            scaleDown={0.97}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator size="small" color="#E85D5D" style={{ marginRight: 8 }} />
              : <Ionicons name="trash-outline" size={18} color="#E85D5D" style={{ marginRight: 8 }} />
            }
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting…' : 'Delete Bet'}
            </Text>
          </AnimatedPressable>
        </FadeInView>
      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Ionicons name="alert-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 100,
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
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
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
      color: colors.textSecondary,
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
      color: colors.textSecondary,
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
      paddingVertical: 12,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    updateStatusText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    updateStatusContainer: {
      backgroundColor: colors.surface,
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
      backgroundColor: colors.surface,
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
      color: colors.text,
      marginBottom: 2,
    },
    sportsbookType: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
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
      color: colors.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    roiValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#10B981',
    },
    notesCard: {
      backgroundColor: colors.surface,
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
      color: colors.text,
    },
    notesText: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    parlayLegsCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
      boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.05)',
      elevation: 2,
    },
    parlayLegsHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 16,
    },
    parlayLegsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    parlayLegsCount: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textTertiary,
    },
    legCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
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
      color: colors.text,
      marginBottom: 4,
    },
    legOdds: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textTertiary,
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
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E85D5D',
      paddingVertical: 14,
      marginTop: 4,
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#E85D5D',
    },
    toast: {
      position: 'absolute',
      bottom: 40,
      left: 20,
      right: 20,
      backgroundColor: '#E85D5D',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    toastText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      flex: 1,
    },
  });
}
