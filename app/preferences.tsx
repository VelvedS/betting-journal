import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type OddsFormat = 'american' | 'decimal' | 'fractional';

export default function PreferencesScreen() {
  const router = useRouter();

  // Privacy & Security toggles
  const [biometricLogin, setBiometricLogin] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [cloudSync, setCloudSync] = useState(true);

  // App Behavior toggles
  const [autoSaveNotes, setAutoSaveNotes] = useState(true);
  const [analyticsSharing, setAnalyticsSharing] = useState(false);

  // Odds Format selection
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('american');

  const getOddsExample = () => {
    switch (oddsFormat) {
      case 'american':
        return 'Example: +150, -200';
      case 'decimal':
        return 'Example: 2.50, 1.50';
      case 'fractional':
        return 'Example: 3/2, 1/2';
      default:
        return 'Example: +150, -200';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Preferences</Text>
            <Text style={styles.headerSubtitle}>Customize your app experience</Text>
          </View>
        </View>

        {/* Card 1 - Regional Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Regional Settings</Text>

          {/* Currency Field */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>$</Text>
            </View>
          </View>

          {/* Language Field */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Language</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="globe-outline" size={20} color="#1A1A1A" style={styles.iconLeft} />
            </View>
          </View>

          {/* Odds Format */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Odds Format</Text>
            <View style={styles.oddsFormatContainer}>
              <TouchableOpacity
                style={[styles.oddsPill, oddsFormat === 'american' && styles.oddsPillActive]}
                onPress={() => setOddsFormat('american')}
                activeOpacity={0.7}
              >
                <Text style={[styles.oddsPillText, oddsFormat === 'american' && styles.oddsPillTextActive]}>
                  American
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.oddsPill, oddsFormat === 'decimal' && styles.oddsPillActive]}
                onPress={() => setOddsFormat('decimal')}
                activeOpacity={0.7}
              >
                <Text style={[styles.oddsPillText, oddsFormat === 'decimal' && styles.oddsPillTextActive]}>
                  Decimal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.oddsPill, oddsFormat === 'fractional' && styles.oddsPillActive]}
                onPress={() => setOddsFormat('fractional')}
                activeOpacity={0.7}
              >
                <Text style={[styles.oddsPillText, oddsFormat === 'fractional' && styles.oddsPillTextActive]}>
                  Fractional
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.oddsExample}>{getOddsExample()}</Text>
          </View>
        </View>

        {/* Card 2 - Privacy & Security */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={20} color="#1A1A1A" style={styles.cardHeaderIcon} />
            <Text style={styles.cardTitle}>Privacy & Security</Text>
          </View>

          <SettingRowWithIcon
            icon="finger-print-outline"
            title="Biometric Login"
            description="Use Face ID or fingerprint"
            isOn={biometricLogin}
            onToggle={() => setBiometricLogin(!biometricLogin)}
          />
          <SettingRowWithIcon
            icon="eye-outline"
            title="Show Balance"
            description="Display balance on dashboard"
            isOn={showBalance}
            onToggle={() => setShowBalance(!showBalance)}
          />
          <SettingRowWithIcon
            icon="cloud-outline"
            title="Cloud Sync"
            description="Backup data to cloud"
            isOn={cloudSync}
            onToggle={() => setCloudSync(!cloudSync)}
            isLast
          />
        </View>

        {/* Card 3 - App Behavior */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Behavior</Text>

          <SettingRowSimple
            title="Auto-Save Notes"
            description="Automatically save bet notes"
            isOn={autoSaveNotes}
            onToggle={() => setAutoSaveNotes(!autoSaveNotes)}
          />
          <SettingRowSimple
            title="Analytics Sharing"
            description="Help improve the app"
            isOn={analyticsSharing}
            onToggle={() => setAnalyticsSharing(!analyticsSharing)}
            isLast
          />
        </View>

        {/* Card 4 - Data Management */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Management</Text>

          {/* Export Data Row */}
          <View style={styles.dataRow}>
            <View style={styles.dataIconCircle}>
              <Ionicons name="document-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.dataTextContainer}>
              <Text style={styles.dataTitle}>Export Data</Text>
              <Text style={styles.dataDescription}>Download all your data</Text>
            </View>
            <Text style={styles.csvLabel}>CSV</Text>
          </View>

          {/* Clear All Data Row (Danger) */}
          <TouchableOpacity style={styles.dangerRow} activeOpacity={0.7}>
            <View style={styles.dangerIconCircle}>
              <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.dataTextContainer}>
              <Text style={styles.dangerTitle}>Clear All Data</Text>
              <Text style={styles.dataDescription}>Delete all bets and history</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Setting Row with Icon Component
function SettingRowWithIcon({
  icon,
  title,
  description,
  isOn,
  onToggle,
  isLast = false,
}: {
  icon: any;
  title: string;
  description: string;
  isOn: boolean;
  onToggle: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowMargin]}>
      <View style={styles.settingIconCircle}>
        <Ionicons name={icon} size={22} color="#4A4A4A" />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <View style={[styles.toggleSwitch, isOn && styles.toggleSwitchOn]}>
          <View style={[styles.toggleThumb, isOn && styles.toggleThumbOn]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Simple Setting Row Component (no icon)
function SettingRowSimple({
  title,
  description,
  isOn,
  onToggle,
  isLast = false,
}: {
  title: string;
  description: string;
  isOn: boolean;
  onToggle: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.simpleSettingRow, !isLast && styles.settingRowMargin]}>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <View style={[styles.toggleSwitch, isOn && styles.toggleSwitchOn]}>
          <View style={[styles.toggleThumb, isOn && styles.toggleThumbOn]} />
        </View>
      </TouchableOpacity>
    </View>
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

  // Navigation Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  // Card Container
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 20,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderIcon: {
    marginRight: 8,
  },

  // Form Fields (Regional Settings)
  formField: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  iconLeft: {
    marginRight: 0,
  },

  // Odds Format Pills
  oddsFormatContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  oddsPill: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  oddsPillActive: {
    backgroundColor: '#10B981',
  },
  oddsPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  oddsPillTextActive: {
    color: '#FFFFFF',
  },
  oddsExample: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9B9B9B',
    marginTop: 2,
  },

  // Setting Rows with Icons
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingRowMargin: {
    marginBottom: 22,
  },
  settingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  // Simple Setting Rows (no icons)
  simpleSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Toggle Switch
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#10B981',
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: {
    // Position handled by parent flexDirection
  },

  // Data Management Rows
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dataIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dataTextContainer: {
    flex: 1,
  },
  dataTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  dataDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  csvLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A4A4A',
  },

  // Danger Row (Clear All Data)
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 14,
  },
  dangerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E85D5D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E85D5D',
    marginBottom: 3,
  },
});
