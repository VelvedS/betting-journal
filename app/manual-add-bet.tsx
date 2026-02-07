import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

type BetType = 'moneyline' | 'spread' | 'ou' | 'parlay' | 'prop' | 'other';
type OddsFormat = 'american' | 'decimal' | 'fractional';
type BetStatus = 'pending' | 'won' | 'lost' | 'void';

interface PlatformCategory {
  category: string;
  platforms: string[];
}

const PLATFORM_DATA: PlatformCategory[] = [
  {
    category: 'Classic DFS Platforms',
    platforms: ['DraftKings', 'FanDuel', 'Yahoo Fantasy / DFS', 'OwnersBox'],
  },
  {
    category: "Pick'em / Player Prop DFS",
    platforms: [
      'PrizePicks',
      'Underdog Fantasy',
      'Sleeper Picks',
      'DraftKings Pick6',
      'FanDuel Fantasy',
      'Betr Picks',
      'Boom Fantasy',
      'ParlayPlay',
      'Dabble',
      'Bleacher Nation Fantasy',
      'Playsqor',
      'Thrillzz',
      'Rebet',
    ],
  },
  {
    category: 'Season-Long Fantasy',
    platforms: ['ESPN Fantasy', 'Yahoo Fantasy', 'Sleeper', 'NFL Fantasy', 'CBS Sports Fantasy'],
  },
  {
    category: 'Other',
    platforms: ['Other'],
  },
];

type ListItem =
  | { type: 'category'; category: string }
  | { type: 'platform'; name: string };

function buildListItems(data: PlatformCategory[]): ListItem[] {
  const items: ListItem[] = [];
  for (const group of data) {
    items.push({ type: 'category', category: group.category });
    for (const p of group.platforms) {
      items.push({ type: 'platform', name: p });
    }
  }
  return items;
}

function filterPlatforms(data: PlatformCategory[], query: string): ListItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return buildListItems(data);

  const items: ListItem[] = [];
  for (const group of data) {
    const matched = group.platforms.filter((p) =>
      p.toLowerCase().includes(q)
    );
    if (matched.length > 0) {
      items.push({ type: 'category', category: group.category });
      for (const p of matched) {
        items.push({ type: 'platform', name: p });
      }
    }
  }
  return items;
}

export default function ManualAddBetScreen() {
  const router = useRouter();

  // Form state
  const [betType, setBetType] = useState<BetType>('moneyline');
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('american');
  const [status, setStatus] = useState<BetStatus>('pending');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wager, setWager] = useState('');
  const [payout, setPayout] = useState('');

  // Sportsbook state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isOtherMode, setIsOtherMode] = useState(false);
  const [customPlatform, setCustomPlatform] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Animation
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  const openSheet = () => {
    setSearchQuery('');
    setSheetVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetVisible(false);
      setSearchQuery('');
    });
  };

  const handleSelectPlatform = (name: string) => {
    if (name === 'Other') {
      setSelectedPlatform(null);
      setIsOtherMode(true);
      setCustomPlatform('');
    } else {
      setSelectedPlatform(name);
      setIsOtherMode(false);
      setCustomPlatform('');
    }
    closeSheet();
  };

  const handleClearCustom = () => {
    setIsOtherMode(false);
    setCustomPlatform('');
    setSelectedPlatform(null);
  };

  const filteredItems = filterPlatforms(PLATFORM_DATA, searchQuery);

  const getOddsPlaceholder = () => {
    switch (oddsFormat) {
      case 'american':
        return '+150 or -110';
      case 'decimal':
        return '2.50';
      case 'fractional':
        return '3/2';
      default:
        return '+150 or -110';
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSaveBet = () => {
    router.back();
  };

  const displayPlatformValue = isOtherMode
    ? customPlatform
    : selectedPlatform || '';

  const renderSheetItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'category') {
      return (
        <View style={sheetStyles.categoryHeader}>
          <Text style={sheetStyles.categoryText}>{item.category}</Text>
        </View>
      );
    }

    const isSelected = !isOtherMode && selectedPlatform === item.name;
    const isOtherSelected = isOtherMode && item.name === 'Other';

    return (
      <TouchableOpacity
        style={sheetStyles.platformRow}
        onPress={() => handleSelectPlatform(item.name)}
        activeOpacity={0.6}
      >
        <Text style={sheetStyles.platformName}>{item.name}</Text>
        {(isSelected || isOtherSelected) && (
          <Ionicons name="checkmark" size={18} color="#2DC672" />
        )}
      </TouchableOpacity>
    );
  };

  const getItemKey = (item: ListItem, index: number) => {
    if (item.type === 'category') return `cat-${item.category}`;
    return `plat-${item.name}-${index}`;
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
          {isOtherMode ? (
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="Type platform name..."
                placeholderTextColor="#9B9B9B"
                value={customPlatform}
                onChangeText={setCustomPlatform}
                autoFocus
              />
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearCustom}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color="#9B9B9B" />
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.dropdownInput} onPress={openSheet} activeOpacity={0.7}>
              <Text
                style={[
                  styles.dropdownValueText,
                  !selectedPlatform && styles.dropdownPlaceholderText,
                ]}
              >
                {selectedPlatform || 'Select a platform...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#9B9B9B" style={styles.dropdownIcon} />
            </TouchableOpacity>
          )}
        </View>

        {/* Field 2 - Bet Type */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>What type of bet?</Text>
          <View style={styles.pillsContainer}>
            {(['moneyline', 'spread', 'ou', 'parlay', 'prop', 'other'] as BetType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pill, betType === type && styles.pillActive]}
                onPress={() => setBetType(type)}
                activeOpacity={0.7}
              >
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
          <TouchableOpacity style={styles.dropdownInput} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={18} color="#9B9B9B" style={styles.dropdownIcon} />
          </TouchableOpacity>
        </View>

        {/* Field 4 - Matchup */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Who's playing? (Matchup/Event)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Lakers vs Warriors"
            placeholderTextColor="#9B9B9B"
          />
        </View>

        {/* Field 5 - Description */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Describe your bet</Text>
          <TextInput
            style={[styles.textInput, styles.textareaInput]}
            placeholder="e.g., Lakers -5.5, Over 225.5"
            placeholderTextColor="#9B9B9B"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Field 6 - Odds */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Odds</Text>
          <View style={styles.oddsFormatContainer}>
            {(['american', 'decimal', 'fractional'] as OddsFormat[]).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                style={[styles.oddsFormatPill, oddsFormat === fmt && styles.oddsFormatPillActive]}
                onPress={() => setOddsFormat(fmt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.oddsFormatText, oddsFormat === fmt && styles.oddsFormatTextActive]}>
                  {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.textInput}
            placeholder={getOddsPlaceholder()}
            placeholderTextColor="#9B9B9B"
          />
        </View>

        {/* Field 7 - Wager */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>How much did you wager?</Text>
          <View style={styles.currencyInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.currencyInput}
              placeholder="0.00"
              placeholderTextColor="#9B9B9B"
              keyboardType="decimal-pad"
              value={wager}
              onChangeText={setWager}
            />
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
            <TextInput
              style={styles.currencyInput}
              placeholder="0.00"
              placeholderTextColor="#9B9B9B"
              editable={false}
              value={payout}
            />
          </View>
        </View>

        {/* Field 9 - Status */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusContainer}>
            <TouchableOpacity
              style={[styles.statusPill, status === 'pending' && styles.statusPillPending]}
              onPress={() => setStatus('pending')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusPillText, status === 'pending' && styles.statusPillTextPending]}>
                Pending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusPill, status === 'won' && styles.statusPillActive]}
              onPress={() => setStatus('won')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusPillText, status === 'won' && styles.statusPillTextActive]}>
                Won
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusPill, status === 'lost' && styles.statusPillActive]}
              onPress={() => setStatus('lost')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusPillText, status === 'lost' && styles.statusPillTextActive]}>
                Lost
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusPill, status === 'void' && styles.statusPillActive]}
              onPress={() => setStatus('void')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusPillText, status === 'void' && styles.statusPillTextActive]}>
                Void
              </Text>
            </TouchableOpacity>
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
          <TextInput
            style={[styles.textInput, styles.textareaInputLarge]}
            placeholder="Why did you make this bet?"
            placeholderTextColor="#9B9B9B"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
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
              <TouchableOpacity
                key={tag}
                style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSaveBet} activeOpacity={0.8}>
          <Text style={styles.submitButtonText}>Save Bet</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Sheet Modal */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={sheetStyles.modalContainer}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <Animated.View style={[sheetStyles.overlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              sheetStyles.sheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Drag Handle */}
            <View style={sheetStyles.handleArea} {...panResponder.panHandlers}>
              <View style={sheetStyles.handle} />
            </View>

            {/* Search Bar */}
            <View style={sheetStyles.searchContainer}>
              <Ionicons name="search" size={18} color="#9B9B9B" style={sheetStyles.searchIcon} />
              <TextInput
                style={sheetStyles.searchInput}
                placeholder="Search platforms..."
                placeholderTextColor="#9B9B9B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#C0C0C0" />
                </TouchableOpacity>
              )}
            </View>

            {/* Platform List */}
            <FlatList
              data={filteredItems}
              renderItem={renderSheetItem}
              keyExtractor={getItemKey}
              contentContainerStyle={sheetStyles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={sheetStyles.emptyContainer}>
                  <Text style={sheetStyles.emptyText}>No platforms found</Text>
                </View>
              }
            />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const sheetStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000066',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleArea: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    height: 44,
  },
  listContent: {
    paddingBottom: 40,
  },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingLeft: 16,
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginHorizontal: 0,
  },
  platformName: {
    fontSize: 15,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
  },
  emptyContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#9B9B9B',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Back Button
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  // Form Field
  formField: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelHint: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9B9B9B',
    marginLeft: 6,
  },

  // Text Inputs
  textInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    height: 50,
  },
  textareaInput: {
    height: 90,
    paddingTop: 14,
  },
  textareaInputLarge: {
    height: 110,
    paddingTop: 14,
  },

  // Dropdown Input
  dropdownInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    height: 50,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownValueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  dropdownPlaceholderText: {
    color: '#9B9B9B',
  },
  dropdownIcon: {
    marginLeft: 8,
  },
  dateInputPlaceholder: {
    flex: 1,
  },

  // Custom platform input (Other mode)
  customInputContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    height: 50,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9B9B9B',
  },

  // Pills (Bet Type)
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
    height: 38,
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },

  // Odds Format Pills
  oddsFormatContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  oddsFormatPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 32,
    justifyContent: 'center',
  },
  oddsFormatPillActive: {
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
  },
  oddsFormatText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  oddsFormatTextActive: {
    color: '#FFFFFF',
  },

  // Currency Input
  currencyInputContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 8,
  },
  currencyInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },

  // Status Pills
  statusContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  statusPill: {
    backgroundColor: '#F0F0F0',
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 38,
    justifyContent: 'center',
  },
  statusPillPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusPillActive: {
    backgroundColor: '#F0F0F0',
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  statusPillTextPending: {
    color: '#10B981',
  },
  statusPillTextActive: {
    color: '#1A1A1A',
  },

  // Upload Area
  uploadArea: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    height: 130,
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 10,
  },
  uploadHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9B9B9B',
    marginTop: 4,
  },
  takePhotoButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  takePhotoIcon: {
    marginRight: 8,
  },
  takePhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 34,
    justifyContent: 'center',
  },
  tagSelected: {
    backgroundColor: '#E0E0E0',
    borderWidth: 1,
    borderColor: '#9B9B9B',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  tagTextSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },

  // Submit Button
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    marginTop: 10,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
