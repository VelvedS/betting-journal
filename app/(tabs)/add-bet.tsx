import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function AddBetScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Your Bet</Text>
          <Text style={styles.subtitle}>Scan your betting slips to auto-log your trades</Text>
        </View>

        {/* Card 1 - Upload Betting Slip (Primary Action) */}
        <TouchableOpacity style={styles.uploadCard} activeOpacity={0.7}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="cloud-upload-outline" size={32} color="#6B6B6B" />
          </View>
          <Text style={styles.uploadCardTitle}>Upload Betting Slip</Text>
          <Text style={styles.uploadCardDescription}>
            Take a screenshot or upload an image of your betting slip
          </Text>
        </TouchableOpacity>

        {/* Card 2 - Take a Photo (Secondary Action) */}
        <TouchableOpacity style={styles.compactCard} activeOpacity={0.7}>
          <View style={styles.compactIconCircle}>
            <Ionicons name="camera-outline" size={24} color="#6B6B6B" />
          </View>
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactCardTitle}>Take a Photo</Text>
            <Text style={styles.compactCardDescription}>Capture physical betting slip</Text>
          </View>
        </TouchableOpacity>

        {/* Divider Section with OR */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerTextContainer}>
            <Text style={styles.dividerText}>OR</Text>
          </View>
        </View>

        {/* Card 3 - Manually Add Your Bet */}
        <TouchableOpacity style={styles.compactCard} activeOpacity={0.7}>
          <View style={styles.compactIconCircle}>
            <Ionicons name="add-outline" size={28} color="#6B6B6B" />
          </View>
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactCardTitle}>Manually Add Your Bet</Text>
            <Text style={styles.compactCardDescription}>Enter bet details by hand</Text>
          </View>
        </TouchableOpacity>

        {/* Card 4 - AI-Powered Recognition (Info Card) */}
        <View style={styles.infoCard}>
          <Ionicons name="sparkles" size={20} color="#6366F1" style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoCardTitle}>AI-Powered Recognition</Text>
            <Text style={styles.infoCardDescription}>
              Our smart scanner automatically extracts wager amount, odds, parlay legs, and calculates potential payout from your betting slips.
            </Text>
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
    paddingTop: 20,
    paddingBottom: 100,
  },
  
  // Header Section
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 20,
  },

  // Upload Card (Primary Action - Large Card)
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 190,
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  uploadCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadCardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  // Compact Card (Take a Photo & Manual Add)
  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    minHeight: 76,
  },
  compactIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  compactTextContainer: {
    flex: 1,
  },
  compactCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  compactCardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 18,
  },

  // Divider Section
  dividerContainer: {
    marginVertical: 48,
    position: 'relative',
    alignItems: 'center',
  },
  dividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerTextContainer: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9B9B9B',
    letterSpacing: 0.5,
  },

  // Info Card (AI-Powered Recognition)
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  infoCardDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 19,
  },
});
