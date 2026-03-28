import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';

// ── Types ──

type ToastState = { message: string; type: 'success' | 'error' } | null;

// ── FAQ Data ──

const FAQ_DATA = [
  {
    question: 'How do I add a new bet?',
    answer:
      'You can add a bet two ways. Tap the + button in the center of the tab bar to open the add bet screen. From there, either upload a photo of your betting slip and our AI will automatically extract all the details, or tap "Enter Manually" to fill in the details yourself. Once reviewed, tap Save to log the bet to your journal.',
  },
  {
    question: 'Can I track multiple sportsbooks?',
    answer:
      'Yes — Ledgr supports all major sportsbooks including DraftKings, FanDuel, BetMGM, Caesars, PrizePicks, Underdog Fantasy, Kalshi, and more. Each bet is tagged with the sportsbook it came from, and your Edge page breaks down your performance by sportsbook so you can see where you\'re most profitable.',
  },
  {
    question: 'How are my statistics calculated?',
    answer:
      'Your stats are calculated in real time from all bets marked as Won or Lost. Win rate is your wins divided by total settled bets. ROI is your net profit divided by total amount wagered, expressed as a percentage. Profit/Loss is the sum of all payouts minus all wagers. Pending bets are excluded from all calculations until you mark them as won or lost.',
  },
  {
    question: 'Is my betting data private and secure?',
    answer:
      'Yes. Your data is stored securely in an encrypted database and is only accessible to you. We never sell or share your betting data with third parties, advertisers, or sportsbooks. Ledgr has no ads and never will. You can export or delete all your data at any time from the Preferences screen.',
  },
  {
    question: 'What bet types are supported?',
    answer:
      'Ledgr supports all major bet types — moneyline, spread, over/under, parlays, and props. Parlay legs are tracked individually so you can see which legs you win and lose most often. The AI slip scanner automatically detects the bet type from your screenshot.',
  },
  {
    question: 'Can I export my betting history?',
    answer:
      'Yes. Go to Profile → Preferences → Export Data. This generates a CSV file containing all your bets with full details including date, sportsbook, bet type, sport, matchup, odds, wager, payout, and result. You can open the file in Excel, Google Sheets, or any spreadsheet app.',
  },
  {
    question: 'How do I switch between light and dark mode?',
    answer:
      'Tap the Profile tab, then tap the theme toggle at the top of your profile screen. Ledgr remembers your preference and applies it every time you open the app.',
  },
  {
    question: 'What happens if I delete a bet?',
    answer:
      'Deleting a bet permanently removes it and all associated parlay legs from your journal. This action cannot be undone. Your stats will update immediately to reflect the removal. If you want to keep the bet but correct a mistake, use the edit function instead of deleting it.',
  },
];

// ── App Info ──

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const APP_BUILD =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? '1');
const APP_PLATFORM = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';

// ── Component ──

export default function HelpSupportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // One rotation value per FAQ item, memoised so it doesn't recreate on re-renders
  const faqRotations = useMemo(
    () => FAQ_DATA.map(() => new Animated.Value(0)),
    []
  );

  // ── Toast ──

  const showToast = useCallback(
    (msg: string, type: 'success' | 'error' = 'success') => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: msg, type });
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
          () => setToast(null)
        );
      }, 3500);
    },
    [toastOpacity]
  );

  // ── FAQ toggle ──

  const toggleFAQ = useCallback(
    (index: number) => {
      const isOpen = expandedFAQ === index;
      const next = isOpen ? null : index;

      // Collapse previous if different
      if (expandedFAQ !== null && expandedFAQ !== index) {
        Animated.timing(faqRotations[expandedFAQ], {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }

      Animated.timing(faqRotations[index], {
        toValue: isOpen ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      setExpandedFAQ(next);
    },
    [expandedFAQ, faqRotations]
  );

  // ── Send message ──

  const handleSend = useCallback(async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) {
      showToast('Please fill in all fields before sending', 'error');
      return;
    }

    setSending(true);
    try {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(`Name: ${name}\n\n${message}`);
      await Linking.openURL(
        `mailto:support@ledgr.bet?subject=${encodedSubject}&body=${encodedBody}`
      );
      setName(user?.user_metadata?.full_name ?? '');
      setSubject('');
      setMessage('');
      showToast("Message sent! We'll get back to you within 24 hours");
    } catch {
      showToast('Could not open mail client', 'error');
    } finally {
      setSending(false);
    }
  }, [name, subject, message, user, showToast]);

  // ── Render ──

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
              <Text style={styles.headerTitle}>Help & Support</Text>
              <Text style={styles.headerSubtitle}>We're here to help you succeed</Text>
            </View>
          </View>
        </FadeInView>

        {/* Card 1 — Hero */}
        <FadeInView delay={80} direction="bottom">
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconCircle}>
                <Ionicons name="help-circle" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Need Help?</Text>
                <Text style={styles.heroDescription}>We typically respond within 24 hours</Text>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>100%</Text>
                <Text style={styles.statLabel}>Private</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>🔒</Text>
                <Text style={styles.statLabel}>Encrypted</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Ads</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Card 2 — Contact Us */}
        <FadeInView delay={160} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact Us</Text>

            <AnimatedPressable
              style={styles.contactRow}
              onPress={() => Linking.openURL('mailto:support@ledgr.bet?subject=Ledgr Support Request')}
              scaleDown={0.97}
            >
              <View style={styles.contactIconCircle}>
                <Ionicons name="mail-outline" size={22} color={colors.iconSecondary} />
              </View>
              <View style={styles.contactTextContainer}>
                <Text style={styles.contactTitle}>Email Support</Text>
                <Text style={styles.contactDescription}>support@ledgr.bet</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.contactRow, styles.lastContactRow]}
              onPress={() => Linking.openURL('https://x.com/LedgrJournalApp')}
              scaleDown={0.97}
            >
              <View style={styles.contactIconCircle}>
                <Ionicons name="logo-twitter" size={22} color={colors.iconSecondary} />
              </View>
              <View style={styles.contactTextContainer}>
                <Text style={styles.contactTitle}>X (Twitter)</Text>
                <Text style={styles.contactDescription}>@LedgrJournalApp</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* Card 3 — Send a Message */}
        <FadeInView delay={240} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Send us a message</Text>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Subject</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="create-outline" size={18} color={colors.iconSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="What's this about?"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={[styles.formField, styles.formFieldLast]}>
              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Describe your issue or question..."
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
              />
            </View>

            <AnimatedPressable
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={handleSend}
              scaleDown={0.97}
              disabled={sending}
            >
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={styles.sendIcon} />
              <Text style={styles.sendButtonText}>{sending ? 'Opening…' : 'Send Message'}</Text>
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* Card 4 — FAQ */}
        <FadeInView delay={320} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
            {FAQ_DATA.map((faq, index) => {
              const rotation = faqRotations[index].interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
              });
              return (
                <View key={index}>
                  <AnimatedPressable
                    style={[styles.faqRow, index === 0 && styles.faqRowFirst]}
                    onPress={() => toggleFAQ(index)}
                    scaleDown={0.98}
                  >
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                      <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                    </Animated.View>
                  </AnimatedPressable>
                  {expandedFAQ === index && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                  {index < FAQ_DATA.length - 1 && <View style={styles.faqDivider} />}
                </View>
              );
            })}
          </View>
        </FadeInView>

        {/* Card 5 — Resources */}
        <FadeInView delay={400} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resources</Text>

            <AnimatedPressable
              style={styles.resourceRow}
              onPress={() => Linking.openURL('https://ledgr.bet/guide')}
              scaleDown={0.97}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.iconSecondary} style={styles.resourceIcon} />
              <Text style={styles.resourceText}>Getting Started Guide</Text>
              <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.resourceRow}
              onPress={() => Linking.openURL('https://ledgr.bet/tutorials')}
              scaleDown={0.97}
            >
              <Ionicons name="videocam-outline" size={20} color={colors.iconSecondary} style={styles.resourceIcon} />
              <Text style={styles.resourceText}>Video Tutorials</Text>
              <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.resourceRow}
              onPress={() => Linking.openURL('https://ledgr.bet/terms')}
              scaleDown={0.97}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.iconSecondary} style={styles.resourceIcon} />
              <Text style={styles.resourceText}>Terms of Service</Text>
              <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.resourceRow, styles.lastResourceRow]}
              onPress={() => Linking.openURL('https://ledgr.bet/privacy')}
              scaleDown={0.97}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.iconSecondary} style={styles.resourceIcon} />
              <Text style={styles.resourceText}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
            </AnimatedPressable>
          </View>
        </FadeInView>

        {/* Card 6 — App Information */}
        <FadeInView delay={400} direction="bottom">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>App Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{APP_VERSION}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>{APP_BUILD}</Text>
            </View>

            <View style={[styles.infoRow, styles.lastInfoRow]}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{APP_PLATFORM}</Text>
            </View>
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

    // Hero card
    heroCard: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    heroIconCircle: {
      width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    heroTextContainer: { flex: 1 },
    heroTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
    heroDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },
    statsContainer: { flexDirection: 'row', gap: 10 },
    statChip: {
      flex: 1, backgroundColor: colors.iconCircleBg, borderRadius: 10,
      paddingVertical: 14, paddingHorizontal: 12, alignItems: 'flex-start', height: 68,
    },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.accent, marginBottom: 4 },
    statLabel: { fontSize: 11, fontWeight: '400', color: colors.textSecondary },

    // Card
    card: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 20, marginBottom: 18,
    },
    cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 18 },

    // Contact rows
    contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
    lastContactRow: { marginBottom: 0 },
    contactIconCircle: {
      width: 46, height: 46, borderRadius: 23, backgroundColor: colors.iconCircleBg,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    contactTextContainer: { flex: 1 },
    contactTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
    contactDescription: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 18 },

    // Message form
    formField: { marginBottom: 16 },
    formFieldLast: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
      borderRadius: 10, paddingHorizontal: 14, height: 50,
      borderWidth: 1, borderColor: colors.inputBorder,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 14, fontWeight: '400', color: colors.inputText },
    messageInput: {
      backgroundColor: colors.input, borderRadius: 10, padding: 14,
      fontSize: 14, fontWeight: '400', color: colors.inputText,
      height: 130, borderWidth: 1, borderColor: colors.inputBorder,
    },
    sendButton: {
      backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52,
    },
    sendButtonDisabled: { opacity: 0.5 },
    sendIcon: { marginRight: 8 },
    sendButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

    // FAQ
    faqRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingVertical: 16,
    },
    faqRowFirst: { paddingTop: 0 },
    faqQuestion: {
      flex: 1, fontSize: 15, fontWeight: '500', color: colors.text,
      lineHeight: 20, paddingRight: 12,
    },
    faqAnswer: { paddingBottom: 16, paddingRight: 28 },
    faqAnswerText: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 20 },
    faqDivider: { height: 1, backgroundColor: colors.dividerLine },

    // Resources
    resourceRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, marginBottom: 4,
    },
    lastResourceRow: { marginBottom: 0 },
    resourceIcon: { marginRight: 12 },
    resourceText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },

    // App Info
    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingVertical: 10, marginBottom: 4,
    },
    lastInfoRow: { marginBottom: 0 },
    infoLabel: { fontSize: 14, fontWeight: '400', color: colors.textSecondary },
    infoValue: { fontSize: 14, fontWeight: '500', color: colors.text },

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
