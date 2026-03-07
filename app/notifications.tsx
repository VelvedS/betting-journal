/*
 * ─────────────────────────────────────────────────────────────────────────────
 * SQL MIGRATION — run in the Supabase SQL editor before testing:
 *
 *   ALTER TABLE public.profiles
 *   ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
 *     "push": {
 *       "betResults": true,
 *       "dailySummary": true,
 *       "promotions": false,
 *       "achievements": true,
 *       "weeklyReport": true
 *     },
 *     "email": {
 *       "betResults": true,
 *       "dailySummary": false,
 *       "promotions": true,
 *       "achievements": false,
 *       "weeklyReport": true
 *     }
 *   }'::jsonb;
 *
 *   ALTER TABLE public.profiles
 *   ADD COLUMN IF NOT EXISTS quiet_hours JSONB DEFAULT '{
 *     "enabled": false,
 *     "from": "22:00",
 *     "until": "08:00"
 *   }'::jsonb;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';

// ── Types ──

type NotifKey = 'betResults' | 'dailySummary' | 'promotions' | 'achievements' | 'weeklyReport';
type NotifGroup = Record<NotifKey, boolean>;
type NotificationPrefs = { push: NotifGroup; email: NotifGroup };
type QuietHours = { enabled: boolean; from: string; until: string };
type ToastState = { message: string; type: 'success' | 'error' } | null;

// ── Defaults ──

const DEFAULT_PUSH: NotifGroup = {
  betResults: true, dailySummary: true, promotions: false,
  achievements: true, weeklyReport: true,
};

const DEFAULT_EMAIL: NotifGroup = {
  betResults: true, dailySummary: false, promotions: true,
  achievements: false, weeklyReport: true,
};

const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, from: '22:00', until: '08:00' };

// ── Time helpers ──

function timeToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatDisplayTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 || 12;
  return `${display}:${m.toString().padStart(2, '0')} ${period}`;
}

// ── Row metadata ──

const NOTIF_ROWS: { key: NotifKey; icon: string; title: string; description: string }[] = [
  { key: 'betResults',   icon: 'trophy-outline',              title: 'Bet Results',   description: 'Get notified when your bets settle' },
  { key: 'dailySummary', icon: 'trending-up-outline',         title: 'Daily Summary', description: 'Recap of your daily performance' },
  { key: 'promotions',   icon: 'chatbubble-outline',          title: 'Promotions',    description: 'Special offers and updates' },
  { key: 'achievements', icon: 'star-outline',   title: 'Achievements',  description: 'Milestone and badge notifications' },
  { key: 'weeklyReport', icon: 'mail-outline',   title: 'Weekly Report', description: 'Comprehensive weekly performance' },
];

// ── Component ──

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pushPrefs, setPushPrefs] = useState<NotifGroup>(DEFAULT_PUSH);
  const [emailPrefs, setEmailPrefs] = useState<NotifGroup>(DEFAULT_EMAIL);
  const [quietHours, setQuietHours] = useState<QuietHours>(DEFAULT_QUIET_HOURS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [showTimePicker, setShowTimePicker] = useState<'from' | 'until' | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Toast ──

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setToast(null)
      );
    }, 2500);
  }, [toastOpacity]);

  // ── Fetch on focus ──

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('notification_prefs, quiet_hours')
        .eq('id', user.id)
        .single();

      if (data?.notification_prefs) {
        setPushPrefs({ ...DEFAULT_PUSH, ...data.notification_prefs.push });
        setEmailPrefs({ ...DEFAULT_EMAIL, ...data.notification_prefs.email });
      }
      if (data?.quiet_hours) {
        setQuietHours({ ...DEFAULT_QUIET_HOURS, ...data.quiet_hours });
      }
    } catch {
      // No profile row yet — defaults already set
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchPrefs(); }, [fetchPrefs]));

  // ── Save notification prefs ──

  const saveNotifPrefs = useCallback(async (push: NotifGroup, email: NotifGroup) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        notification_prefs: { push, email },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      showToast('Saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  }, [user, showToast]);

  // ── Save quiet hours ──

  const saveQuietHours = useCallback(async (qh: QuietHours) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        quiet_hours: qh,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      showToast('Saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  }, [user, showToast]);

  // ── Toggle handlers ──

  const togglePush = (key: NotifKey) => {
    const next = { ...pushPrefs, [key]: !pushPrefs[key] };
    setPushPrefs(next);
    saveNotifPrefs(next, emailPrefs);
  };

  const toggleEmail = (key: NotifKey) => {
    const next = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(next);
    saveNotifPrefs(pushPrefs, next);
  };

  // ── Quiet hours handlers ──

  const handleQuietHoursToggle = () => {
    const next = { ...quietHours, enabled: !quietHours.enabled };
    setQuietHours(next);
    saveQuietHours(next);
  };

  const openTimePicker = (field: 'from' | 'until') => {
    setPickerDate(timeToDate(quietHours[field]));
    setShowTimePicker(field);
  };

  // Android: fires once on confirm/dismiss
  // iOS: fires on every scroll tick — only update pickerDate, save on Done
  const handleTimeChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(null);
      if (_event.type !== 'dismissed' && date && showTimePicker) {
        const timeStr = dateToTime(date);
        const newQH = { ...quietHours, [showTimePicker]: timeStr };
        setQuietHours(newQH);
        saveQuietHours(newQH);
      }
      return;
    }
    if (date) setPickerDate(date);
  };

  const handleTimeConfirm = () => {
    if (!showTimePicker) return;
    const timeStr = dateToTime(pickerDate);
    const newQH = { ...quietHours, [showTimePicker]: timeStr };
    setQuietHours(newQH);
    setShowTimePicker(null);
    saveQuietHours(newQH);
  };

  // ── Derived ──

  const pushCount = Object.values(pushPrefs).filter(Boolean).length;
  const emailCount = Object.values(emailPrefs).filter(Boolean).length;

  // ── Render ──

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <AnimatedPressable style={styles.backButton} onPress={() => router.back()} scaleDown={0.9}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </AnimatedPressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Manage your notification preferences</Text>
            </View>
            {loading && (
              <ActivityIndicator size="small" color={colors.textTertiary} style={{ marginTop: 6 }} />
            )}
          </View>
        </FadeInView>

        {/* Summary Card */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIconCircle}>
                <Ionicons name="notifications" size={24} color={colors.buttonPrimaryText} />
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryTitle}>Stay Updated</Text>
                <Text style={styles.summaryDescription}>Choose how you want to hear from us</Text>
              </View>
            </View>
            <View style={styles.statsBoxContainer}>
              <View style={styles.statBox}>
                <Ionicons name="notifications-outline" size={24} color={colors.iconSecondary} />
                <Text style={styles.statBoxLabel}>Push</Text>
                <Text style={styles.statBoxValue}>{pushCount}/5</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="mail-outline" size={24} color={colors.iconSecondary} />
                <Text style={styles.statBoxLabel}>Email</Text>
                <Text style={styles.statBoxValue}>{emailCount}/5</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Push Notifications Card */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.notificationCard}>
            <View style={styles.notificationHeader}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} style={styles.headerIcon} />
              <Text style={styles.notificationCardTitle}>Push Notifications</Text>
            </View>
            {NOTIF_ROWS.map((row, i) => (
              <NotificationRow
                key={row.key}
                icon={row.icon}
                title={row.title}
                description={row.description}
                isOn={pushPrefs[row.key]}
                onToggle={() => togglePush(row.key)}
                isLast={i === NOTIF_ROWS.length - 1}
                colors={colors}
              />
            ))}
          </View>
        </FadeInView>

        {/* Email Notifications Card */}
        <FadeInView delay={240} direction="bottom">
          <View style={styles.notificationCard}>
            <View style={styles.notificationHeader}>
              <Ionicons name="mail-outline" size={20} color={colors.text} style={styles.headerIcon} />
              <Text style={styles.notificationCardTitle}>Email Notifications</Text>
            </View>
            {NOTIF_ROWS.map((row, i) => (
              <NotificationRow
                key={row.key}
                icon={row.icon}
                title={row.title}
                description={row.description}
                isOn={emailPrefs[row.key]}
                onToggle={() => toggleEmail(row.key)}
                isLast={i === NOTIF_ROWS.length - 1}
                colors={colors}
              />
            ))}
          </View>
        </FadeInView>

        {/* Quiet Hours Card */}
        <FadeInView delay={320} direction="bottom">
          <View style={styles.quietHoursCard}>
            <View style={styles.quietHoursHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.quietHoursTitle}>Quiet Hours</Text>
                <Text style={styles.quietHoursDescription}>
                  Pause notifications during specific hours
                </Text>
              </View>
              <AnimatedPressable onPress={handleQuietHoursToggle} scaleDown={0.95}>
                <View style={[styles.toggleSwitch, quietHours.enabled && styles.toggleSwitchOn]}>
                  <View style={[styles.toggleThumb, quietHours.enabled && styles.toggleThumbOn]} />
                </View>
              </AnimatedPressable>
            </View>

            {quietHours.enabled && (
              <View style={styles.timeInputContainer}>
                <View style={styles.timeInputWrapper}>
                  <Text style={styles.timeInputLabel}>From</Text>
                  <AnimatedPressable
                    style={styles.timeInput}
                    onPress={() => openTimePicker('from')}
                    scaleDown={0.97}
                  >
                    <Ionicons name="time-outline" size={18} color={colors.iconSecondary} style={{ marginRight: 8 }} />
                    <Text style={styles.timeInputText}>{formatDisplayTime(quietHours.from)}</Text>
                  </AnimatedPressable>
                </View>
                <View style={styles.timeInputWrapper}>
                  <Text style={styles.timeInputLabel}>Until</Text>
                  <AnimatedPressable
                    style={styles.timeInput}
                    onPress={() => openTimePicker('until')}
                    scaleDown={0.97}
                  >
                    <Ionicons name="time-outline" size={18} color={colors.iconSecondary} style={{ marginRight: 8 }} />
                    <Text style={styles.timeInputText}>{formatDisplayTime(quietHours.until)}</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}
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
            size={16}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* Time Picker — Android: native dialog */}
      {showTimePicker !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Time Picker — iOS: bottom sheet modal */}
      {showTimePicker !== null && Platform.OS === 'ios' && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setShowTimePicker(null)}>
          <TouchableWithoutFeedback onPress={() => setShowTimePicker(null)}>
            <View style={styles.pickerOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHandle} />
                  <View style={styles.pickerSheetHeader}>
                    <Text style={styles.pickerTitle}>
                      {showTimePicker === 'from' ? 'From' : 'Until'}
                    </Text>
                    <AnimatedPressable onPress={handleTimeConfirm} scaleDown={0.95}>
                      <Text style={styles.pickerDone}>Done</Text>
                    </AnimatedPressable>
                  </View>
                  <DateTimePicker
                    value={pickerDate}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    style={styles.picker}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

    </SafeAreaView>
  );
}

// ── NotificationRow ──

function NotificationRow({
  icon, title, description, isOn, onToggle, isLast = false, colors,
}: {
  icon: string;
  title: string;
  description: string;
  isOn: boolean;
  onToggle: () => void;
  isLast?: boolean;
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.notificationRow, !isLast && styles.notificationRowBorder]}>
      <Ionicons name={icon as any} size={22} color={colors.iconSecondary} style={styles.notificationIcon} />
      <View style={styles.notificationTextContainer}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationDescription}>{description}</Text>
      </View>
      <AnimatedPressable onPress={onToggle} scaleDown={0.9}>
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

    // Summary Card
    summaryCard: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    summaryIconCircle: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: colors.buttonPrimary, alignItems: 'center',
      justifyContent: 'center', marginRight: 14,
    },
    summaryTextContainer: { flex: 1 },
    summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
    summaryDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },
    statsBoxContainer: { flexDirection: 'row', gap: 12 },
    statBox: {
      flex: 1, backgroundColor: colors.iconCircleBg, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, paddingVertical: 16, alignItems: 'center',
    },
    statBoxLabel: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, marginTop: 8, marginBottom: 4 },
    statBoxValue: { fontSize: 22, fontWeight: '700', color: colors.text },

    // Notification Cards
    notificationCard: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    notificationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    headerIcon: { marginRight: 8 },
    notificationCardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    notificationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    notificationRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.dividerLine },
    notificationIcon: { marginRight: 14 },
    notificationTextContainer: { flex: 1 },
    notificationTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
    notificationDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },

    // Toggle Switch
    toggleSwitch: {
      width: 48, height: 28, borderRadius: 14,
      backgroundColor: colors.dividerLine, padding: 2, justifyContent: 'center',
    },
    toggleSwitchOn: {
      backgroundColor: '#10B981', justifyContent: 'flex-end', flexDirection: 'row',
    },
    toggleThumb: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface,
    },
    toggleThumbOn: {},

    // Quiet Hours Card
    quietHoursCard: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    quietHoursHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
    quietHoursTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
    quietHoursDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },
    timeInputContainer: { flexDirection: 'row', gap: 16, marginTop: 20 },
    timeInputWrapper: { flex: 1 },
    timeInputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    timeInput: {
      backgroundColor: colors.input, borderRadius: 10, borderWidth: 1,
      borderColor: colors.inputBorder, paddingHorizontal: 14, height: 50,
      flexDirection: 'row', alignItems: 'center',
    },
    timeInputText: { fontSize: 14, fontWeight: '600', color: colors.inputText },

    // Toast
    toast: {
      position: 'absolute', bottom: 40, left: 20, right: 20,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
    },
    toastSuccess: { backgroundColor: '#10B981' },
    toastError: { backgroundColor: '#E85D5D' },
    toastText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1 },

    // Time Picker Modal (iOS)
    pickerOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 34,
    },
    pickerHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    pickerSheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.dividerLine,
    },
    pickerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    pickerDone: { fontSize: 16, fontWeight: '700', color: '#10B981' },
    picker: { width: '100%' },
  });
}
