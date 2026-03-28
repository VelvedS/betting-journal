/*
 * ─────────────────────────────────────────────────────────────────────────────
 * SQL MIGRATION — run in the Supabase SQL editor before testing:
 *
 *   ALTER TABLE public.profiles
 *   ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
 *     "oddsFormat": "american",
 *     "currency": "USD",
 *     "language": "en",
 *     "biometricLogin": false,
 *     "showBalance": true,
 *     "cloudSync": true,
 *     "autoSaveNotes": true,
 *     "analyticsSharing": false
 *   }'::jsonb;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';

// ── Types ──

type OddsFormat = 'american' | 'decimal' | 'fractional';

type Preferences = {
  oddsFormat: OddsFormat;
  currency: string;
  language: string;
  biometricLogin: boolean;
  showBalance: boolean;
  cloudSync: boolean;
  autoSaveNotes: boolean;
  analyticsSharing: boolean;
};

type ToastState = { message: string; type: 'success' | 'error' } | null;

// ── Constants ──

const DEFAULT_PREFERENCES: Preferences = {
  oddsFormat: 'american',
  currency: 'USD',
  language: 'en',
  biometricLogin: false,
  showBalance: true,
  cloudSync: true,
  autoSaveNotes: true,
  analyticsSharing: false,
};

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
];

// ── Component ──

export default function PreferencesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { refresh: refreshPreferences } = usePreferences();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Toast ──

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message, type });
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
          () => setToast(null)
        );
      }, 3000);
    },
    [toastOpacity]
  );

  // ── Load Preferences ──

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (data?.preferences) {
        setPrefs({ ...DEFAULT_PREFERENCES, ...data.preferences });
      }
    } catch {
      // No row yet — use defaults
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchPreferences(); }, [fetchPreferences]));

  // ── Save Preferences ──

  const savePreferences = useCallback(
    async (updated: Preferences) => {
      if (!user) return;
      try {
        const { error } = await supabase.from('profiles').upsert({
          id: user.id,
          preferences: updated,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        refreshPreferences();
        showToast('Saved');
      } catch {
        showToast('Failed to save', 'error');
      }
    },
    [user, showToast]
  );

  const updatePref = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      if (Platform.OS !== 'web') try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);
      savePreferences(updated);
    },
    [prefs, savePreferences]
  );

  // ── Odds Format ──

  const getOddsExample = (format: OddsFormat) => {
    switch (format) {
      case 'american': return 'Example: +150, -200';
      case 'decimal':  return 'Example: 2.50, 1.50';
      case 'fractional': return 'Example: 3/2, 1/2';
    }
  };

  // ── Currency Selector ──

  const handleCurrencyPress = useCallback(() => {
    const labels = CURRENCY_OPTIONS.map(c => c.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, title: 'Select Currency' },
        idx => {
          if (idx < labels.length) updatePref('currency', CURRENCY_OPTIONS[idx].value);
        }
      );
    } else {
      Alert.alert(
        'Select Currency',
        undefined,
        [
          ...CURRENCY_OPTIONS.map(c => ({
            text: c.label,
            onPress: () => updatePref('currency', c.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  }, [updatePref]);

  const currentCurrencyLabel = useMemo(
    () => CURRENCY_OPTIONS.find(c => c.value === prefs.currency)?.label ?? 'USD ($)',
    [prefs.currency]
  );

  // ── Language Selector ──

  const handleLanguagePress = useCallback(() => {
    const labels = LANGUAGE_OPTIONS.map(l => l.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, title: 'Select Language' },
        idx => {
          if (idx < labels.length) {
            const selected = LANGUAGE_OPTIONS[idx];
            updatePref('language', selected.value);
            if (selected.value !== 'en') {
              showToast('Coming Soon — preference saved');
            }
          }
        }
      );
    } else {
      Alert.alert(
        'Select Language',
        undefined,
        [
          ...LANGUAGE_OPTIONS.map(l => ({
            text: l.label,
            onPress: () => {
              updatePref('language', l.value);
              if (l.value !== 'en') showToast('Coming Soon — preference saved');
            },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  }, [updatePref, showToast]);

  const currentLanguageLabel = useMemo(
    () => LANGUAGE_OPTIONS.find(l => l.value === prefs.language)?.label ?? 'English',
    [prefs.language]
  );

  // ── Biometric Login ──

  const handleBiometricToggle = useCallback(async () => {
    const next = !prefs.biometricLogin;
    if (next) {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) {
        showToast('Biometrics not available on this device', 'error');
        return;
      }
    }
    updatePref('biometricLogin', next);
  }, [prefs.biometricLogin, updatePref, showToast]);

  // ── Export Data ──

  const handleExportData = useCallback(async () => {
    if (!user || exportLoading) return;
    setExportLoading(true);
    try {
      const { data: bets, error: betsError } = await supabase
        .from('bets')
        .select('id, placed_at, sportsbook, bet_type, sport, matchup, description, odds, wager, potential_payout, status')
        .eq('user_id', user.id)
        .order('placed_at', { ascending: false });

      if (betsError) throw betsError;

      const betIds = (bets ?? []).map(b => b.id);
      let legsByBetId: Record<string, { description: string; odds: number | null; status: string }[]> = {};

      if (betIds.length > 0) {
        const { data: legs } = await supabase
          .from('parlay_legs')
          .select('bet_id, description, odds, status')
          .in('bet_id', betIds);

        for (const leg of legs ?? []) {
          if (!legsByBetId[leg.bet_id]) legsByBetId[leg.bet_id] = [];
          legsByBetId[leg.bet_id].push(leg);
        }
      }

      const header = 'date,sportsbook,bet_type,sport,matchup,description,odds,wager,potential_payout,status';

      const escape = (v: string | number | null | undefined) => {
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const rows = (bets ?? []).map(b => {
        const legs = legsByBetId[b.id];
        const desc = legs?.length
          ? legs.map(l => l.description).join(' | ')
          : b.description ?? '';
        const date = b.placed_at ? new Date(b.placed_at).toLocaleDateString('en-US') : '';
        return [
          escape(date),
          escape(b.sportsbook),
          escape(b.bet_type),
          escape(b.sport),
          escape(b.matchup),
          escape(desc),
          escape(b.odds),
          escape(b.wager),
          escape(b.potential_payout),
          escape(b.status),
        ].join(',');
      });

      const csv = [header, ...rows].join('\n');
      const exportFile = new FileSystem.File(FileSystem.Paths.cache, `bets-export-${Date.now()}.csv`);
      exportFile.write(csv);
      const fileUri = exportFile.uri;

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Bets' });
      } else {
        showToast('Sharing not available on this device', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to export data', 'error');
    } finally {
      setExportLoading(false);
    }
  }, [user, exportLoading, showToast]);

  // ── Clear All Data ──

  const handleClearAllData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your bets and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              const { data: bets } = await supabase
                .from('bets')
                .select('id')
                .eq('user_id', user.id);

              const betIds = (bets ?? []).map(b => b.id);
              if (betIds.length > 0) {
                await Promise.all([
                  supabase.from('parlay_legs').delete().in('bet_id', betIds),
                  supabase.from('bet_tags').delete().in('bet_id', betIds),
                ]);
              }

              await supabase.from('achievements').delete().eq('user_id', user.id);
              await supabase.from('bets').delete().eq('user_id', user.id);

              showToast('All data cleared');
            } catch (err: any) {
              showToast(err.message || 'Failed to clear data', 'error');
            }
          },
        },
      ]
    );
  }, [user, showToast]);

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar as any} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar as any} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <AnimatedPressable style={styles.backButton} onPress={() => router.back()} scaleDown={0.9}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </AnimatedPressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Preferences</Text>
              <Text style={styles.headerSubtitle}>Customize your app experience</Text>
            </View>
          </View>
        </FadeInView>

        {/* Card 1 — Regional Settings */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Regional Settings</Text>

            {/* Currency */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <AnimatedPressable style={styles.selectorRow} onPress={handleCurrencyPress} scaleDown={0.97}>
                <Ionicons name="cash-outline" size={20} color={colors.iconSecondary} style={styles.selectorIcon} />
                <Text style={styles.selectorText}>{currentCurrencyLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </AnimatedPressable>
            </View>

            {/* Language */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Language</Text>
              <AnimatedPressable style={styles.selectorRow} onPress={handleLanguagePress} scaleDown={0.97}>
                <Ionicons name="globe-outline" size={20} color={colors.iconSecondary} style={styles.selectorIcon} />
                <Text style={styles.selectorText}>{currentLanguageLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </AnimatedPressable>
            </View>

            {/* Odds Format */}
            <View style={[styles.formField, styles.formFieldLast]}>
              <Text style={styles.fieldLabel}>Odds Format</Text>
              <View style={styles.oddsFormatContainer}>
                {(['american', 'decimal', 'fractional'] as OddsFormat[]).map(fmt => (
                  <AnimatedPressable
                    key={fmt}
                    style={[styles.oddsPill, prefs.oddsFormat === fmt && styles.oddsPillActive]}
                    onPress={() => updatePref('oddsFormat', fmt)}
                    scaleDown={0.97}
                  >
                    <Text style={[styles.oddsPillText, prefs.oddsFormat === fmt && styles.oddsPillTextActive]}>
                      {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
              <Text style={styles.oddsExample}>{getOddsExample(prefs.oddsFormat)}</Text>
            </View>
          </View>
        </FadeInView>

        {/* Card 2 — Privacy & Security */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={styles.cardHeaderIcon} />
              <Text style={styles.cardTitle}>Privacy & Security</Text>
            </View>

            <ToggleRow
              colors={colors}
              styles={styles}
              icon="finger-print-outline"
              title="Biometric Login"
              description="Use Face ID or fingerprint"
              isOn={prefs.biometricLogin}
              onToggle={handleBiometricToggle}
            />
            {/* showBalance: when true, profit/loss numbers are visible on the home screen.
                Future wiring: pass this value to the dashboard to mask/unmask balance totals. */}
            <ToggleRow
              colors={colors}
              styles={styles}
              icon="eye-outline"
              title="Show Balance"
              description="Display balance on dashboard"
              isOn={prefs.showBalance}
              onToggle={() => updatePref('showBalance', !prefs.showBalance)}
            />
            <ToggleRow
              colors={colors}
              styles={styles}
              icon="cloud-outline"
              title="Cloud Sync"
              description="Backup data to cloud"
              isOn={prefs.cloudSync}
              onToggle={() => {
                updatePref('cloudSync', !prefs.cloudSync);
                showToast('Coming Soon — preference saved');
              }}
              isLast
            />
          </View>
        </FadeInView>

        {/* Card 3 — App Behavior */}
        <FadeInView delay={240} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>App Behavior</Text>

            <ToggleRowSimple
              styles={styles}
              title="Auto-Save Notes"
              description="Automatically save bet notes"
              isOn={prefs.autoSaveNotes}
              onToggle={() => updatePref('autoSaveNotes', !prefs.autoSaveNotes)}
            />
            <ToggleRowSimple
              styles={styles}
              title="Analytics Sharing"
              description="Help improve the app"
              isOn={prefs.analyticsSharing}
              onToggle={() => {
                updatePref('analyticsSharing', !prefs.analyticsSharing);
                if (!prefs.analyticsSharing) showToast('Helps us improve Ledgr');
              }}
              isLast
            />
          </View>
        </FadeInView>

        {/* Card 4 — Data Management */}
        <FadeInView delay={320} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Data Management</Text>

            {/* Export Data */}
            <AnimatedPressable style={styles.dataRow} onPress={handleExportData} scaleDown={0.97}>
              <View style={styles.dataIconCircle}>
                {exportLoading
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="document-outline" size={22} color="#FFFFFF" />
                }
              </View>
              <View style={styles.dataTextContainer}>
                <Text style={styles.dataTitle}>Export Data</Text>
                <Text style={styles.dataDescription}>Download all your bets as CSV</Text>
              </View>
              <Text style={styles.csvLabel}>CSV</Text>
            </AnimatedPressable>

            {/* Clear All Data */}
            <AnimatedPressable style={styles.dangerRow} onPress={handleClearAllData} scaleDown={0.97}>
              <View style={styles.dangerIconCircle}>
                <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.dataTextContainer}>
                <Text style={styles.dangerTitle}>Clear All Data</Text>
                <Text style={styles.dataDescription}>Delete all bets and history</Text>
              </View>
            </AnimatedPressable>
          </View>
        </FadeInView>

      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.type === 'error' ? styles.toastError : styles.toastSuccess,
            { opacity: toastOpacity },
          ]}
        >
          <Ionicons
            name={toast.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ──

function ToggleRow({
  colors,
  styles,
  icon,
  title,
  description,
  isOn,
  onToggle,
  isLast = false,
}: {
  colors: any;
  styles: any;
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
        <Ionicons name={icon} size={22} color={colors.iconSecondary} />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <AnimatedPressable onPress={onToggle} scaleDown={0.97}>
        <View style={[styles.toggleSwitch, isOn && styles.toggleSwitchOn]}>
          <View style={[styles.toggleThumb, isOn && styles.toggleThumbOn]} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

function ToggleRowSimple({
  styles,
  title,
  description,
  isOn,
  onToggle,
  isLast = false,
}: {
  styles: any;
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
      <AnimatedPressable onPress={onToggle} scaleDown={0.97}>
        <View style={[styles.toggleSwitch, isOn && styles.toggleSwitchOn]}>
          <View style={[styles.toggleThumb, isOn && styles.toggleThumbOn]} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

// ── Styles ──

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
    backButton: {
      width: 40, height: 40, borderRadius: 20, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.surface,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerTextContainer: { flex: 1, paddingTop: 4 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 4 },
    headerSubtitle: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },

    // Card
    card: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    cardHeaderIcon: { marginRight: 8 },

    // Form fields
    formField: { marginBottom: 18 },
    formFieldLast: { marginBottom: 0 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },

    // Selector rows (currency / language)
    selectorRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
      borderRadius: 10, paddingHorizontal: 14, height: 50,
      borderWidth: 1, borderColor: colors.inputBorder,
    },
    selectorIcon: { marginRight: 12 },
    selectorText: { flex: 1, fontSize: 14, fontWeight: '400', color: colors.inputText },

    // Odds format pills
    oddsFormatContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    oddsPill: {
      flex: 1, backgroundColor: colors.chipBg, borderRadius: 22,
      paddingVertical: 12, alignItems: 'center', justifyContent: 'center', height: 44,
    },
    oddsPillActive: { backgroundColor: colors.accent },
    oddsPillText: { fontSize: 15, fontWeight: '600', color: colors.chipText },
    oddsPillTextActive: { color: '#FFFFFF' },
    oddsExample: { fontSize: 12, fontWeight: '400', color: colors.textTertiary, marginTop: 2 },

    // Toggle rows with icons
    settingRow: { flexDirection: 'row', alignItems: 'center' },
    settingRowMargin: { marginBottom: 22 },
    settingIconCircle: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.iconCircleBg,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    settingTextContainer: { flex: 1 },
    settingTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
    settingDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },

    // Simple toggle rows (no icon)
    simpleSettingRow: { flexDirection: 'row', alignItems: 'center' },

    // Toggle switch
    toggleSwitch: {
      width: 48, height: 28, borderRadius: 14,
      backgroundColor: colors.border, padding: 2, justifyContent: 'center',
    },
    toggleSwitchOn: {
      backgroundColor: colors.accent, justifyContent: 'flex-end', flexDirection: 'row',
    },
    toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
    toggleThumbOn: {},

    // Data management rows
    dataRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    dataIconCircle: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.textSecondary,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    dataTextContainer: { flex: 1 },
    dataTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
    dataDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },
    csvLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },

    // Danger row
    dangerRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.background, borderRadius: 10, padding: 14,
    },
    dangerIconCircle: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.loss,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.loss, marginBottom: 3 },

    // Toast
    toast: {
      position: 'absolute', bottom: 40, left: 20, right: 20, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
    },
    toastSuccess: { backgroundColor: colors.accent },
    toastError: { backgroundColor: colors.loss },
    toastText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  });
}
