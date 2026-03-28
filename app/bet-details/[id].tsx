import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { detectPatterns } from '@/lib/patternDetection';
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
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreferences } from '@/context/PreferencesContext';
import { formatCurrency, formatROI, formatOdds } from '@/lib/formatters';
import { shouldSendNotification } from '@/lib/notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BetStatus = 'pending' | 'won' | 'lost' | 'void';
type ToastState = { message: string; type: 'error' } | null;

interface ParlayLeg {
  id: string;
  bet_id: string;
  description: string;
  odds: number | null;
  status: string;
  order: number;
  created_at: string;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'won':
      return {
        label: 'WIN',
        heroColor: '#2DC672',
        iconName: 'checkmark-circle' as const,
        gradientColors: ['#2DC672', '#22A55E'] as [string, string],
      };
    case 'lost':
      return {
        label: 'LOSS',
        heroColor: '#E85D5D',
        iconName: 'close-circle' as const,
        gradientColors: ['#E85D5D', '#D04545'] as [string, string],
      };
    case 'void':
      return {
        label: 'VOID',
        heroColor: '#6B7280',
        iconName: 'ban' as const,
        gradientColors: ['#6B7280', '#565D69'] as [string, string],
      };
    case 'pending':
    default:
      return {
        label: 'PENDING',
        heroColor: '#F59E0B',
        iconName: 'time' as const,
        gradientColors: ['#F59E0B', '#D97706'] as [string, string],
      };
  }
};

const getLegStatusStyle = (status: string) => {
  switch (status) {
    case 'won':
      return { pillBg: 'rgba(45, 198, 114, 0.12)', pillText: '#2DC672', borderColor: '#2DC672' };
    case 'lost':
      return { pillBg: 'rgba(232, 93, 93, 0.12)', pillText: '#E85D5D', borderColor: '#E85D5D' };
    default:
      return { pillBg: 'rgba(245, 158, 11, 0.12)', pillText: '#F59E0B', borderColor: '#F59E0B' };
  }
};

const getReasoningIcon = (tag: string): React.ComponentProps<typeof Ionicons>['name'] => {
  const lower = tag.toLowerCase();
  if (lower.includes('revenge')) return 'flame';
  if (lower.includes('value')) return 'cash-outline';
  if (lower.includes('lock')) return 'lock-closed';
  if (lower.includes('gut')) return 'flash';
  if (lower.includes('research') || lower.includes('data')) return 'analytics';
  if (lower.includes('trend')) return 'trending-up';
  if (lower.includes('fade')) return 'trending-down';
  return 'bulb-outline';
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
  const { user, session } = useAuth();
  const { id } = useLocalSearchParams();
  const [bet, setBet] = useState<any>(null);
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);
  const [betTags, setBetTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const confettiRef = useRef<any>(null);
  const hasShownConfetti = useRef(false);
  const { width } = Dimensions.get('window');

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currency, showBalance, oddsFormat } = usePreferences();

  const betId = typeof id === 'string' ? id : '';

  // Pulse animation for pending status
  const pendingPulseOpacity = useSharedValue(1);
  const pendingPulseStyle = useAnimatedStyle(() => ({
    opacity: pendingPulseOpacity.value,
  }));

  // Fire confetti on first-ever view of a won bet (persisted via AsyncStorage)
  useEffect(() => {
    if (bet?.status === 'won' && !loading && !hasShownConfetti.current) {
      const key = `confetti_shown_${bet.id}`;
      AsyncStorage.getItem(key).then((shown) => {
        if (shown || hasShownConfetti.current) return;
        hasShownConfetti.current = true;
        AsyncStorage.setItem(key, 'true');
        const timer = setTimeout(() => {
          confettiRef.current?.start();
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        }, 400);
        return () => clearTimeout(timer);
      });
    }
  }, [bet?.status, loading]);

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
    const [betResult, legsResult, tagsResult] = await Promise.all([
      supabase.from('bets').select('*').eq('id', betId).single(),
      supabase.from('parlay_legs').select('*').eq('bet_id', betId).order('order', { ascending: true }),
      supabase.from('bet_tags').select('tag').eq('bet_id', betId),
    ]);
    if (betResult.data) setBet(betResult.data);
    if (legsResult.data) setParlayLegs(legsResult.data);
    if (tagsResult.data) setBetTags(tagsResult.data.map((t: { tag: string }) => t.tag));
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

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.back();
            } catch (err: unknown) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showToast(err instanceof Error ? err.message : 'Failed to delete bet');
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
      setUpdatingStatus(false);
    } else {
      setBet({ ...bet, status: newStatus });
      setShowStatusUpdate(false);

      if (newStatus === 'won') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        confettiRef.current?.start();
        AsyncStorage.setItem(`confetti_shown_${bet.id}`, 'true');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Send push notification for won/lost results (respects quiet hours)
      if ((newStatus === 'won' || newStatus === 'lost') && user?.id && session?.access_token) {
        (async () => {
          const canSend = await shouldSendNotification(user.id);
          if (canSend) {
            const notifTitle = newStatus === 'won' ? 'Bet Won! 🎉' : 'Bet Settled';
            const notifBody = newStatus === 'won'
              ? `Your ${bet.sportsbook} ${bet.bet_type} bet won! ${formatCurrency(bet.potential_payout, currency)} added to your record`
              : `Your ${bet.sportsbook} ${bet.bet_type} bet has been marked as lost`;
            supabase.functions.invoke('send-notification', {
              body: { user_id: user.id, title: notifTitle, body: notifBody, data: { type: 'betResults', betId: bet.id } },
            }).catch((err) => console.error('[Push] Failed to send bet result notification:', err));
          }
        })();

        // Fire-and-forget pattern detection
        detectPatterns(user.id, bet.id).catch((err) =>
          console.warn('[PatternDetection] Error:', err),
        );
      }

      setUpdatingStatus(false);
    }
  };

  const handleEditBet = useCallback(() => {
    if (!bet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const betData: Record<string, string> = {
      platform: bet.sportsbook || '',
      bet_type: bet.bet_type || '',
      sport: bet.sport || '',
      matchup: bet.matchup || '',
      description: bet.description || '',
      odds: bet.odds || '',
      odds_format: bet.odds_format || '',
      wager: String(bet.wager || ''),
      potential_payout: String(bet.potential_payout || ''),
      status: bet.status || '',
      date: bet.placed_at || '',
      notes: bet.notes || '',
      tags: JSON.stringify(betTags),
      ticket_image_url: bet.ticket_image_url || '',
      id: bet.id,
      isEditing: 'true',
      confidence_level: bet.confidence_level ? String(bet.confidence_level) : '',
      reasoning_tag: bet.reasoning_tag || '',
    };
    if (parlayLegs.length > 0) {
      betData.parlay_legs = JSON.stringify(parlayLegs);
    }
    router.push({ pathname: '/manual-add-bet', params: betData });
  }, [bet, betTags, parlayLegs, router]);

  const showMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Edit Bet', 'Delete Bet', 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleEditBet();
          else if (buttonIndex === 1) handleDeleteBet();
        }
      );
    } else {
      Alert.alert('', undefined, [
        { text: 'Edit Bet', onPress: handleEditBet },
        { text: 'Delete Bet', style: 'destructive', onPress: handleDeleteBet },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [handleEditBet, handleDeleteBet]);

  // Skeleton shimmer animation
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(skeletonAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ).start();
    }
  }, [loading]);
  const skeletonOpacity = skeletonAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Animated.View style={{ height: insets.top + 180, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: colors.surface, opacity: skeletonOpacity }} />
        <Animated.View style={{ height: 48, borderRadius: 12, marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, opacity: skeletonOpacity }} />
        <Animated.View style={{ height: 280, borderRadius: 20, marginHorizontal: 16, marginTop: 20, backgroundColor: colors.surface, opacity: skeletonOpacity }} />
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 24 }}>
          <Animated.View style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surface, opacity: skeletonOpacity }} />
          <Animated.View style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surface, opacity: skeletonOpacity }} />
        </View>
      </View>
    );
  }

  if (!bet) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 16, color: colors.textSecondary }}>Bet not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 16, color: colors.ai, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusConfig = getStatusConfig(bet.status);
  const betType = bet.bet_type ? (bet.bet_type === 'over_under' ? 'Over/Under' : bet.bet_type.charAt(0).toUpperCase() + bet.bet_type.slice(1)) : '';

  const roiPctNum = !bet.wager || bet.wager <= 0 ? 0
    : bet.status === 'lost' ? -100
    : bet.status === 'void' ? 0
    : ((bet.potential_payout || 0) - bet.wager) / bet.wager * 100;
  const dateStr = bet.placed_at ? new Date(bet.placed_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : '';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-Bleed Status Hero with floating nav */}
        <FadeInView delay={0} direction="none">
          <LinearGradient
            colors={statusConfig.gradientColors}
            style={[styles.statusHero, { paddingTop: insets.top }]}
          >
            {/* Floating Nav Row */}
            <View style={styles.heroNavRow}>
              <AnimatedPressable
                style={styles.heroNavButton}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
                scaleDown={0.9}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </AnimatedPressable>
              <View style={{ flex: 1 }} />
              <AnimatedPressable
                style={styles.heroNavButton}
                onPress={showMenu}
                scaleDown={0.9}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
              </AnimatedPressable>
            </View>

            {/* Status Content */}
            <View style={styles.statusHeroContent}>
              <View>
                <RAnimated.View style={bet.status === 'pending' ? pendingPulseStyle : undefined}>
                  <Text style={styles.statusHeroLabel}>
                    {statusConfig.label}
                  </Text>
                </RAnimated.View>
                <Text style={styles.statusHeroDate}>{dateStr}</Text>
              </View>
              <RAnimated.View style={bet.status === 'pending' ? pendingPulseStyle : undefined}>
                <Ionicons
                  name={statusConfig.iconName}
                  size={52}
                  color="rgba(255, 255, 255, 0.25)"
                />
              </RAnimated.View>
            </View>
          </LinearGradient>
        </FadeInView>

        {/* Update Status Button */}
        <FadeInView delay={80} direction="none">
          <AnimatedPressable
            style={styles.updateStatusButton}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStatusUpdate(!showStatusUpdate); }}
            scaleDown={0.95}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.text} />
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
                <ActivityIndicator size="small" color={colors.ai} style={{ marginTop: 8 }} />
              )}
            </View>
          </FadeInView>
        )}

        {/* THE TICKET CARD */}
        <FadeInView delay={100} direction="bottom" offset={30}>
          <View style={styles.ticketCard}>
            {/* Ticket Header */}
            <View style={styles.ticketHeader}>
              <View style={styles.ticketHeaderLeft}>
                <View style={[styles.sportsbookIconCircle, { backgroundColor: colors.accentBg }]}>
                  <Ionicons name="logo-usd" size={22} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.sportsbookName}>{bet.sportsbook || 'Unknown'}</Text>
                  <Text style={styles.sportsbookType}>{betType}</Text>
                </View>
              </View>
              <Text style={styles.betIdText}>#{bet.id.substring(0, 4)}</Text>
            </View>

            {/* Ticket Tear Divider */}
            <View style={styles.ticketDividerContainer}>
              <View style={[styles.ticketDashedLine, { borderColor: colors.border }]} />
              <View style={[styles.ticketCutout, styles.ticketCutoutLeft, { backgroundColor: colors.background }]} />
              <View style={[styles.ticketCutout, styles.ticketCutoutRight, { backgroundColor: colors.background }]} />
            </View>

            {/* Ticket Body */}
            <View style={styles.ticketBody}>
              {/* Row 1: Big Numbers */}
              <View style={styles.bigNumbersRow}>
                <View style={styles.bigNumberCol}>
                  <Text style={styles.bigNumberLabel}>WAGER</Text>
                  <Text style={styles.bigNumberValue}>{formatCurrency(bet.wager, currency, showBalance)}</Text>
                </View>
                <View style={styles.bigNumberCol}>
                  <Text style={styles.bigNumberLabel}>PAYOUT</Text>
                  <Text style={styles.bigNumberValue}>{formatCurrency(bet.potential_payout || 0, currency, showBalance)}</Text>
                </View>
                <View style={[styles.bigNumberCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.bigNumberLabel}>ROI</Text>
                  <Text style={[styles.bigNumberValue, { color: roiPctNum < 0 ? colors.loss : colors.accent }]}>
                    {formatROI(roiPctNum)}
                  </Text>
                </View>
              </View>

              {/* Row 2: Details Grid */}
              {(bet.odds || bet.sport || (parlayLegs.length === 0 && bet.description)) && (
                <>
                  <View style={styles.thinDivider} />
                  <View style={styles.detailsGrid}>
                    {(bet.odds || bet.sport) && (
                      <View style={styles.detailsRow}>
                        {bet.odds && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>ODDS</Text>
                            <Text style={styles.detailValue}>{formatOdds(bet.odds, oddsFormat)}</Text>
                          </View>
                        )}
                        {bet.sport && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>SPORT</Text>
                            <Text style={styles.detailValue}>{bet.sport}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {parlayLegs.length === 0 && bet.description && (
                      <View style={styles.detailItemFull}>
                        <Text style={styles.detailLabel}>PICK</Text>
                        <Text style={styles.detailValue}>{bet.description}</Text>
                        {bet.matchup ? (
                          <Text style={[styles.detailValue, { color: colors.textTertiary, fontSize: 13, marginTop: 2 }]}>
                            {bet.matchup}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Row 3: Gut Check Data */}
              {(bet.confidence_level > 0 || bet.reasoning_tag) && (
                <>
                  <View style={styles.thinDivider} />
                  <View style={styles.gutCheckSection}>
                    {bet.confidence_level > 0 && (
                      <View>
                        <Text style={styles.detailLabel}>CONFIDENCE</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= bet.confidence_level ? 'star' : 'star-outline'}
                              size={18}
                              color={star <= bet.confidence_level ? colors.star : colors.textTertiary}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    {bet.reasoning_tag && (
                      <View>
                        <Text style={styles.detailLabel}>REASONING</Text>
                        <View style={[styles.reasoningPill, { backgroundColor: colors.accentBg }]}>
                          <Ionicons name={getReasoningIcon(bet.reasoning_tag)} size={14} color={colors.accent} />
                          <Text style={[styles.reasoningText, { color: colors.accent }]}>{bet.reasoning_tag}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </FadeInView>

        {/* Parlay Legs Section */}
        {parlayLegs.length > 0 && (
          <FadeInView delay={200} direction="bottom" offset={30}>
            <View style={styles.parlayCard}>
              {/* Card Header */}
              <View style={styles.parlayCardHeader}>
                <Text style={styles.parlayCardTitle}>Parlay Legs</Text>
                <Text style={styles.parlayCardCount}>({parlayLegs.length})</Text>
              </View>

              {/* Ticket Tear Divider */}
              <View style={styles.ticketDividerContainer}>
                <View style={[styles.ticketDashedLine, { borderColor: colors.border }]} />
                <View style={[styles.ticketCutout, styles.ticketCutoutLeft, { backgroundColor: colors.background }]} />
                <View style={[styles.ticketCutout, styles.ticketCutoutRight, { backgroundColor: colors.background }]} />
              </View>

              {/* Legs List */}
              {parlayLegs.map((leg, index) => {
                const legStyle = getLegStatusStyle(leg.status);
                return (
                  <View key={leg.id ?? index}>
                    <View style={styles.legRow}>
                      <View style={[styles.legStatusBar, { backgroundColor: legStyle.borderColor }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legDescription}>{leg.description}</Text>
                        {leg.odds ? (
                          <Text style={styles.legOdds}>{formatOdds(leg.odds, oddsFormat)}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.legStatusPill, { backgroundColor: legStyle.pillBg }]}>
                        <Text style={[styles.legStatusText, { color: legStyle.pillText }]}>
                          {leg.status === 'won' ? 'Win' : leg.status === 'lost' ? 'Loss' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    {index < parlayLegs.length - 1 && (
                      <View style={styles.legDivider} />
                    )}
                  </View>
                );
              })}
              <View style={{ height: 8 }} />
            </View>
          </FadeInView>
        )}

        {/* Notes Section */}
        {bet.notes ? (
          <FadeInView delay={350} direction="bottom">
            <View style={styles.notesCard}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.notesText}>{bet.notes}</Text>
            </View>
          </FadeInView>
        ) : null}

        {/* Action Buttons */}
        <FadeInView delay={400} direction="bottom">
          <View style={styles.actionButtonsRow}>
            <AnimatedPressable
              style={styles.editButton}
              onPress={handleEditBet}
              scaleDown={0.96}
            >
              <Text style={[styles.editButtonText, { color: colors.accent }]}>Edit Bet</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.deleteButton, deleting && { opacity: 0.5 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleDeleteBet(); }}
              scaleDown={0.96}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="rgba(232, 93, 93, 0.7)" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete</Text>
              )}
            </AnimatedPressable>
          </View>
        </FadeInView>
      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Ionicons name="alert-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* Confetti on Won */}
      <ConfettiCannon
        ref={confettiRef}
        count={90}
        origin={{ x: width / 2, y: -10 }}
        fadeOut
        autoStart={false}
        explosionSpeed={300}
        fallSpeed={2500}
        colors={['#2DC672', '#FFD700', '#FFFFFF', '#2DC672', '#FCD34D']}
      />
    </View>
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
      paddingBottom: 100,
    },
    /* Full-Bleed Status Hero */
    statusHero: {
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: 'hidden',
    },
    heroNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    heroNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusHeroContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 28,
    },
    statusHeroLabel: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: 2,
      color: '#FFFFFF',
    },
    statusHeroDate: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.7)',
      marginTop: 8,
    },
    /* Update Status */
    updateStatusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 48,
      marginHorizontal: 16,
      marginTop: 20,
      marginBottom: 20,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    updateStatusText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    updateStatusContainer: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      alignItems: 'center',
    },
    updatePillsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    /* Ticket Card */
    ticketCard: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    ticketHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
    },
    ticketHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    sportsbookIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sportsbookName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sportsbookType: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    betIdText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    },
    /* Ticket Tear Divider */
    ticketDividerContainer: {
      position: 'relative',
    },
    ticketDashedLine: {
      borderBottomWidth: 1.5,
      borderStyle: 'dashed',
      marginHorizontal: 24,
    },
    ticketCutout: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderRadius: 10,
      top: -10,
    },
    ticketCutoutLeft: {
      left: -10,
    },
    ticketCutoutRight: {
      right: -10,
    },
    /* Ticket Body */
    ticketBody: {
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    bigNumbersRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    bigNumberCol: {
      flex: 1,
    },
    bigNumberLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      color: colors.textTertiary,
    },
    bigNumberValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 8,
    },
    thinDivider: {
      height: 1,
      backgroundColor: colors.border + '66',
      marginVertical: 20,
    },
    detailsGrid: {
      gap: 16,
    },
    detailsRow: {
      flexDirection: 'row',
      gap: 24,
    },
    detailItem: {
      flex: 1,
    },
    detailItemFull: {
      width: '100%',
    },
    detailLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      color: colors.textTertiary,
      textTransform: 'uppercase',
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginTop: 6,
    },
    gutCheckSection: {
      gap: 16,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 8,
    },
    reasoningPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    reasoningText: {
      fontSize: 13,
      fontWeight: '600',
    },
    /* Parlay Legs */
    parlayCard: {
      marginHorizontal: 16,
      marginTop: 20,
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    parlayCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    parlayCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    parlayCardCount: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    legRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    legStatusBar: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 2,
      marginRight: 14,
    },
    legDescription: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 20,
    },
    legOdds: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    legStatusPill: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 8,
      marginLeft: 12,
    },
    legStatusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    legDivider: {
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.3,
      marginHorizontal: 24,
    },
    /* Notes */
    notesCard: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
    },
    notesText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginTop: 8,
    },
    /* Action Buttons */
    actionButtonsRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 24,
      gap: 10,
    },
    editButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    deleteButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(232, 93, 93, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    deleteButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: 'rgba(232, 93, 93, 0.7)',
    },
    /* Toast */
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
