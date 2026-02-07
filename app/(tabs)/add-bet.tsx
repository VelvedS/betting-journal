import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type ScreenState = 'default' | 'processing' | 'success' | 'error';

export default function AddBetScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [screen, setScreen] = useState<ScreenState>('default');
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Animation values
  const spinValue = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const step1Opacity = useRef(new Animated.Value(0)).current;
  const step2Opacity = useRef(new Animated.Value(0)).current;
  const step3Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (screen === 'processing') {
      // Reset and start animations
      setVisibleSteps(0);
      step1Opacity.setValue(0);
      step2Opacity.setValue(0);
      step3Opacity.setValue(0);

      // Start spinning animation
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();

      // Animate steps sequentially
      setTimeout(() => {
        setVisibleSteps(1);
        Animated.timing(step1Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 200);

      setTimeout(() => {
        setVisibleSteps(2);
        Animated.timing(step2Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 1200);

      setTimeout(() => {
        setVisibleSteps(3);
        Animated.timing(step3Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 2200);

      // Call Edge Function to extract bet details
      callExtractBetDetailsFunction();

      return () => {};
    } else if (screen === 'success') {
      // Checkmark pop-in animation
      checkmarkScale.setValue(0);
      Animated.spring(checkmarkScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Auto-navigate to manual form after 1.5s
      const timer = setTimeout(() => {
        navigateToManualForm();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [screen]);

  const handleUploadOrPhoto = () => {
    setScreen('processing');
  };

  const handleSuccessTap = () => {
    setScreen('default');
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (screen === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Bet</Text>
            <Text style={styles.subtitle}>Scan your betting slips to auto-log your trades</Text>
          </View>

          {/* Processing Card - Centered */}
          <View style={styles.centeredCardContainer}>
            <View style={styles.processingCard}>
              {/* Spinning Circle with AI Icon */}
              <Animated.View
                style={[
                  styles.spinningCircle,
                  { transform: [{ rotate: spin }] },
                ]}
              >
                <View style={styles.spinningCircleInner} />
              </Animated.View>
              <View style={styles.aiIconContainer}>
                <Ionicons name="sparkles" size={34} color="#6C63FF" />
              </View>

              <Text style={styles.processingTitle}>Processing Ticket...</Text>
              <Text style={styles.processingDescription}>
                Extracting wager details from your slip
              </Text>

              {/* Status Steps */}
              <View style={styles.stepsContainer}>
                {visibleSteps >= 1 && (
                  <Animated.View style={[styles.stepRow, { opacity: step1Opacity }]}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Reading ticket image</Text>
                  </Animated.View>
                )}
                {visibleSteps >= 2 && (
                  <Animated.View style={[styles.stepRow, { opacity: step2Opacity }]}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Identifying wager amount</Text>
                  </Animated.View>
                )}
                {visibleSteps >= 3 && (
                  <Animated.View style={[styles.stepRow, { opacity: step3Opacity }]}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Extracting parlay legs</Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <TouchableOpacity 
          style={styles.fullScreenContainer} 
          activeOpacity={1}
          onPress={handleSuccessTap}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Bet</Text>
            <Text style={styles.subtitle}>Scan your betting slips to auto-log your trades</Text>
          </View>

          {/* Success Card - Centered */}
          <View style={styles.centeredCardContainer}>
            <View style={styles.successCard}>
              {/* Success Checkmark Icon */}
              <Animated.View
                style={[
                  styles.successIconContainer,
                  { transform: [{ scale: checkmarkScale }] },
                ]}
              >
                <View style={styles.checkmarkCircle}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                </View>
              </Animated.View>

              <Text style={styles.successTitle}>Bet Logged Successfully</Text>
              <Text style={styles.successDescription}>
                Your ticket has been added to the ledger.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Default Add Bet Screen
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
        <TouchableOpacity style={styles.uploadCard} activeOpacity={0.7} onPress={handleUploadOrPhoto}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="cloud-upload-outline" size={32} color="#6B6B6B" />
          </View>
          <Text style={styles.uploadCardTitle}>Upload Betting Slip</Text>
          <Text style={styles.uploadCardDescription}>
            Take a screenshot or upload an image of your betting slip
          </Text>
        </TouchableOpacity>

        {/* Card 2 - Take a Photo (Secondary Action) */}
        <TouchableOpacity style={styles.compactCard} activeOpacity={0.7} onPress={handleUploadOrPhoto}>
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
        <TouchableOpacity style={styles.compactCard} activeOpacity={0.7} onPress={() => router.push('/manual-add-bet')}>
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
  fullScreenContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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

  // Centered Card Container
  centeredCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 100,
  },

  // Processing Card
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  spinningCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: '#6C63FF',
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  spinningCircleInner: {
    width: '100%',
    height: '100%',
  },
  aiIconContainer: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    width: 108,
    height: 108,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 24,
    textAlign: 'center',
  },
  processingDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepsContainer: {
    marginTop: 28,
    alignSelf: 'stretch',
    paddingLeft: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C63FF',
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },

  // Success Card
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  checkmarkCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#E8F8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
  },
  successDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
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
