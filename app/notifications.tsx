import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function NotificationsScreen() {
  const router = useRouter();

  // Push Notifications State
  const [pushNotifications, setPushNotifications] = useState({
    betResults: true,
    dailySummary: true,
    promotions: false,
    achievements: true,
    priceAlerts: true,
    weeklyReport: true,
  });

  // Email Notifications State
  const [emailNotifications, setEmailNotifications] = useState({
    betResults: true,
    dailySummary: false,
    promotions: true,
    achievements: false,
    priceAlerts: false,
    weeklyReport: true,
  });

  // Calculate counts
  const pushCount = Object.values(pushNotifications).filter(Boolean).length;
  const emailCount = Object.values(emailNotifications).filter(Boolean).length;

  const togglePush = (key: keyof typeof pushNotifications) => {
    setPushNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEmail = (key: keyof typeof emailNotifications) => {
    setEmailNotifications(prev => ({ ...prev, [key]: !prev[key] }));
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
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>Manage your notification preferences</Text>
          </View>
        </View>

        {/* Card 1 - Stay Updated */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="notifications" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryTitle}>Stay Updated</Text>
              <Text style={styles.summaryDescription}>Choose how you want to hear from us</Text>
            </View>
          </View>

          <View style={styles.statsBoxContainer}>
            <View style={styles.statBox}>
              <Ionicons name="notifications-outline" size={24} color="#4A4A4A" />
              <Text style={styles.statBoxLabel}>Push</Text>
              <Text style={styles.statBoxValue}>{pushCount}/6</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="mail-outline" size={24} color="#4A4A4A" />
              <Text style={styles.statBoxLabel}>Email</Text>
              <Text style={styles.statBoxValue}>{emailCount}/6</Text>
            </View>
          </View>
        </View>

        {/* Card 2 - Push Notifications */}
        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <Ionicons name="notifications-outline" size={20} color="#1A1A1A" style={styles.headerIcon} />
            <Text style={styles.notificationCardTitle}>Push Notifications</Text>
          </View>

          <NotificationRow
            icon="trophy-outline"
            title="Bet Results"
            description="Get notified when your bets settle"
            isOn={pushNotifications.betResults}
            onToggle={() => togglePush('betResults')}
          />
          <NotificationRow
            icon="trending-up-outline"
            title="Daily Summary"
            description="Recap of your daily performance"
            isOn={pushNotifications.dailySummary}
            onToggle={() => togglePush('dailySummary')}
          />
          <NotificationRow
            icon="chatbubble-outline"
            title="Promotions"
            description="Special offers and updates"
            isOn={pushNotifications.promotions}
            onToggle={() => togglePush('promotions')}
          />
          <NotificationRow
            icon="star-outline"
            title="Achievements"
            description="Milestone and badge notifications"
            isOn={pushNotifications.achievements}
            onToggle={() => togglePush('achievements')}
          />
          <NotificationRow
            icon="information-circle-outline"
            title="Price Alerts"
            description="Changes in odds and lines"
            isOn={pushNotifications.priceAlerts}
            onToggle={() => togglePush('priceAlerts')}
          />
          <NotificationRow
            icon="mail-outline"
            title="Weekly Report"
            description="Comprehensive weekly performance"
            isOn={pushNotifications.weeklyReport}
            onToggle={() => togglePush('weeklyReport')}
            isLast
          />
        </View>

        {/* Card 3 - Email Notifications */}
        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <Ionicons name="mail-outline" size={20} color="#1A1A1A" style={styles.headerIcon} />
            <Text style={styles.notificationCardTitle}>Email Notifications</Text>
          </View>

          <NotificationRow
            icon="trophy-outline"
            title="Bet Results"
            description="Get notified when your bets settle"
            isOn={emailNotifications.betResults}
            onToggle={() => toggleEmail('betResults')}
          />
          <NotificationRow
            icon="trending-up-outline"
            title="Daily Summary"
            description="Recap of your daily performance"
            isOn={emailNotifications.dailySummary}
            onToggle={() => toggleEmail('dailySummary')}
          />
          <NotificationRow
            icon="chatbubble-outline"
            title="Promotions"
            description="Special offers and updates"
            isOn={emailNotifications.promotions}
            onToggle={() => toggleEmail('promotions')}
          />
          <NotificationRow
            icon="star-outline"
            title="Achievements"
            description="Milestone and badge notifications"
            isOn={emailNotifications.achievements}
            onToggle={() => toggleEmail('achievements')}
          />
          <NotificationRow
            icon="information-circle-outline"
            title="Price Alerts"
            description="Changes in odds and lines"
            isOn={emailNotifications.priceAlerts}
            onToggle={() => toggleEmail('priceAlerts')}
          />
          <NotificationRow
            icon="mail-outline"
            title="Weekly Report"
            description="Comprehensive weekly performance"
            isOn={emailNotifications.weeklyReport}
            onToggle={() => toggleEmail('weeklyReport')}
            isLast
          />
        </View>

        {/* Card 4 - Quiet Hours */}
        <View style={styles.quietHoursCard}>
          <Text style={styles.quietHoursTitle}>Quiet Hours</Text>
          <Text style={styles.quietHoursDescription}>Pause notifications during specific hours</Text>
          <View style={styles.timeInputContainer}>
            <View style={styles.timeInputWrapper}>
              <Text style={styles.timeInputLabel}>From</Text>
              <TextInput
                style={styles.timeInput}
                placeholder=""
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
            <View style={styles.timeInputWrapper}>
              <Text style={styles.timeInputLabel}>Until</Text>
              <TextInput
                style={styles.timeInput}
                placeholder=""
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Reusable Notification Row Component
function NotificationRow({
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
    <View style={[styles.notificationRow, !isLast && styles.notificationRowBorder]}>
      <Ionicons name={icon} size={22} color="#4A4A4A" style={styles.notificationIcon} />
      <View style={styles.notificationTextContainer}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationDescription}>{description}</Text>
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

  // Summary Card (Stay Updated)
  summaryCard: {
    backgroundColor: '#F0FAF4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4F0E0',
    padding: 20,
    marginBottom: 18,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  summaryIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  summaryDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
  statsBoxContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 16,
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    marginTop: 8,
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Notification Cards
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 20,
    marginBottom: 18,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    marginRight: 8,
  },
  notificationCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  notificationRowBorder: {
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  notificationIcon: {
    marginRight: 14,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  notificationDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },
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
    // No additional styles needed, position is handled by parent
  },

  // Quiet Hours Card
  quietHoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 20,
    marginBottom: 18,
  },
  quietHoursTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  quietHoursDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
    marginBottom: 16,
  },
  timeInputContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  timeInputWrapper: {
    flex: 1,
  },
  timeInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    height: 50,
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
});
