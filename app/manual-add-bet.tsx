import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

type BetType = 'moneyline' | 'spread' | 'ou' | 'parlay' | 'prop' | 'other';
type OddsFormat = 'american' | 'decimal' | 'fractional';
type BetStatus = 'pending' | 'won' | 'lost' | 'void';

// ── Platform data ──

interface PlatformCategory {
  category: string;
  platforms: string[];
}

const PLATFORM_DATA: PlatformCategory[] = [
  { category: 'Classic DFS Platforms', platforms: ['DraftKings', 'FanDuel', 'Yahoo Fantasy / DFS', 'OwnersBox'] },
  { category: "Pick'em / Player Prop DFS", platforms: ['PrizePicks', 'Underdog Fantasy', 'Sleeper Picks', 'DraftKings Pick6', 'FanDuel Fantasy', 'Betr Picks', 'Boom Fantasy', 'ParlayPlay', 'Dabble', 'Bleacher Nation Fantasy', 'Playsqor', 'Thrillzz', 'Rebet'] },
  { category: 'Season-Long Fantasy', platforms: ['ESPN Fantasy', 'Yahoo Fantasy', 'Sleeper', 'NFL Fantasy', 'CBS Sports Fantasy'] },
  { category: 'Other', platforms: ['Other'] },
];

type PlatformListItem = { type: 'category'; category: string } | { type: 'platform'; name: string };

function buildPlatformItems(data: PlatformCategory[]): PlatformListItem[] {
  const items: PlatformListItem[] = [];
  for (const g of data) {
    items.push({ type: 'category', category: g.category });
    for (const p of g.platforms) items.push({ type: 'platform', name: p });
  }
  return items;
}

function filterPlatforms(data: PlatformCategory[], query: string): PlatformListItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return buildPlatformItems(data);
  const items: PlatformListItem[] = [];
  for (const g of data) {
    const matched = g.platforms.filter((p) => p.toLowerCase().includes(q));
    if (matched.length > 0) {
      items.push({ type: 'category', category: g.category });
      for (const p of matched) items.push({ type: 'platform', name: p });
    }
  }
  return items;
}

// ── Sport data ──

const POPULAR_SPORTS = [
  'NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB',
  'UFC / MMA', 'Soccer (All)', 'Tennis', 'Golf',
  'Boxing', 'NASCAR', 'PGA Tour', 'Esports',
];

interface SportCategory {
  category: string;
  sports: string[];
}

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

// Flat list of ALL sports for search
const ALL_SPORTS = [
  ...POPULAR_SPORTS,
  ...MORE_SPORTS_DATA.flatMap((c) => c.sports),
];

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
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }
      },
    })
  ).current;

  const [visible, setVisible] = useState(false);

  const openSheet = () => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  return { visible, slideAnim, overlayAnim, panResponder, openSheet, closeSheet };
}

// ── Main Component ──

export default function ManualAddBetScreen() {
  const router = useRouter();

  // Form state
  const [betType, setBetType] = useState<BetType>('moneyline');
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('american');
  const [status, setStatus] = useState<BetStatus>('pending');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wager, setWager] = useState('');
  const [payout, setPayout] = useState('');

  // ── Sportsbook state ──
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
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

  // ── Sport state ──
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
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

  const filteredSports = sportSearch.trim()
    ? ALL_SPORTS.filter((s) => s.toLowerCase().includes(sportSearch.toLowerCase().trim()))
    : null;

  // ── Helpers ──
  const getOddsPlaceholder = () => {
    switch (oddsFormat) {
      case 'american': return '+150 or -110';
      case 'decimal': return '2.50';
      case 'fractional': return '3/2';
      default: return '+150 or -110';
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSaveBet = () => { router.back(); };

  // ── Platform sheet renderer ──
  const renderPlatformItem = ({ item }: { item: PlatformListItem }) => {
    if (item.type === 'category') return (
      <View style={bsStyles.categoryHeader}><Text style={bsStyles.categoryText}>{item.category}</Text></View>
    );
    const sel = (!isPlatformOther && selectedPlatform === item.name) || (isPlatformOther && item.name === 'Other');
    return (
      <TouchableOpacity style={bsStyles.listRow} onPress={() => handleSelectPlatform(item.name)} activeOpacity={0.6}>
        <Text style={bsStyles.listRowText}>{item.name}</Text>
        {sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}
      </TouchableOpacity>
    );
  };

  // ── Sport sheet content ──
  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const renderSportSheetContent = () => {
    // Search mode — flat filtered list
    if (filteredSports) {
      return (
        <ScrollView contentContainerStyle={bsStyles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filteredSports.length === 0 ? (
            <View style={bsStyles.emptyContainer}><Text style={bsStyles.emptyText}>No sports found</Text></View>
          ) : (
            filteredSports.map((sport, i) => {
              const sel = (!isSportOther && selectedSport === sport) || (isSportOther && sport === 'Other');
              return (
                <TouchableOpacity key={`${sport}-${i}`} style={bsStyles.listRow} onPress={() => handleSelectSport(sport)} activeOpacity={0.6}>
                  <Text style={bsStyles.listRowText}>{sport}</Text>
                  {sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      );
    }

    // Default mode — Popular chips + collapsible More Sports
    return (
      <ScrollView contentContainerStyle={bsStyles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Popular Section */}
        <View style={bsStyles.categoryHeader}><Text style={bsStyles.categoryText}>Popular</Text></View>
        <View style={sportStyles.chipsGrid}>
          {POPULAR_SPORTS.map((sport) => {
            const sel = !isSportOther && selectedSport === sport;
            return (
              <TouchableOpacity
                key={sport}
                style={[sportStyles.chip, sel && sportStyles.chipSelected]}
                onPress={() => handleSelectSport(sport)}
                activeOpacity={0.7}
              >
                <Text style={[sportStyles.chipText, sel && sportStyles.chipTextSelected]}>{sport}</Text>
                {sel && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* More Sports Collapsible */}
        <TouchableOpacity style={sportStyles.moreSportsHeader} onPress={toggleMoreSports} activeOpacity={0.7}>
          <Text style={sportStyles.moreSportsTitle}>More Sports</Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={16} color="#9B9B9B" />
          </Animated.View>
        </TouchableOpacity>

        {moreSportsExpanded && (
          <View style={sportStyles.moreSportsContent}>
            {MORE_SPORTS_DATA.map((cat) => (
              <View key={cat.category}>
                <View style={bsStyles.categoryHeader}><Text style={bsStyles.categoryText}>{cat.category}</Text></View>
                {cat.sports.map((sport, i) => {
                  const sel = (!isSportOther && selectedSport === sport) || (isSportOther && sport === 'Other');
                  return (
                    <TouchableOpacity key={`${sport}-${i}`} style={bsStyles.listRow} onPress={() => handleSelectSport(sport)} activeOpacity={0.6}>
                      <Text style={bsStyles.listRowText}>{sport}</Text>
                      {sel && <Ionicons name="checkmark" size={18} color="#2DC672" />}
                    </TouchableOpacity>
                  );
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

        {/* Field 1 - Sportsbook */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Where did you place this bet?</Text>
          {isPlatformOther ? (
            <View style={styles.customInputContainer}>
              <TextInput style={styles.customInput} placeholder="Type platform name..." placeholderTextColor="#9B9B9B" value={customPlatform} onChangeText={setCustomPlatform} autoFocus />
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
                  {type === 'ou' ? 'O/U' : type === 'moneyline' ? 'Moneyline' : type === 'spread' ? 'Spread' : type === 'parlay' ? 'Parlay' : type === 'prop' ? 'Prop' : 'Other'}
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
              <TextInput style={styles.customInput} placeholder="Type sport name..." placeholderTextColor="#9B9B9B" value={customSport} onChangeText={setCustomSport} autoFocus />
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
          <TextInput style={styles.textInput} placeholder="e.g., Lakers vs Warriors" placeholderTextColor="#9B9B9B" />
        </View>

        {/* Field 5 - Description */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Describe your bet</Text>
          <TextInput style={[styles.textInput, styles.textareaInput]} placeholder="e.g., Lakers -5.5, Over 225.5" placeholderTextColor="#9B9B9B" multiline numberOfLines={3} textAlignVertical="top" />
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
          <TextInput style={styles.textInput} placeholder={getOddsPlaceholder()} placeholderTextColor="#9B9B9B" />
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
            <TextInput style={styles.currencyInput} placeholder="0.00" placeholderTextColor="#9B9B9B" editable={false} value={payout} />
          </View>
        </View>

        {/* Field 9 - Status */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusContainer}>
            {(['pending', 'won', 'lost', 'void'] as BetStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusPill, status === s && (s === 'pending' ? styles.statusPillPending : styles.statusPillActive)]}
                onPress={() => setStatus(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusPillText, status === s && (s === 'pending' ? styles.statusPillTextPending : styles.statusPillTextActive)]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Field 10 - Date */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>When was this bet placed?</Text>
          <TouchableOpacity style={styles.dropdownInput} activeOpacity={0.7}>
            <View style={styles.dateInputPlaceholder} />
          </TouchableOpacity>
        </View>

        {/* Field 11 - Notes */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Notes (Optional)</Text>
          <TextInput style={[styles.textInput, styles.textareaInputLarge]} placeholder="Why did you make this bet?" placeholderTextColor="#9B9B9B" multiline numberOfLines={4} textAlignVertical="top" />
        </View>

        {/* Field 12 - Upload Screenshot */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Upload Ticket Screenshot (Optional)</Text>
          <TouchableOpacity style={styles.uploadArea} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={28} color="#9B9B9B" />
            <Text style={styles.uploadTitle}>Choose Photo or Take Photo</Text>
            <Text style={styles.uploadHint}>PNG, JPG up to 10MB</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.takePhotoButton} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={18} color="#4A4A4A" style={styles.takePhotoIcon} />
            <Text style={styles.takePhotoText}>Take Photo</Text>
          </TouchableOpacity>
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
        <TouchableOpacity style={styles.submitButton} onPress={handleSaveBet} activeOpacity={0.8}>
          <Text style={styles.submitButtonText}>Save Bet</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Platform Bottom Sheet ── */}
      <Modal visible={platformSheet.visible} transparent animationType="none" onRequestClose={platformSheet.closeSheet}>
        <View style={bsStyles.modalContainer}>
          <TouchableWithoutFeedback onPress={platformSheet.closeSheet}>
            <Animated.View style={[bsStyles.overlay, { opacity: platformSheet.overlayAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[bsStyles.sheet, { transform: [{ translateY: platformSheet.slideAnim }] }]}>
            <View style={bsStyles.handleArea} {...platformSheet.panResponder.panHandlers}>
              <View style={bsStyles.handle} />
            </View>
            <View style={bsStyles.searchContainer}>
              <Ionicons name="search" size={18} color="#9B9B9B" style={bsStyles.searchIcon} />
              <TextInput style={bsStyles.searchInput} placeholder="Search platforms..." placeholderTextColor="#9B9B9B" value={platformSearch} onChangeText={setPlatformSearch} autoCorrect={false} autoCapitalize="none" />
              {platformSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPlatformSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#C0C0C0" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredPlatformItems}
              renderItem={renderPlatformItem}
              keyExtractor={(item, i) => item.type === 'category' ? `pcat-${item.category}` : `pplat-${(item as any).name}-${i}`}
              contentContainerStyle={bsStyles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<View style={bsStyles.emptyContainer}><Text style={bsStyles.emptyText}>No platforms found</Text></View>}
            />
          </Animated.View>
        </View>
      </Modal>

      {/* ── Sport Bottom Sheet ── */}
      <Modal visible={sportSheet.visible} transparent animationType="none" onRequestClose={sportSheet.closeSheet}>
        <View style={bsStyles.modalContainer}>
          <TouchableWithoutFeedback onPress={sportSheet.closeSheet}>
            <Animated.View style={[bsStyles.overlay, { opacity: sportSheet.overlayAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[bsStyles.sheet, { transform: [{ translateY: sportSheet.slideAnim }] }]}>
            <View style={bsStyles.handleArea} {...sportSheet.panResponder.panHandlers}>
              <View style={bsStyles.handle} />
            </View>
            <View style={bsStyles.searchContainer}>
              <Ionicons name="search" size={18} color="#9B9B9B" style={bsStyles.searchIcon} />
              <TextInput style={bsStyles.searchInput} placeholder="Search sports..." placeholderTextColor="#9B9B9B" value={sportSearch} onChangeText={setSportSearch} autoCorrect={false} autoCapitalize="none" />
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
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: '45%' as any,
    flexGrow: 1,
    flexBasis: '45%' as any,
  },
  chipSelected: {
    backgroundColor: '#10B981',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  moreSportsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  moreSportsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  moreSportsContent: {
    paddingBottom: 20,
  },
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
  readOnlyInput: { backgroundColor: '#F5F5F5' },
  currencySymbol: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginRight: 8 },
  currencyInput: { flex: 1, fontSize: 14, fontWeight: '400', color: '#1A1A1A' },
  statusContainer: { flexDirection: 'row', gap: 10 },
  statusPill: { backgroundColor: '#F0F0F0', borderRadius: 9, paddingHorizontal: 16, paddingVertical: 10, height: 38, justifyContent: 'center' },
  statusPillPending: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#10B981' },
  statusPillActive: { backgroundColor: '#F0F0F0' },
  statusPillText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  statusPillTextPending: { color: '#10B981' },
  statusPillTextActive: { color: '#1A1A1A' },
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
