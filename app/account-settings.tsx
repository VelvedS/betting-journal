import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AccountSettingsScreen() {
  const router = useRouter();

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
            <Text style={styles.headerTitle}>Account Settings</Text>
            <Text style={styles.headerSubtitle}>Update your profile information</Text>
          </View>
        </View>

        {/* Card 1 - Profile Photo */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Profile Photo</Text>
          <View style={styles.photoSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person-outline" size={36} color="#6B6B6B" />
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </View>
            <TouchableOpacity style={styles.uploadButton} activeOpacity={0.7}>
              <Text style={styles.uploadButtonText}>Upload Photo</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.photoRecommendation}>Recommended: Square image, at least 400×400px</Text>
        </View>

        {/* Card 2 - Personal Information */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Personal Information</Text>

          {/* Full Name */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9B9B9B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value="John Trader"
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
          </View>

          {/* Email Address */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#9B9B9B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value="john.trader@email.com"
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#9B9B9B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value="+1 (555) 123-4567"
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
          </View>

          {/* Location */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color="#9B9B9B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value="New York, NY"
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
          </View>

          {/* Member Since */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Member Since</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="calendar-outline" size={20} color="#9B9B9B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value="January 2024"
                placeholderTextColor="#9B9B9B"
                editable={false}
              />
            </View>
          </View>
        </View>

        {/* Card 3 - Currency & Stake Settings */}
        <View style={styles.card}>
          {/* Currency Row */}
          <View style={styles.settingRow}>
            <Text style={styles.settingValue}>USD ($)</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.changeButton}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Default Stake Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Default Stake</Text>
              <Text style={styles.settingSubtitle}>$50.00</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.changeButton}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Changes Button */}
        <TouchableOpacity style={styles.saveButton} activeOpacity={0.8}>
          <Ionicons name="save-outline" size={20} color="#FFFFFF" style={styles.saveIcon} />
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>

        {/* Danger Zone Card */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.dangerDescription}>
            Once you delete your account, there is no going back. Please be certain.
          </Text>
          <TouchableOpacity style={styles.deleteButton} activeOpacity={0.7}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
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

  // Card Container
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 20,
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },

  // Profile Photo Section
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 20,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  uploadButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    height: 44,
    justifyContent: 'center',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  photoRecommendation: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9B9B9B',
    marginTop: 4,
  },

  // Form Fields
  formField: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A4A',
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
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },

  // Settings Rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  changeButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Save Changes Button
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    height: 54,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Danger Zone Card
  dangerCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFCCCC',
    padding: 20,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E85D5D',
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 19,
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E85D5D',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E85D5D',
  },
});
