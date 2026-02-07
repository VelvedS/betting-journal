import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type BetType = 'moneyline' | 'spread' | 'ou' | 'parlay' | 'prop' | 'other';
type OddsFormat = 'american' | 'decimal' | 'fractional';
type BetStatus = 'pending' | 'won' | 'lost' | 'void';

export default function ManualAddBetScreen() {
  const router = useRouter();

  // Form state
  const [betType, setBetType] = useState<BetType>('moneyline');
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('american');
  const [status, setStatus] = useState<BetStatus>('pending');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wager, setWager] = useState('');
  const [payout, setPayout] = useState('');

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
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSaveBet = () => {
    // For now, just navigate back
    router.back();
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
          <TouchableOpacity style={styles.dropdownInput} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={18} color="#9B9B9B" style={styles.dropdownIcon} />
          </TouchableOpacity>
        </View>

        {/* Field 2 - Bet Type */}
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>What type of bet?</Text>
          <View style={styles.pillsContainer}>
            <TouchableOpacity
              style={[styles.pill, betType === 'moneyline' && styles.pillActive]}
              onPress={() => setBetType('moneyline')}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, betType === 'moneyline' && styles.pillTextActive]}>
                Moneyline
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, betType === 'spread' && styles.pillActive]}
              onPress={() => setBetType('spread')}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, betType === 'spread' && styles.pillTextActive]}>
                Spread
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, betType === 'ou' && styles.pillActive]}
              onPress={() => setBetType('ou')}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, betType === 'ou' && styles.pillTextActive]}>
                O/U
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, betType === 'parlay' && styles.pillActive]}
              onPress={() => setBetType('parlay')}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, betType === 'parlay' && styles.pillTextActive]}>
                Parlay
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, betType === 'prop' && styles.pillActive]}
              onPress={() => setBetType('prop')}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, betType === 'prop' && styles.pillTextActive]}>
                Prop
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, betType === 'other' && styles.pillActive]}
              onPress={() => setBetType('other')}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, betType === 'other' && styles.pillTextActive]}>
                Other
              </Text>
            </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.oddsFormatPill, oddsFormat === 'american' && styles.oddsFormatPillActive]}
              onPress={() => setOddsFormat('american')}
              activeOpacity={0.7}
            >
              <Text style={[styles.oddsFormatText, oddsFormat === 'american' && styles.oddsFormatTextActive]}>
                American
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.oddsFormatPill, oddsFormat === 'decimal' && styles.oddsFormatPillActive]}
              onPress={() => setOddsFormat('decimal')}
              activeOpacity={0.7}
            >
              <Text style={[styles.oddsFormatText, oddsFormat === 'decimal' && styles.oddsFormatTextActive]}>
                Decimal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.oddsFormatPill, oddsFormat === 'fractional' && styles.oddsFormatPillActive]}
              onPress={() => setOddsFormat('fractional')}
              activeOpacity={0.7}
            >
              <Text style={[styles.oddsFormatText, oddsFormat === 'fractional' && styles.oddsFormatTextActive]}>
                Fractional
              </Text>
            </TouchableOpacity>
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
    </SafeAreaView>
  );
}

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
  },
  dropdownIcon: {
    position: 'absolute',
    right: 16,
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
