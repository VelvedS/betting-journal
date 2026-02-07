import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_DATA = [
  {
    question: "How do I add a new bet?",
    answer: "Tap the + button in the bottom navigation to add a new bet. You can upload a betting slip photo or enter details manually."
  },
  {
    question: "Can I track multiple sportsbooks?",
    answer: "Yes! We support all major sportsbooks including DraftKings, FanDuel, BetMGM, Caesars, and more."
  },
  {
    question: "How are my statistics calculated?",
    answer: "Statistics are calculated automatically based on your logged bets, including win rate, ROI, and net profit/loss."
  },
  {
    question: "Is my betting data private and secure?",
    answer: "Yes, all your data is encrypted and stored securely. We never share your personal betting data with third parties."
  },
  {
    question: "What bet types are supported?",
    answer: "We support Moneyline, Spread, Over/Under, Parlays, and more. New bet types are added regularly."
  },
  {
    question: "Can I export my betting history?",
    answer: "Yes, go to Preferences > Data Management > Export Data to download your complete betting history as a CSV file."
  },
  {
    question: "How do I switch between light and dark mode?",
    answer: "Go to your Profile and tap the Appearance toggle to switch between light and dark mode."
  },
  {
    question: "What happens if I delete a bet?",
    answer: "Deleted bets are removed from your statistics and history. This action cannot be undone."
  }
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const toggleFAQ = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFAQ(expandedFAQ === index ? null : index);
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
            <Text style={styles.headerTitle}>Help & Support</Text>
            <Text style={styles.headerSubtitle}>We're here to help you succeed</Text>
          </View>
        </View>

        {/* Card 1 - Need Help? (Hero Card) */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconCircle}>
              <Ionicons name="help-circle" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Need Help?</Text>
              <Text style={styles.heroDescription}>We typically respond in under 2 hours</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>24/7</Text>
              <Text style={styles.statLabel}>Support</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>&lt;2h</Text>
              <Text style={styles.statLabel}>Response</Text>
            </View>
          </View>
        </View>

        {/* Card 2 - Contact Us */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Us</Text>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.7}>
            <View style={styles.contactIconCircle}>
              <Ionicons name="mail-outline" size={22} color="#4A4A4A" />
            </View>
            <View style={styles.contactTextContainer}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactDescription}>support@parlaytracker.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.7}>
            <View style={styles.contactIconCircle}>
              <Ionicons name="chatbubble-outline" size={22} color="#4A4A4A" />
            </View>
            <View style={styles.contactTextContainer}>
              <Text style={styles.contactTitle}>Live Chat</Text>
              <Text style={styles.contactDescription}>Available 9 AM - 5 PM EST</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.contactRow, styles.lastContactRow]} activeOpacity={0.7}>
            <View style={styles.contactIconCircle}>
              <Ionicons name="call-outline" size={22} color="#4A4A4A" />
            </View>
            <View style={styles.contactTextContainer}>
              <Text style={styles.contactTitle}>Phone Support</Text>
              <Text style={styles.contactDescription}>+1 (800) 555-0123</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9B9B9B" />
          </TouchableOpacity>
        </View>

        {/* Card 3 - Send us a message */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Send us a message</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Describe your issue or question..."
            placeholderTextColor="#9B9B9B"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity style={styles.sendButton} activeOpacity={0.8}>
            <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={styles.sendIcon} />
            <Text style={styles.sendButtonText}>Send Message</Text>
          </TouchableOpacity>
        </View>

        {/* Card 4 - Frequently Asked Questions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
          {FAQ_DATA.map((faq, index) => (
            <View key={index}>
              <TouchableOpacity 
                style={[styles.faqRow, index === 0 && styles.faqRowFirst]}
                onPress={() => toggleFAQ(index)}
                activeOpacity={0.7}
              >
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Ionicons 
                  name="chevron-down" 
                  size={18} 
                  color="#9B9B9B"
                  style={[
                    styles.faqChevron,
                    expandedFAQ === index && styles.faqChevronExpanded
                  ]}
                />
              </TouchableOpacity>
              {expandedFAQ === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
              {index < FAQ_DATA.length - 1 && <View style={styles.faqDivider} />}
            </View>
          ))}
        </View>

        {/* Card 5 - Resources */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resources</Text>

          <TouchableOpacity style={styles.resourceRow} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={20} color="#4A4A4A" style={styles.resourceIcon} />
            <Text style={styles.resourceText}>Getting Started Guide</Text>
            <Ionicons name="open-outline" size={18} color="#9B9B9B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.resourceRow} activeOpacity={0.7}>
            <Ionicons name="videocam-outline" size={20} color="#4A4A4A" style={styles.resourceIcon} />
            <Text style={styles.resourceText}>Video Tutorials</Text>
            <Ionicons name="open-outline" size={18} color="#9B9B9B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.resourceRow} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={20} color="#4A4A4A" style={styles.resourceIcon} />
            <Text style={styles.resourceText}>Terms of Service</Text>
            <Ionicons name="open-outline" size={18} color="#9B9B9B" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.resourceRow, styles.lastResourceRow]} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={20} color="#4A4A4A" style={styles.resourceIcon} />
            <Text style={styles.resourceText}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={18} color="#9B9B9B" />
          </TouchableOpacity>
        </View>

        {/* Card 6 - App Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Build</Text>
            <Text style={styles.infoValue}>2024.01.26</Text>
          </View>

          <View style={[styles.infoRow, styles.lastInfoRow]}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>Web App</Text>
          </View>
        </View>
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

  // Hero Card (Need Help?)
  heroCard: {
    backgroundColor: '#F0FAF4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4F0E0',
    padding: 20,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#E0F5EA',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    height: 68,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B6B6B',
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
    marginBottom: 18,
  },

  // Contact Rows
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  lastContactRow: {
    marginBottom: 0,
  },
  contactIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contactTextContainer: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  contactDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  // Message Input & Send Button
  messageInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    height: 130,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  sendIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // FAQ Accordion
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  faqRowFirst: {
    paddingTop: 0,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
    paddingRight: 12,
  },
  faqChevron: {
    transition: 'transform 0.3s',
  },
  faqChevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    paddingBottom: 16,
    paddingRight: 28,
  },
  faqAnswerText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 20,
  },
  faqDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },

  // Resource Rows
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 6,
  },
  lastResourceRow: {
    marginBottom: 0,
  },
  resourceIcon: {
    marginRight: 12,
  },
  resourceText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },

  // App Information Rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  lastInfoRow: {
    marginBottom: 0,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
});
