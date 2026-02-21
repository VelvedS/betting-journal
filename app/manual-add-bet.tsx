import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  FlatList,
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

type BetType = 'moneyline' | 'spread' | 'ou' | 'parlay' | 'prop' | 'other';
type OddsFormat = 'american' | 'decimal' | 'fractional';
type BetStatus = 'pending' | 'won' | 'lost' | 'void';

// ── Platform data ──

interface PlatformCategory { category: string; platforms: string[]; }

const PLATFORM_DATA: PlatformCategory[] = [
  { category: 'Classic DFS Platforms', platforms: ['DraftKings', 'FanDuel', 'Yahoo Fantasy / DFS', 'OwnersBox'] },
  { category: "Pick'em / Player Prop DFS", platforms: ['PrizePicks', 'Underdog Fantasy', 'Sleeper Picks', 'DraftKings Pick6', 'FanDuel Fantasy', 'Betr Picks', 'Boom Fantasy', 'ParlayPlay', 'Dabble', 'Bleacher Nation Fantasy', 'Playsqor', 'Thrillzz', 'Rebet'] },
  { category: 'Season-Long Fantasy', platforms: ['ESPN Fantasy', 'Yahoo Fantasy', 'Sleeper', 'NFL Fantasy', 'CBS Sports Fantasy'] },
  { category: 'Other', platforms: ['Other'] },
];

type PlatformListItem = { type: 'category'; category: string } | { type: 'platform'; name: string };

function buildPlatformItems(data: PlatformCategory[]): PlatformListItem[] {
  const items: PlatformListItem[] = [];
  for (const g of data) { items.push({ type: 'category', category: g.category }); for (const p of g.platforms) items.push({ type: 'platform', name: p }); }
  return items;
}

function filterPlatforms(data: PlatformCategory[], query: string): PlatformListItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return buildPlatformItems(data);
  const items: PlatformListItem[] = [];
  for (const g of data) { const m = g.platforms.filter((p) => p.toLowerCase().includes(q)); if (m.length > 0) { items.push({ type: 'category', category: g.category }); for (const p of m) items.push({ type: 'platform', name: p }); } }
  return items;
}

// ── Sport data ──

const POPULAR_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'UFC / MMA', 'Soccer (All)', 'Tennis', 'Golf', 'Boxing', 'NASCAR', 'PGA Tour', 'Esports'];

interface SportCategory { category: string; sports: string[]; }
const MORE_SPORTS_DATA: SportCategory[] = [
  { category: 'Soccer Leagues', sports: ['EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League', 'Liga MX', 'MLS', 'World Cup'] },
  { category: 'College Sports', sports: ['NCAAW', 'College Baseball', 'College Hockey'] },
  { category: 'Combat Sports', sports: ['Bellator', 'PFL'] },
  { category: 'Motorsports', sports: ['Formula 1', 'IndyCar', 'MotoGP'] },
  { category: 'Golf Events', sports: ['LIV Golf', 'LPGA', 'The Masters', 'US Open (Golf)', 'The Open Championship', 'Ryder Cup'] },
  { category: 'Tennis Events', sports: ['Australian Open', 'French Open', 'Wimbledon', 'US Open (Tennis)'] },
  { category: 'International Basketball', sports: ['WNBA', 'EuroLeague', 'FIBA World Cup'] },
  { category: 'International Baseball', sports: ['NPB (Japan)', 'KBO (Korea)'] },
  { category: 'Cricket', sports: ['IPL', 'T20 World Cup', 'The Ashes'] },
  { category: 'Rugby', sports: ['Rugby Union', 'Rugby World Cup', 'NRL'] },
  { category: 'Entertainment / Specials', sports: ['Politics / Elections', 'Award Shows', 'Reality TV', 'Novelty Props'] },
  { category: 'Other', sports: ['Other'] },
];
const ALL_SPORTS = [...POPULAR_SPORTS, ...MORE_SPORTS_DATA.flatMap((c) => c.sports)];

// ── Payout calculation ──

function calcPayout(wagerStr: string, oddsStr: string, format: OddsFormat): number {
  const w = parseFloat(wagerStr);
  if (!w || w <= 0 || !oddsStr.trim()) return 0;

  if (format === 'american') {
    const cleaned = oddsStr.trim().replace(/^\+/, '');
    const odds = parseFloat(cleaned);
    if (isNaN(odds) || odds === 0) return 0;
    return odds > 0 ? w + w * (odds / 100) : w + w * (100 / Math.abs(odds));
  }
  if (format === 'decimal') {
    const odds = parseFloat(oddsStr.trim());
    if (isNaN(odds) || odds <= 0) return 0;
    return w * odds;
  }
  if (format === 'fractional') {
    const parts = oddsStr.trim().split('/');
    if (parts.length !== 2) return 0;
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (isNaN(num) || isNaN(den) || den === 0) return 0;
    return w + w * (num / den);
  }
  return 0;
}

function formatPayout(val: number): string {
  return val > 0 ? val.toFixed(2) : '0.00';
}

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
        style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.border, borderWidth: s.bw }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <Text style={[styles.statusPillText, { color: s.text }]}>
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

  useEffect(() => {
    const wagerNum = parseFloat(wager);
    const oddsStr = odds?.trim();
    if (!wagerNum || wagerNum <= 0 || !oddsStr) {
      setPotentialPayout('0.00');
      return;
    }
    let payout = 0;
    if (oddsFormat === 'american' || oddsFormat === 'American') {
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
    } else if (oddsFormat === 'decimal' || oddsFormat === 'Decimal') {
      const oddsNum = parseFloat(oddsStr);
      if (isNaN(oddsNum) || oddsNum <= 0) {
        setPotentialPayout('0.00');
        return;
      }
      payout = wagerNum * oddsNum;
    } else if (oddsFormat === 'fractional' || oddsFormat === 'Fractional') {
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
      // No payout to back-calculate from — fall back to AI-extracted odds
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
    if (Platform.OS === 'web') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const handleConfirmWebDate = () => {
    setPlacedAt(tempDate);
    setShowDatePicker(false);
  };

  // Ticket image
  const [ticketImageUrl, setTicketImageUrl] = useState(params.ticket_image_url || '');
  const [confidence, setConfidence] = useState(() => params.confidence ? parseFloat(params.confidence) : null);
  const [showAiBanner, setShowAiBanner] = useState(hasRouteParams);

  // Sportsbook state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(params.sportsbook || null);
  const [isPlatformOther, setIsPlatformOther] = useState(false);
  const [customPlatform, setCustomPlatform] = useState('');
  const [platformSearch, setPlatformSearch] = useState('');
  const platformSheet = useBottomSheet();

  const openPlatformSheet = () => { setPlatformSearch(''); platformSheet.openSheet(); };
  const handleSelectPlatform = (name: string) => {
    if (name === 'Other') { setSelectedPlatform(null); setIsPlatformOther(true); setCustomPlatform(''); }
    else { setSelectedPlatform(name); setIsPlatformOther(false); setCustomPlatform(''); }
    platformSheet.closeSheet();
  };
  const handleClearPlatform = () => { setIsPlatformOther(false); setCustomPlatform(''); setSelectedPlatform(null); };
  const filteredPlatformItems = filterPlatforms(PLATFORM_DATA, platformSearch);

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

      // Save parlay legs if betType is parlay
      if (betType === 'parlay' && parlayLegs.length > 0 && data?.id) {
        try {
          await supabase.from('parlay_legs').insert(
            parlayLegs.map((leg: any, idx: number) => ({
              bet_id: data.id,
              pick: leg.description || '',
              odds: leg.odds || '',
              status: leg.status || 'pending',
              leg_number: idx + 1,
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

  // Platform sheet renderer
  const renderPlatformItem = ({ item }: { item: PlatformListItem }) => {
    if (item.type === 'category') return <View style={bsStyles.categoryHeader}><Text style={bsStyles.categoryText}>{item.category}</Text></View>;
    const sel = (!isPlatformOther && selectedPlatform === item.name) || (isPlatformOther && item.name === 'Other');
    return (
      <TouchableOpacity style={bsStyles.listRow} onPress={() => handleSelectPlatform(item.name)} activeOpacity={0.6}>
        <Text style={bsStyles.listRowText}>{item.name}</Text>
        {sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}
      </TouchableOpacity>
    );
  };

  // Sport sheet content
  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const renderSportSheetContent = () => {
    if (filteredSports) {
      return (
        <ScrollView contentContainerStyle={bsStyles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filteredSports.length === 0 ? <View style={bsStyles.emptyContainer}><Text style={bsStyles.emptyText}>No sports found</Text></View> :
            filteredSports.map((sport, i) => {
              const sel = (!isSportOther && selectedSport === sport) || (isSportOther && sport === 'Other');
              return <TouchableOpacity key={`${sport}-${i}`} style={bsStyles.listRow} onPress={() => handleSelectSport(sport)} activeOpacity={0.6}><Text style={bsStyles.listRowText}>{sport}</Text>{sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}</TouchableOpacity>;
            })}
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={bsStyles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={bsStyles.categoryHeader}><Text style={bsStyles.categoryText}>Popular</Text></View>
        <View style={sportStyles.chipsGrid}>
          {POPULAR_SPORTS.map((sport) => {
            const sel = !isSportOther && selectedSport === sport;
            return <TouchableOpacity key={sport} style={[sportStyles.chip, sel && sportStyles.chipSelected]} onPress={() => handleSelectSport(sport)} activeOpacity={0.7}><Text style={[sportStyles.chipText, sel && sportStyles.chipTextSelected]}>{sport}</Text>{sel && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />}</TouchableOpacity>;
          })}
        </View>
        <TouchableOpacity style={sportStyles.moreSportsHeader} onPress={toggleMoreSports} activeOpacity={0.7}>
          <Text style={sportStyles.moreSportsTitle}>More Sports</Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}><Ionicons name="chevron-down" size={16} color="#9B9B9B" /></Animated.View>
        </TouchableOpacity>
        {moreSportsExpanded && (
          <View style={sportStyles.moreSportsContent}>
            {MORE_SPORTS_DATA.map((cat) => (
              <View key={cat.category}>
                <View style={bsStyles.categoryHeader}><Text style={bsStyles.categoryText}>{cat.category}</Text></View>
                {cat.sports.map((sport, i) => {
                  const sel = (!isSportOther && selectedSport === sport) || (isSportOther && sport === 'Other');
                  return <TouchableOpacity key={`${sport}-${i}`} style={bsStyles.listRow} onPress={() => handleSelectSport(sport)} activeOpacity={0.6}><Text style={bsStyles.listRowText}>{sport}</Text>{sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}</TouchableOpacity>;
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
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        {/* AI Banner */}
        {hasRouteParams && showAiBanner && (
          <View style={aiStyles.banner}>
            <Ionicons name="sparkles" size={18} color="#6C63FF" />
            <View style={aiStyles.bannerTextWrap}>
              <Text style={aiStyles.bannerText}>AI-extracted — please review before saving</Text>
              {confidence !== null && <Text style={aiStyles.confidenceText}>Confidence: {Math.round(confidence * 100)}%</Text>}
            </View>
            <TouchableOpacity onPress={() => setShowAiBanner(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#6C63FF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Field 1 - Sportsbook */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Where did you place this bet?</Text>
          {isPlatformOther ? (
            <View style={styles.customInputContainer}>
              <TextInput style={styles.customInput} placeholder="Type platform name..." placeholderTextColor="#9B9B9B" value={customPlatform} onChangeText={setCustomPlatform} />
              <TouchableOpacity style={styles.clearButton} onPress={handleClearPlatform} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color="#9B9B9B" /><Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.dropdownInput} onPress={openPlatformSheet} activeOpacity={0.7}>
              <Text style={[styles.dropdownValueText, !selectedPlatform && styles.dropdownPlaceholderText]}>{selectedPlatform || 'Select a platform...'}</Text>
              <Ionicons name="chevron-down" size={18} color="#9B9B9B" style={styles.dropdownIcon} />
            </TouchableOpacity>
          )}
        </View>

        {/* Field 2 - Bet Type */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>What type of bet?</Text>
          <View style={styles.pillsContainer}>
            {(['moneyline', 'spread', 'ou', 'parlay', 'prop', 'other'] as BetType[]).map((type) => (
              <TouchableOpacity key={type} style={[styles.pill, betType === type && styles.pillActive]} onPress={() => setBetType(type)} activeOpacity={0.7}>
                <Text style={[styles.pillText, betType === type && styles.pillTextActive]}>
                  {type === 'ou' ? 'O/U' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Field 3 - Sport */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>What sport?</Text>
          {isSportOther ? (
            <View style={styles.customInputContainer}>
              <TextInput style={styles.customInput} placeholder="Type sport name..." placeholderTextColor="#9B9B9B" value={customSport} onChangeText={setCustomSport} />
              <TouchableOpacity style={styles.clearButton} onPress={handleClearSport} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color="#9B9B9B" /><Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.dropdownInput} onPress={openSportSheet} activeOpacity={0.7}>
              <Text style={[styles.dropdownValueText, !selectedSport && styles.dropdownPlaceholderText]}>{selectedSport || 'Select a sport...'}</Text>
              <Ionicons name="chevron-down" size={18} color="#9B9B9B" style={styles.dropdownIcon} />
            </TouchableOpacity>
          )}
        </View>

        {/* Field 4 - Matchup */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Who's playing? (Matchup/Event)</Text>
          <TextInput style={styles.textInput} placeholder="e.g., Lakers vs Warriors" placeholderTextColor="#9B9B9B" value={matchup} onChangeText={setMatchup} />
        </View>

        {/* Field 5 - Description */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Describe your bet</Text>
          <TextInput style={[styles.textInput, styles.textareaInput]} placeholder="e.g., Lakers -5.5, Over 225.5" placeholderTextColor="#9B9B9B" multiline numberOfLines={3} textAlignVertical="top" value={description} onChangeText={setDescription} />
        </View>

        {/* Field 6 - Odds */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Odds</Text>
          <View style={styles.oddsFormatContainer}>
            {(['american', 'decimal', 'fractional'] as OddsFormat[]).map((fmt) => (
              <TouchableOpacity key={fmt} style={[styles.oddsFormatPill, oddsFormat === fmt && styles.oddsFormatPillActive]} onPress={() => setOddsFormat(fmt)} activeOpacity={0.7}>
                <Text style={[styles.oddsFormatText, oddsFormat === fmt && styles.oddsFormatTextActive]}>{fmt.charAt(0).toUpperCase() + fmt.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.textInput} placeholder={getOddsPlaceholder()} placeholderTextColor="#9B9B9B" value={odds} onChangeText={setOdds} />
        </View>

        {/* Field 7 - Wager */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>How much did you wager?</Text>
          <View style={styles.currencyInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput style={styles.currencyInput} placeholder="0.00" placeholderTextColor="#9B9B9B" keyboardType="decimal-pad" value={wager} onChangeText={setWager} />
          </View>
        </View>

        {/* Field 8 - Potential Payout */}
        <View style={styles.formField}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Potential Payout</Text>
            <Text style={styles.labelHint}>(Auto-calculated)</Text>
          </View>
          <View style={[styles.currencyInputContainer, styles.readOnlyInput]}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput style={styles.currencyInput} placeholder="0.00" placeholderTextColor="#9B9B9B" editable={false} value={potentialPayout} />
          </View>
        </View>

        {/* Field 9 - Status */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusContainer}>
            {(['pending', 'won', 'lost', 'void'] as BetStatus[]).map((s) => (
              <StatusPill key={s} value={s} selected={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        </View>

        {/* Field 10 - Date */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>When was this bet placed?</Text>
          <TouchableOpacity style={styles.dropdownInput} onPress={handleOpenDatePicker} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={18} color="#9B9B9B" style={{ marginRight: 10 }} />
            <Text style={[styles.dropdownValueText, !placedAt && styles.dropdownPlaceholderText]}>
              {placedAt ? formatDateDisplay(placedAt) : 'Select date and time'}
            </Text>
          </TouchableOpacity>

          {/* Web date picker modal */}
          {Platform.OS === 'web' && showDatePicker && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
              <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                <View style={dateStyles.overlay}>
                  <TouchableWithoutFeedback onPress={() => {}}>
                    <View style={dateStyles.webPickerCard}>
                      <Text style={dateStyles.webPickerTitle}>Select date and time</Text>
                      <View style={dateStyles.webInputRow}>
                        <Text style={dateStyles.webLabel}>Date</Text>
                        <TextInput
                          style={dateStyles.webInput}
                          value={`${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`}
                          onChangeText={(text) => {
                            const parts = text.split('-');
                            if (parts.length === 3) {
                              const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), tempDate.getHours(), tempDate.getMinutes());
                              if (!isNaN(d.getTime())) setTempDate(d);
                            }
                          }}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#9B9B9B"
                        />
                      </View>
                      <View style={dateStyles.webInputRow}>
                        <Text style={dateStyles.webLabel}>Time</Text>
                        <TextInput
                          style={dateStyles.webInput}
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
                          placeholderTextColor="#9B9B9B"
                        />
                      </View>
                      <View style={dateStyles.webButtonRow}>
                        <TouchableOpacity style={dateStyles.webCancelBtn} onPress={() => setShowDatePicker(false)}>
                          <Text style={dateStyles.webCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={dateStyles.webConfirmBtn} onPress={handleConfirmWebDate}>
                          <Text style={dateStyles.webConfirmText}>Confirm</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}

          {/* Native date picker */}
          {Platform.OS !== 'web' && showDatePicker && (
            <DateTimePicker value={tempDate} mode="date" display="default" onChange={handleDateChange} minimumDate={minDate} maximumDate={maxDate} />
          )}
          {Platform.OS !== 'web' && showTimePicker && (
            <DateTimePicker value={tempDate} mode="time" display="default" onChange={handleTimeChange} />
          )}
        </View>

        {/* Field 10B - Parlay Legs (only if bet_type === 'parlay') */}
        {betType === 'parlay' && (
          <View style={styles.formField}>
            <View style={styles.parlayHeaderRow}>
              <Text style={styles.fieldLabel}>Parlay Legs</Text>
              <View style={styles.parlayCountBadge}>
                <Text style={styles.parlayCountText}>{parlayLegs.length}</Text>
              </View>
            </View>

            {parlayLegs.map((leg, index) => (
              <View key={index} style={styles.parlayLegCard}>
                <View style={styles.parlayLegContent}>
                  <TextInput
                    style={[styles.textInput, styles.parlayLegInput]}
                    placeholder="e.g. Lakers ML"
                    placeholderTextColor="#9B9B9B"
                    value={leg.description}
                    onChangeText={(val) => updateParlayLeg(index, 'description', val)}
                  />
                  <TextInput
                    style={[styles.textInput, styles.parlayLegInput]}
                    placeholder="e.g. +120"
                    placeholderTextColor="#9B9B9B"
                    value={leg.odds}
                    onChangeText={(val) => updateParlayLeg(index, 'odds', val)}
                  />

                  <View style={styles.parlayLegStatusRow}>
                    {(['pending', 'won', 'lost'] as BetStatus[]).map((s) => {
                      if (s === 'void') return null;
                      const isSelected = leg.status === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.parlayStatusPill,
                            isSelected && (s === 'won' ? styles.parlayStatusWon : s === 'lost' ? styles.parlayStatusLost : styles.parlayStatusPending),
                          ]}
                          onPress={() => updateParlayLeg(index, 'status', s)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.parlayStatusText,
                              isSelected && styles.parlayStatusTextActive,
                            ]}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.parlayDeleteBtn}
                  onPress={() => removeParlayLeg(index)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color="#E85D5D" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addLegButton} onPress={addParlayLeg} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color="#6366F1" />
              <Text style={styles.addLegText}>Add Leg</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Field 11 - Notes */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Notes (Optional)</Text>
          <TextInput style={[styles.textInput, styles.textareaInputLarge]} placeholder="Why did you make this bet?" placeholderTextColor="#9B9B9B" multiline numberOfLines={4} textAlignVertical="top" value={notes} onChangeText={setNotes} />
        </View>

        {/* Field 12 - Upload Screenshot */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Upload Ticket Screenshot (Optional)</Text>
          {ticketImageUrl ? (
            <View style={aiStyles.imagePreviewWrap}>
              <Image source={{ uri: ticketImageUrl }} style={aiStyles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={aiStyles.imageRemoveBtn} onPress={() => setTicketImageUrl('')} activeOpacity={0.7}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={aiStyles.retakeBtn} activeOpacity={0.7} onPress={() => setTicketImageUrl('')}>
                <Text style={aiStyles.retakeText}>Retake / Re-upload</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.uploadArea} activeOpacity={0.7}>
                <Ionicons name="cloud-upload-outline" size={28} color="#9B9B9B" />
                <Text style={styles.uploadTitle}>Choose Photo or Take Photo</Text>
                <Text style={styles.uploadHint}>PNG, JPG up to 10MB</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.takePhotoButton} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={18} color="#4A4A4A" style={styles.takePhotoIcon} />
                <Text style={styles.takePhotoText}>Take Photo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Field 13 - Tags */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Tags (Optional)</Text>
          <View style={styles.tagsContainer}>
            {['Underdog Bet', 'Live Bet', 'Research-Based', 'High Confidence', 'Hedge Bet', 'System Play'].map((tag) => (
              <TouchableOpacity key={tag} style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={[styles.submitButton, isSaving && { opacity: 0.7 }]} onPress={handleSaveBet} activeOpacity={0.8} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Save Bet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Platform Bottom Sheet */}
      <Modal visible={platformSheet.visible} transparent animationType="none" onRequestClose={platformSheet.closeSheet}>
        <View style={bsStyles.modalContainer}>
          <TouchableWithoutFeedback onPress={platformSheet.closeSheet}><Animated.View style={[bsStyles.overlay, { opacity: platformSheet.overlayAnim }]} /></TouchableWithoutFeedback>
          <Animated.View style={[bsStyles.sheet, { transform: [{ translateY: platformSheet.slideAnim }] }]}>
            <View style={bsStyles.handleArea} {...platformSheet.panResponder.panHandlers}><View style={bsStyles.handle} /></View>
            <View style={bsStyles.searchContainer}>
              <Ionicons name="search" size={18} color="#9B9B9B" style={bsStyles.searchIcon} />
              <TextInput style={bsStyles.searchInput} placeholder="Search platforms..." placeholderTextColor="#9B9B9B" value={platformSearch} onChangeText={setPlatformSearch} autoCorrect={false} autoCapitalize="none" />
              {platformSearch.length > 0 && <TouchableOpacity onPress={() => setPlatformSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={18} color="#C0C0C0" /></TouchableOpacity>}
            </View>
            <FlatList data={filteredPlatformItems} renderItem={renderPlatformItem} keyExtractor={(item, i) => item.type === 'category' ? `pcat-${item.category}` : `pplat-${(item as any).name}-${i}`} contentContainerStyle={bsStyles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={bsStyles.emptyContainer}><Text style={bsStyles.emptyText}>No platforms found</Text></View>} />
          </Animated.View>
        </View>
      </Modal>

      {/* Sport Bottom Sheet */}
      <Modal visible={sportSheet.visible} transparent animationType="none" onRequestClose={sportSheet.closeSheet}>
        <View style={bsStyles.modalContainer}>
          <TouchableWithoutFeedback onPress={sportSheet.closeSheet}><Animated.View style={[bsStyles.overlay, { opacity: sportSheet.overlayAnim }]} /></TouchableWithoutFeedback>
          <Animated.View style={[bsStyles.sheet, { transform: [{ translateY: sportSheet.slideAnim }] }]}>
            <View style={bsStyles.handleArea} {...sportSheet.panResponder.panHandlers}><View style={bsStyles.handle} /></View>
            <View style={bsStyles.searchContainer}>
              <Ionicons name="search" size={18} color="#9B9B9B" style={bsStyles.searchIcon} />
              <TextInput style={bsStyles.searchInput} placeholder="Search sports..." placeholderTextColor="#9B9B9B" value={sportSearch} onChangeText={setSportSearch} autoCorrect={false} autoCapitalize="none" />
              {sportSearch.length > 0 && <TouchableOpacity onPress={() => setSportSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={18} color="#C0C0C0" /></TouchableOpacity>}
            </View>
            {renderSportSheetContent()}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── AI styles ──
const aiStyles = StyleSheet.create({
  banner: { backgroundColor: '#F0EEFF', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20, gap: 10 },
  bannerTextWrap: { flex: 1 },
  bannerText: { fontSize: 14, fontWeight: '500', color: '#6C63FF' },
  confidenceText: { fontSize: 12, fontWeight: '400', color: '#9B9B9B', marginTop: 2 },
  payoutNote: { fontSize: 12, fontWeight: '400', color: '#6C63FF', marginTop: 6 },
  imagePreviewWrap: { position: 'relative', marginBottom: 12 },
  imagePreview: { width: '100%', height: 120, borderRadius: 10, backgroundColor: '#E0E0E0' },
  imageRemoveBtn: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  retakeBtn: { alignItems: 'center', paddingVertical: 10 },
  retakeText: { fontSize: 14, fontWeight: '500', color: '#6C63FF' },
  parlayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  parlayCountBadge: { backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  parlayCountText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  parlayLegCard: { backgroundColor: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  parlayLegContent: { flex: 1 },
  parlayLegInput: { marginBottom: 8 },
  parlayLegStatusRow: { flexDirection: 'row', gap: 6 },
  parlayStatusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#E5E7EB' },
  parlayStatusPending: { backgroundColor: 'transparent', borderColor: '#2DC672' },
  parlayStatusWon: { backgroundColor: '#2DC672', borderColor: '#2DC672' },
  parlayStatusLost: { backgroundColor: '#E85D5D', borderColor: '#E85D5D' },
  parlayStatusText: { fontSize: 12, fontWeight: '600', color: '#4A4A4A' },
  parlayStatusTextActive: { color: '#FFFFFF' },
  parlayDeleteBtn: { padding: 4 },
  addLegButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#6366F1', borderStyle: 'dashed' },
  addLegText: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
});

// ── Date picker styles ──
const dateStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', alignItems: 'center' },
  webPickerCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: 320 },
  webPickerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 20, textAlign: 'center' },
  webInputRow: { marginBottom: 16 },
  webLabel: { fontSize: 13, fontWeight: '600', color: '#4A4A4A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  webInput: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#1A1A1A', height: 46 },
  webButtonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  webCancelBtn: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  webCancelText: { fontSize: 15, fontWeight: '600', color: '#4A4A4A' },
  webConfirmBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  webConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});

// ── Shared bottom sheet styles ──
const bsStyles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  sheet: { height: SHEET_HEIGHT, backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handleArea: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 8, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', height: 44 },
  listContent: { paddingBottom: 40 },
  categoryHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  categoryText: { fontSize: 11, fontWeight: '700', color: '#999999', textTransform: 'uppercase', letterSpacing: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  listRowText: { fontSize: 15, fontWeight: '400', color: '#1A1A1A', flex: 1 },
  emptyContainer: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#9B9B9B' },
});

// ── Sport-specific styles ──
const sportStyles = StyleSheet.create({
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  chip: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 16, height: 42, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', minWidth: '45%' as any, flexGrow: 1, flexBasis: '45%' as any },
  chipSelected: { backgroundColor: '#10B981' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  moreSportsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  moreSportsTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  moreSportsContent: { paddingBottom: 20 },
});

// ── Form styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  formField: { marginBottom: 22 },
  fieldLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  labelHint: { fontSize: 13, fontWeight: '400', color: '#9B9B9B', marginLeft: 6 },
  textInput: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '400', color: '#1A1A1A', height: 50 },
  textareaInput: { height: 90, paddingTop: 14 },
  textareaInputLarge: { height: 110, paddingTop: 14 },
  dropdownInput: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, height: 50, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  dropdownValueText: { flex: 1, fontSize: 14, fontWeight: '400', color: '#1A1A1A' },
  dropdownPlaceholderText: { color: '#9B9B9B' },
  dropdownIcon: { marginLeft: 8 },
  dateInputPlaceholder: { flex: 1 },
  customInputContainer: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 16, height: 50, flexDirection: 'row', alignItems: 'center' },
  customInput: { flex: 1, fontSize: 14, fontWeight: '400', color: '#1A1A1A', height: 50 },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
  clearText: { fontSize: 13, fontWeight: '500', color: '#9B9B9B' },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10, height: 38, justifyContent: 'center' },
  pillActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  pillTextActive: { color: '#FFFFFF' },
  oddsFormatContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  oddsFormatPill: { paddingHorizontal: 16, paddingVertical: 8, height: 32, justifyContent: 'center' },
  oddsFormatPillActive: { backgroundColor: '#1A1A1A', borderRadius: 6 },
  oddsFormatText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  oddsFormatTextActive: { color: '#FFFFFF' },
  currencyInputContainer: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, height: 50, flexDirection: 'row', alignItems: 'center' },
  readOnlyInput: { backgroundColor: '#EBEBEB' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginRight: 8 },
  currencyInput: { flex: 1, fontSize: 14, fontWeight: '400', color: '#1A1A1A' },
  statusContainer: { flexDirection: 'row', gap: 10 },
  statusPill: { borderRadius: 9, paddingHorizontal: 16, paddingVertical: 10, height: 38, justifyContent: 'center' },
  statusPillText: { fontSize: 14, fontWeight: '600' },
  uploadArea: { backgroundColor: '#F8F8F8', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', paddingVertical: 30, alignItems: 'center', justifyContent: 'center', height: 130, marginBottom: 12 },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginTop: 10 },
  uploadHint: { fontSize: 12, fontWeight: '400', color: '#9B9B9B', marginTop: 4 },
  takePhotoButton: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8E8', paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46 },
  takePhotoIcon: { marginRight: 8 },
  takePhotoText: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { backgroundColor: '#F0F0F0', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, height: 34, justifyContent: 'center' },
  tagSelected: { backgroundColor: '#E0E0E0', borderWidth: 1, borderColor: '#9B9B9B' },
  tagText: { fontSize: 13, fontWeight: '500', color: '#4A4A4A' },
  tagTextSelected: { color: '#1A1A1A', fontWeight: '600' },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', height: 54, marginTop: 10 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
