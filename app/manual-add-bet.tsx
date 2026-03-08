import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import RAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';
import { useTheme } from '@/context/ThemeContext';
import { usePreferences } from '@/context/PreferencesContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

type BetType = 'moneyline' | 'spread' | 'ou' | 'parlay' | 'prop' | 'other';
type OddsFormat = 'american' | 'decimal' | 'fractional';
type BetStatus = 'pending' | 'won' | 'lost' | 'void';

// ── Platform data ──

const PLATFORMS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PrizePicks', 'Underdog', 'Kalshi', 'Other'];

// ── Sport data ──

const POPULAR_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'Soccer', 'Tennis', 'Golf', 'MMA', 'Other'];

interface SportCategory { category: string; sports: string[]; }
const MORE_SPORTS_DATA: SportCategory[] = [
  { category: 'Soccer Leagues', sports: ['EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League', 'Liga MX', 'MLS', 'World Cup'] },
  { category: 'College Sports', sports: ['NCAAW', 'College Baseball', 'College Hockey'] },
  { category: 'Combat Sports', sports: ['UFC / MMA', 'Bellator', 'PFL', 'Boxing'] },
  { category: 'Motorsports', sports: ['Formula 1', 'IndyCar', 'NASCAR', 'MotoGP'] },
  { category: 'Golf Events', sports: ['PGA Tour', 'LIV Golf', 'LPGA', 'The Masters', 'US Open (Golf)'] },
  { category: 'Tennis Events', sports: ['Australian Open', 'French Open', 'Wimbledon', 'US Open (Tennis)'] },
  { category: 'Basketball', sports: ['WNBA', 'EuroLeague', 'FIBA World Cup'] },
  { category: 'Baseball', sports: ['NPB (Japan)', 'KBO (Korea)'] },
  { category: 'Cricket', sports: ['IPL', 'T20 World Cup', 'The Ashes'] },
  { category: 'Rugby', sports: ['Rugby Union', 'Rugby World Cup', 'NRL'] },
  { category: 'Entertainment / Specials', sports: ['Politics / Elections', 'Award Shows', 'Reality TV', 'Novelty Props'] },
  { category: 'Other', sports: ['Other'] },
];
const ALL_SPORTS = [...POPULAR_SPORTS, ...MORE_SPORTS_DATA.flatMap((c) => c.sports)];

// ── Payout calculation ──

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Shared Bottom Sheet Hook ──

function useBottomSheet() {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) slideAnim.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) { closeSheet(); }
        else { Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start(); }
      },
    })
  ).current;
  const [visible, setVisible] = useState(false);
  const openSheet = () => { setVisible(true); Animated.parallel([Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true })]).start(); };
  const closeSheet = () => { Animated.parallel([Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }), Animated.timing(overlayAnim, { toValue: 0, duration: 250, useNativeDriver: true })]).start(() => setVisible(false)); };
  return { visible, slideAnim, overlayAnim, panResponder, openSheet, closeSheet };
}

// ── Status Pill Component ──

function StatusPill({ value, selected, onPress }: { value: BetStatus; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();

  const getStyles = () => {
    if (!selected) return { bg: colors.input, text: colors.textSecondary, border: colors.border, bw: 1 };
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
        style={[{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, height: 40, justifyContent: 'center' }, { backgroundColor: s.bg, borderColor: s.border, borderWidth: s.bw }]}
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

// ── Main Component ──

export default function ManualAddBetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sportsbook?: string; bet_type?: string; sport?: string; matchup?: string;
    description?: string; odds?: string; odds_format?: string; wager?: string;
    potential_payout?: string; status?: string; placed_at?: string; notes?: string;
    ticket_image_url?: string; parlay_legs?: string; tags?: string; confidence?: string;
  }>();

  const hasRouteParams = Object.keys(params).length > 0;
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { currency } = usePreferences();
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  // Form state
  const [betType, setBetType] = useState<BetType>(() => {
    const m: Record<string, BetType> = { moneyline: 'moneyline', spread: 'spread', over_under: 'ou', ou: 'ou', parlay: 'parlay', prop: 'prop', other: 'other' };
    return (params.bet_type && m[params.bet_type]) || 'moneyline';
  });
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(() => {
    const m: Record<string, OddsFormat> = { american: 'american', decimal: 'decimal', fractional: 'fractional' };
    return (params.odds_format && m[params.odds_format]) || 'american';
  });
  const [status, setStatus] = useState<BetStatus>(() => {
    const m: Record<string, BetStatus> = { pending: 'pending', won: 'won', lost: 'lost', void: 'void' };
    return (params.status && m[params.status]) || 'pending';
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (!params.tags) return [];
    try { return JSON.parse(params.tags); } catch { return []; }
  });
  const [wager, setWager] = useState(params.wager || '');
  const [odds, setOdds] = useState('');
  const [matchup, setMatchup] = useState(params.matchup || '');
  const [description, setDescription] = useState(params.description || '');
  const [notes, setNotes] = useState(params.notes || '');

  // Parlay legs
  const [parlayLegs, setParlayLegs] = useState(() => {
    if (!params.parlay_legs) return [];
    try {
      const legs = JSON.parse(params.parlay_legs);
      return Array.isArray(legs) ? legs : [];
    } catch {
      return [];
    }
  });

  // Payout
  const [potentialPayout, setPotentialPayout] = useState('0.00');

  // Payout pulse animation
  const payoutOpacity = useSharedValue(1);
  const payoutStyle = useAnimatedStyle(() => ({ opacity: payoutOpacity.value }));

  useEffect(() => {
    if (potentialPayout !== '0.00') {
      payoutOpacity.value = withSequence(
        withTiming(0.5, { duration: 120 }),
        withTiming(1, { duration: 180 }),
      );
    }
  }, [potentialPayout]);

  useEffect(() => {
    const wagerNum = parseFloat(wager);
    const oddsStr = odds?.trim();
    if (!wagerNum || wagerNum <= 0 || !oddsStr) {
      setPotentialPayout('0.00');
      return;
    }
    let payout = 0;
    if (oddsFormat === 'american') {
      const oddsNum = parseFloat(oddsStr.replace('+', ''));
      if (isNaN(oddsNum) || oddsNum === 0) {
        setPotentialPayout('0.00');
        return;
      }
      if (oddsNum > 0) {
        payout = wagerNum + (wagerNum * (oddsNum / 100));
      } else {
        payout = wagerNum + (wagerNum * (100 / Math.abs(oddsNum)));
      }
    } else if (oddsFormat === 'decimal') {
      const oddsNum = parseFloat(oddsStr);
      if (isNaN(oddsNum) || oddsNum <= 0) {
        setPotentialPayout('0.00');
        return;
      }
      payout = wagerNum * oddsNum;
    } else if (oddsFormat === 'fractional') {
      const parts = oddsStr.split('/');
      if (parts.length !== 2) {
        setPotentialPayout('0.00');
        return;
      }
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
        setPotentialPayout('0.00');
        return;
      }
      payout = wagerNum + (wagerNum * (numerator / denominator));
    }
    setPotentialPayout(payout.toFixed(2));
  }, [wager, odds, oddsFormat]);

  // On mount: if AI provided wager + potential_payout, back-calculate American odds
  useEffect(() => {
    const wagerNum = parseFloat(params.wager || '');
    const payoutNum = parseFloat(params.potential_payout || '');
    if (wagerNum > 0 && payoutNum > wagerNum) {
      const profit = payoutNum - wagerNum;
      let americanOdds: string;
      if (profit >= wagerNum) {
        americanOdds = '+' + Math.round((profit / wagerNum) * 100);
      } else {
        americanOdds = '-' + Math.round((wagerNum / profit) * 100);
      }
      setOddsFormat('american');
      setOdds(americanOdds);
    } else if (params.odds) {
      setOdds(params.odds);
    }
  }, []);

  // Date state
  const [placedAt, setPlacedAt] = useState<Date | null>(() => {
    if (params.placed_at) { const d = new Date(params.placed_at); return isNaN(d.getTime()) ? null : d; }
    return null;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const minDate = new Date(); minDate.setFullYear(minDate.getFullYear() - 1);
  const maxDate = new Date();

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) { setTempDate(selectedDate); setShowTimePicker(true); }
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const handleTimeChange = (_: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (selectedTime) {
        const final = new Date(tempDate);
        final.setHours(selectedTime.getHours(), selectedTime.getMinutes());
        setPlacedAt(final);
      }
    } else {
      if (selectedTime) setTempDate(selectedTime);
    }
  };

  const handleOpenDatePicker = () => {
    setTempDate(placedAt || new Date());
    setShowDatePicker(true);
  };

  const handleConfirmWebDate = () => {
    setPlacedAt(tempDate);
    setShowDatePicker(false);
  };

  // Ticket image
  const [ticketImageUrl, setTicketImageUrl] = useState(params.ticket_image_url || '');
  const [confidence, setConfidence] = useState(() => params.confidence ? parseFloat(params.confidence) : null);
  const [showAiBanner, setShowAiBanner] = useState(hasRouteParams);

  // Platform state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(params.sportsbook || null);
  const [isPlatformOther, setIsPlatformOther] = useState(false);
  const [customPlatform, setCustomPlatform] = useState('');

  const handleSelectPlatform = (name: string) => {
    if (name === 'Other') { setSelectedPlatform(null); setIsPlatformOther(true); setCustomPlatform(''); }
    else { setSelectedPlatform(name); setIsPlatformOther(false); setCustomPlatform(''); }
  };
  const handleClearPlatform = () => { setIsPlatformOther(false); setCustomPlatform(''); setSelectedPlatform(null); };

  // Sport state
  const [selectedSport, setSelectedSport] = useState<string | null>(params.sport || null);
  const [isSportOther, setIsSportOther] = useState(false);
  const [customSport, setCustomSport] = useState('');
  const [sportSearch, setSportSearch] = useState('');
  const [moreSportsExpanded, setMoreSportsExpanded] = useState(false);
  const sportSheet = useBottomSheet();
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const openSportSheet = () => { setSportSearch(''); sportSheet.openSheet(); };
  const handleSelectSport = (name: string) => {
    if (name === 'Other') { setSelectedSport(null); setIsSportOther(true); setCustomSport(''); }
    else { setSelectedSport(name); setIsSportOther(false); setCustomSport(''); }
    sportSheet.closeSheet();
  };
  const handleClearSport = () => { setIsSportOther(false); setCustomSport(''); setSelectedSport(null); };

  const toggleMoreSports = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !moreSportsExpanded;
    setMoreSportsExpanded(next);
    Animated.timing(chevronAnim, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  };

  const filteredSports = sportSearch.trim() ? ALL_SPORTS.filter((s) => s.toLowerCase().includes(sportSearch.toLowerCase().trim())) : null;

  // Helpers
  const getOddsPlaceholder = () => {
    switch (oddsFormat) { case 'american': return '+150 or -110'; case 'decimal': return '2.50'; case 'fractional': return '3/2'; default: return '+150 or -110'; }
  };
  const toggleTag = (tag: string) => { setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]); };

  // Parlay legs helpers
  const addParlayLeg = () => {
    setParlayLegs([...parlayLegs, { description: '', odds: '', status: 'pending' }]);
  };

  const updateParlayLeg = (index: number, field: 'description' | 'odds' | 'status', value: string) => {
    const updated = [...parlayLegs];
    updated[index] = { ...updated[index], [field]: value };
    setParlayLegs(updated);
  };

  const removeParlayLeg = (index: number) => {
    setParlayLegs(parlayLegs.filter((_, i) => i !== index));
  };

  const handleSaveBet = async () => {
    const finalStatus = status || 'pending';
    const sportsbook = isPlatformOther ? customPlatform : selectedPlatform;
    const sportValue = isSportOther ? customSport : selectedSport;

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save a bet.');
      return;
    }

    setIsSaving(true);

    const betTypeMap: Record<BetType, string> = {
      moneyline: 'moneyline', spread: 'spread', ou: 'over_under',
      parlay: 'parlay', prop: 'prop', other: 'other',
    };

    const wagerNum = parseFloat(wager) || 0;
    const payoutNum = parseFloat(potentialPayout) || 0;
    const roiPercentage = wagerNum > 0 ? ((payoutNum - wagerNum) / wagerNum) * 100 : 0;

    const payload = {
      user_id: user.id,
      sportsbook: sportsbook || null,
      bet_type: betTypeMap[betType],
      sport: sportValue || null,
      matchup: matchup || null,
      description: description || null,
      odds: odds || null,
      odds_format: oddsFormat,
      wager: wagerNum,
      potential_payout: payoutNum,
      roi_percentage: roiPercentage,
      status: finalStatus,
      notes: notes || null,
      ticket_image_url: ticketImageUrl || null,
      placed_at: placedAt ? placedAt.toISOString() : new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from('bets').insert(payload).select().single();
      if (error) throw error;

      if (selectedTags.length > 0 && data?.id) {
        await supabase.from('bet_tags').insert(selectedTags.map(tag => ({ bet_id: data.id, tag })));
      }

      if (betType === 'parlay' && parlayLegs.length > 0 && data?.id) {
        try {
          await supabase.from('parlay_legs').insert(
            parlayLegs.map((leg: any, idx: number) => ({
              bet_id: data.id,
              description: leg.description || '',
              odds: leg.odds || '',
              status: leg.status || 'pending',
              order: idx + 1,
            }))
          );
        } catch (err) {
          console.error('Failed to save parlay legs:', err);
        }
      }

      setIsSaving(false);
      router.back();
    } catch (err: any) {
      console.error('Failed to save bet:', err);
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save bet. Please try again.');
    }
  };

  // Sport sheet content
  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const renderSportSheetContent = () => {
    if (filteredSports) {
      return (
        <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filteredSports.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No sports found</Text></View> :
            filteredSports.map((sport, i) => {
              const sel = (!isSportOther && selectedSport === sport) || (isSportOther && sport === 'Other');
              return <TouchableOpacity key={`${sport}-${i}`} style={styles.listRow} onPress={() => handleSelectSport(sport)} activeOpacity={0.6}><Text style={styles.listRowText}>{sport}</Text>{sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}</TouchableOpacity>;
            })}
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.categoryHeader}><Text style={styles.categoryText}>Popular</Text></View>
        <View style={styles.chipsGrid}>
          {POPULAR_SPORTS.map((sport) => {
            const sel = !isSportOther && selectedSport === sport;
            return <TouchableOpacity key={sport} style={[styles.chip, sel && styles.chipSelected]} onPress={() => handleSelectSport(sport)} activeOpacity={0.7}><Text style={[styles.chipText, sel && styles.chipTextSelected]}>{sport}</Text>{sel && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />}</TouchableOpacity>;
          })}
        </View>
        <TouchableOpacity style={styles.moreSportsHeader} onPress={toggleMoreSports} activeOpacity={0.7}>
          <Text style={styles.moreSportsTitle}>More Sports</Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}><Ionicons name="chevron-down" size={16} color={colors.textTertiary} /></Animated.View>
        </TouchableOpacity>
        {moreSportsExpanded && (
          <View style={styles.moreSportsContent}>
            {MORE_SPORTS_DATA.map((cat) => (
              <View key={cat.category}>
                <View style={styles.categoryHeader}><Text style={styles.categoryText}>{cat.category}</Text></View>
                {cat.sports.map((sport, i) => {
                  const sel = (!isSportOther && selectedSport === sport) || (isSportOther && sport === 'Other');
                  return <TouchableOpacity key={`${sport}-${i}`} style={styles.listRow} onPress={() => handleSelectSport(sport)} activeOpacity={0.6}><Text style={styles.listRowText}>{sport}</Text>{sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}</TouchableOpacity>;
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <AnimatedPressable style={styles.backBtn} onPress={() => router.back()} scaleDown={0.9}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Add Bet</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── AI Banner ── */}
        {hasRouteParams && showAiBanner && (
          <View style={styles.banner}>
            <Ionicons name="sparkles" size={18} color="#6C63FF" />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerText}>AI-extracted — please review before saving</Text>
              {confidence !== null && <Text style={styles.confidenceText}>Confidence: {Math.round((confidence as number) * 100)}%</Text>}
            </View>
            <TouchableOpacity onPress={() => setShowAiBanner(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#6C63FF" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Card 1: Bet Info ── */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>BET INFO</Text>

            {/* Platform */}
            <Text style={styles.fieldLabel}>Platform</Text>
            <View style={styles.pillsWrap}>
              {PLATFORMS.map((p) => {
                const active = isPlatformOther ? p === 'Other' : selectedPlatform === p;
                return (
                  <TouchableOpacity key={p} style={[styles.pill, active && styles.pillActive]} onPress={() => handleSelectPlatform(p)} activeOpacity={0.7}>
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isPlatformOther && (
              <View style={[styles.input, styles.inputRow, { marginTop: 10 }]}>
                <TextInput
                  style={styles.inlineInput}
                  placeholder="Platform name..."
                  placeholderTextColor={colors.placeholder}
                  value={customPlatform}
                  onChangeText={setCustomPlatform}
                />
                <TouchableOpacity onPress={handleClearPlatform} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider} />

            {/* Bet Type */}
            <Text style={styles.fieldLabel}>Bet Type</Text>
            <View style={styles.pillsWrap}>
              {(['moneyline', 'spread', 'ou', 'parlay', 'prop', 'other'] as BetType[]).map((t) => (
                <TouchableOpacity key={t} style={[styles.pill, betType === t && styles.pillActive]} onPress={() => setBetType(t)} activeOpacity={0.7}>
                  <Text style={[styles.pillText, betType === t && styles.pillTextActive]}>
                    {t === 'ou' ? 'O/U' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Sport */}
            <Text style={styles.fieldLabel}>Sport</Text>
            <View style={styles.pillsWrap}>
              {POPULAR_SPORTS.map((s) => {
                const active = isSportOther ? s === 'Other' : selectedSport === s;
                return (
                  <TouchableOpacity key={s} style={[styles.pill, active && styles.pillActive]} onPress={() => handleSelectSport(s)} activeOpacity={0.7}>
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.pill} onPress={openSportSheet} activeOpacity={0.7}>
                <Text style={styles.pillText}>More ›</Text>
              </TouchableOpacity>
            </View>
            {isSportOther && (
              <View style={[styles.input, styles.inputRow, { marginTop: 10 }]}>
                <TextInput
                  style={styles.inlineInput}
                  placeholder="Sport name..."
                  placeholderTextColor={colors.placeholder}
                  value={customSport}
                  onChangeText={setCustomSport}
                />
                <TouchableOpacity onPress={handleClearSport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider} />

            {/* Matchup */}
            <Text style={styles.fieldLabel}>Matchup</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Lakers vs Warriors"
              placeholderTextColor={colors.placeholder}
              value={matchup}
              onChangeText={setMatchup}
            />

            <View style={styles.divider} />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="e.g., Lakers -5.5, Over 225.5"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </FadeInView>

        {/* ── Card 2: Financials ── */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>FINANCIALS</Text>

            {/* Odds */}
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Odds</Text>
              <View style={styles.oddsFormatRow}>
                {(['american', 'decimal', 'fractional'] as OddsFormat[]).map((fmt) => (
                  <TouchableOpacity key={fmt} style={[styles.fmtPill, oddsFormat === fmt && styles.fmtPillActive]} onPress={() => setOddsFormat(fmt)} activeOpacity={0.7}>
                    <Text style={[styles.fmtText, oddsFormat === fmt && styles.fmtTextActive]}>
                      {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder={getOddsPlaceholder()}
              placeholderTextColor={colors.placeholder}
              value={odds}
              onChangeText={setOdds}
            />

            <View style={styles.divider} />

            {/* Wager */}
            <Text style={styles.fieldLabel}>Wager</Text>
            <View style={[styles.input, styles.inputRow]}>
              <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              <TextInput
                style={styles.inlineInput}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                value={wager}
                onChangeText={setWager}
              />
            </View>

            <View style={styles.divider} />

            {/* Potential Payout */}
            <Text style={styles.fieldLabel}>
              Potential Payout{'  '}
              <Text style={styles.hintText}>(auto-calculated)</Text>
            </Text>
            <RAnimated.View style={payoutStyle}>
              <View style={[styles.input, styles.inputRow, styles.readOnly]}>
                <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                <TextInput
                  style={styles.inlineInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder}
                  editable={false}
                  value={potentialPayout}
                />
              </View>
            </RAnimated.View>

            <View style={styles.divider} />

            {/* Status */}
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusRow}>
              {(['pending', 'won', 'lost', 'void'] as BetStatus[]).map((s) => (
                <StatusPill key={s} value={s} selected={status === s} onPress={() => setStatus(s)} />
              ))}
            </View>
          </View>
        </FadeInView>

        {/* ── Card 3: Details ── */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>DETAILS</Text>

            {/* Date */}
            <Text style={styles.fieldLabel}>Date Placed</Text>
            <TouchableOpacity style={[styles.input, styles.inputRow]} onPress={handleOpenDatePicker} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
              <Text style={[styles.inputRowText, !placedAt && { color: colors.placeholder }]}>
                {placedAt ? formatDateDisplay(placedAt) : 'Select date and time'}
              </Text>
            </TouchableOpacity>

            {/* Web date picker modal */}
            {Platform.OS === 'web' && showDatePicker && (
              <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                  <View style={styles.dateOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                      <View style={styles.webPickerCard}>
                        <Text style={styles.webPickerTitle}>Select date and time</Text>
                        <View style={styles.webInputRow}>
                          <Text style={styles.webLabel}>Date</Text>
                          <TextInput
                            style={styles.webInput}
                            value={`${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`}
                            onChangeText={(text) => {
                              const parts = text.split('-');
                              if (parts.length === 3) {
                                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), tempDate.getHours(), tempDate.getMinutes());
                                if (!isNaN(d.getTime())) setTempDate(d);
                              }
                            }}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                        <View style={styles.webInputRow}>
                          <Text style={styles.webLabel}>Time</Text>
                          <TextInput
                            style={styles.webInput}
                            value={`${String(tempDate.getHours()).padStart(2, '0')}:${String(tempDate.getMinutes()).padStart(2, '0')}`}
                            onChangeText={(text) => {
                              const parts = text.split(':');
                              if (parts.length === 2) {
                                const d = new Date(tempDate);
                                d.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0);
                                if (!isNaN(d.getTime())) setTempDate(d);
                              }
                            }}
                            placeholder="HH:MM"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                        <View style={styles.webBtnRow}>
                          <TouchableOpacity style={styles.webCancelBtn} onPress={() => setShowDatePicker(false)}>
                            <Text style={styles.webCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.webConfirmBtn} onPress={handleConfirmWebDate}>
                            <Text style={styles.webConfirmText}>Confirm</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </TouchableWithoutFeedback>
              </Modal>
            )}

            {/* Native date pickers */}
            {Platform.OS !== 'web' && showDatePicker && (
              <DateTimePicker value={tempDate} mode="date" display="default" onChange={handleDateChange} minimumDate={minDate} maximumDate={maxDate} />
            )}
            {Platform.OS !== 'web' && showTimePicker && (
              <DateTimePicker value={tempDate} mode="time" display="default" onChange={handleTimeChange} />
            )}

            {/* Parlay Legs */}
            {betType === 'parlay' && (
              <>
                <View style={styles.divider} />
                <View style={styles.parlayHeader}>
                  <Text style={styles.fieldLabel}>Parlay Legs</Text>
                  <View style={styles.parlayBadge}>
                    <Text style={styles.parlayBadgeText}>{parlayLegs.length}</Text>
                  </View>
                </View>

                {parlayLegs.map((leg, index) => (
                  <View key={index} style={styles.legCard}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={[styles.input, styles.legInput]}
                        placeholder="e.g. Lakers ML"
                        placeholderTextColor={colors.placeholder}
                        value={leg.description}
                        onChangeText={(val) => updateParlayLeg(index, 'description', val)}
                      />
                      <TextInput
                        style={[styles.input, styles.legInput]}
                        placeholder="e.g. +120"
                        placeholderTextColor={colors.placeholder}
                        value={leg.odds}
                        onChangeText={(val) => updateParlayLeg(index, 'odds', val)}
                      />
                      <View style={styles.legStatusRow}>
                        {(['pending', 'won', 'lost'] as BetStatus[]).map((s) => {
                          const isSelected = leg.status === s;
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[
                                styles.legStatusPill,
                                isSelected && (s === 'won' ? styles.legStatusWon : s === 'lost' ? styles.legStatusLost : styles.legStatusPending),
                              ]}
                              onPress={() => updateParlayLeg(index, 'status', s)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.legStatusText, isSelected && styles.legStatusTextActive]}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.legDeleteBtn}
                      onPress={() => removeParlayLeg(index)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={18} color="#E85D5D" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addLegBtn} onPress={addParlayLeg} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={18} color="#6366F1" />
                  <Text style={styles.addLegText}>Add Leg</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.divider} />

            {/* Notes */}
            <Text style={styles.fieldLabel}>
              Notes{'  '}<Text style={styles.hintText}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultilineLarge]}
              placeholder="Why did you make this bet?"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.divider} />

            {/* Tags */}
            <Text style={styles.fieldLabel}>
              Tags{'  '}<Text style={styles.hintText}>(optional)</Text>
            </Text>
            <View style={styles.pillsWrap}>
              {['Underdog Bet', 'Live Bet', 'Research-Based', 'High Confidence', 'Hedge Bet', 'System Play'].map((tag) => (
                <TouchableOpacity key={tag} style={[styles.pill, selectedTags.includes(tag) && styles.pillActive]} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                  <Text style={[styles.pillText, selectedTags.includes(tag) && styles.pillTextActive]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Upload */}
            <Text style={styles.fieldLabel}>
              Ticket Screenshot{'  '}<Text style={styles.hintText}>(optional)</Text>
            </Text>
            {ticketImageUrl ? (
              <View style={styles.imageWrap}>
                <Image source={{ uri: ticketImageUrl }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setTicketImageUrl('')} activeOpacity={0.7}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.retakeBtn} onPress={() => setTicketImageUrl('')} activeOpacity={0.7}>
                  <Text style={styles.retakeText}>Remove / Re-upload</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.uploadArea} activeOpacity={0.7}>
                  <Ionicons name="cloud-upload-outline" size={28} color={colors.textTertiary} />
                  <Text style={styles.uploadTitle}>Choose Photo or Take Photo</Text>
                  <Text style={styles.uploadHint}>PNG, JPG up to 10MB</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.input, styles.inputRow, { marginTop: 10 }]} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  <Text style={styles.inputRowText}>Take Photo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </FadeInView>

        {/* ── Save Button ── */}
        <FadeInView delay={240} direction="bottom">
          <AnimatedPressable
            style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleSaveBet}
            disabled={isSaving}
            scaleDown={0.98}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Bet</Text>
            )}
          </AnimatedPressable>
        </FadeInView>

      </ScrollView>

      {/* ── Sport Bottom Sheet ── */}
      <Modal visible={sportSheet.visible} transparent animationType="none" onRequestClose={sportSheet.closeSheet}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={sportSheet.closeSheet}>
            <Animated.View style={[styles.sheetOverlay, { opacity: sportSheet.overlayAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sportSheet.slideAnim }] }]}>
            <View style={styles.handleArea} {...sportSheet.panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search sports..."
                placeholderTextColor={colors.placeholder}
                value={sportSearch}
                onChangeText={setSportSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {sportSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSportSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#C0C0C0" />
                </TouchableOpacity>
              )}
            </View>
            {renderSportSheetContent()}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    // Layout
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 48 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 40 },

    // AI Banner
    banner: { backgroundColor: '#F0EEFF', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 20, marginBottom: 16, gap: 10 },
    bannerBody: { flex: 1 },
    bannerText: { fontSize: 14, fontWeight: '500', color: '#6C63FF' },
    confidenceText: { fontSize: 12, fontWeight: '400', color: '#9B8FE0', marginTop: 2 },

    // Cards
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 16 },
    cardTitle: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 20 },
    divider: { height: 1, backgroundColor: colors.dividerLine, marginVertical: 16 },

    // Field labels
    fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
    hintText: { fontSize: 12, fontWeight: '400', color: colors.textTertiary },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },

    // Inputs
    input: { backgroundColor: colors.input, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontSize: 15, color: colors.inputText, height: 50 },
    inputMultiline: { height: 88, paddingTop: 14, paddingVertical: 0 },
    inputMultilineLarge: { height: 108, paddingTop: 14, paddingVertical: 0 },
    inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
    inputRowText: { flex: 1, fontSize: 15, color: colors.inputText },
    inlineInput: { flex: 1, fontSize: 15, color: colors.inputText, height: 50 },
    readOnly: { backgroundColor: colors.chipBg },

    // Currency
    currencySymbol: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginRight: 4 },

    // Pills (bet type, platform, sport, tags)
    pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'transparent' },
    pillActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
    pillText: { fontSize: 13, fontWeight: '600', color: colors.text },
    pillTextActive: { color: '#FFFFFF' },

    // Odds format toggle
    oddsFormatRow: { flexDirection: 'row', gap: 4 },
    fmtPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    fmtPillActive: { backgroundColor: colors.buttonPrimary },
    fmtText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    fmtTextActive: { color: '#FFFFFF' },

    // Status
    statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

    // Save button
    saveBtn: { backgroundColor: colors.buttonPrimary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 4 },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

    // Parlay
    parlayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    parlayBadge: { backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    parlayBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
    legCard: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 10 },
    legInput: { height: 44, marginBottom: 8 },
    legStatusRow: { flexDirection: 'row', gap: 6 },
    legStatusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
    legStatusPending: { borderColor: '#2DC672' },
    legStatusWon: { backgroundColor: '#2DC672', borderColor: '#2DC672' },
    legStatusLost: { backgroundColor: '#E85D5D', borderColor: '#E85D5D' },
    legStatusText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    legStatusTextActive: { color: '#FFFFFF' },
    legDeleteBtn: { padding: 4, marginTop: 2 },
    addLegBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#6366F1', borderStyle: 'dashed' },
    addLegText: { fontSize: 14, fontWeight: '600', color: '#6366F1' },

    // Image
    imageWrap: { position: 'relative', marginBottom: 4 },
    imagePreview: { width: '100%', height: 120, borderRadius: 12, backgroundColor: colors.dividerLine },
    imageRemoveBtn: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    retakeBtn: { alignItems: 'center', paddingVertical: 10 },
    retakeText: { fontSize: 14, fontWeight: '500', color: '#6C63FF' },
    uploadArea: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', paddingVertical: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.input },
    uploadTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 8 },
    uploadHint: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },

    // Date picker (web)
    dateOverlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', alignItems: 'center' },
    webPickerCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: 320 },
    webPickerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20, textAlign: 'center' },
    webInputRow: { marginBottom: 16 },
    webLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    webInput: { backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.inputText, height: 46 },
    webBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    webCancelBtn: { flex: 1, backgroundColor: colors.input, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    webCancelText: { fontSize: 15, fontWeight: '600', color: colors.text },
    webConfirmBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    webConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

    // Bottom sheet
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
    sheet: { height: SHEET_HEIGHT, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    handleArea: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderRadius: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 8, paddingHorizontal: 12, height: 44 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: colors.inputText, height: 44 },
    listContent: { paddingBottom: 40 },
    categoryHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, backgroundColor: colors.chipBg },
    categoryText: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 },
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, borderBottomWidth: 1, borderBottomColor: colors.input, backgroundColor: colors.surface },
    listRowText: { fontSize: 15, fontWeight: '400', color: colors.text, flex: 1 },
    emptyContainer: { paddingTop: 40, alignItems: 'center' },
    emptyText: { fontSize: 15, color: colors.textTertiary },
    chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
    chip: { backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 16, height: 42, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', minWidth: '45%' as any, flexGrow: 1, flexBasis: '45%' as any },
    chipSelected: { backgroundColor: '#10B981' },
    chipText: { fontSize: 14, fontWeight: '500', color: colors.text },
    chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
    moreSportsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.input },
    moreSportsTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    moreSportsContent: { paddingBottom: 20 },
  });
}
