import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated as RNAnimated, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';
import TabScreenTransition from '@/components/TabScreenTransition';

type ScreenState = 'default' | 'processing' | 'success' | 'error';

export default function AddBetScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [screen, setScreen] = useState<ScreenState>('default');
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string>('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // RN Animation values (existing)
  const checkmarkScale = useRef(new RNAnimated.Value(0)).current;
  const step1Opacity = useRef(new RNAnimated.Value(0)).current;
  const step2Opacity = useRef(new RNAnimated.Value(0)).current;
  const step3Opacity = useRef(new RNAnimated.Value(0)).current;

  // Reanimated shared values for new effects
  const pulseScale = useSharedValue(1);
  const errorShakeX = useSharedValue(0);
  const spinRotation = useSharedValue(0);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const errorShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShakeX.value }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  useEffect(() => {
    if (screen === 'processing') {
      // Reset and start animations
      setVisibleSteps(0);
      step1Opacity.setValue(0);
      step2Opacity.setValue(0);
      step3Opacity.setValue(0);

      // Start spinning animation (infinite loop on UI thread)
      spinRotation.value = 0;
      spinRotation.value = withRepeat(withTiming(360, { duration: 2000 }), -1, false);

      // Animate steps sequentially
      setTimeout(() => {
        setVisibleSteps(1);
        RNAnimated.timing(step1Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 200);

      setTimeout(() => {
        setVisibleSteps(2);
        RNAnimated.timing(step2Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 1200);

      setTimeout(() => {
        setVisibleSteps(3);
        RNAnimated.timing(step3Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 2200);

      // Pulse the processing card
      pulseScale.value = withRepeat(withTiming(1.03, { duration: 900 }), -1, true);

      return () => {
        cancelAnimation(pulseScale);
        pulseScale.value = 1;
        cancelAnimation(spinRotation);
        spinRotation.value = 0;
      };
    } else if (screen === 'success') {
      // Checkmark pop-in animation
      checkmarkScale.setValue(0);
      RNAnimated.spring(checkmarkScale, {
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
    } else if (screen === 'error') {
      // Shake the error card on mount
      errorShakeX.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
    }
  }, [screen]);

  // Separate effect: call Edge Function when image URL is set during processing
  useEffect(() => {
    if (screen === 'processing' && uploadedImageUrl) {
      callExtractBetDetailsFunction();
    }
  }, [uploadedImageUrl]);

  const callExtractBetDetailsFunction = async () => {
    if (!uploadedStoragePath || !uploadedImageUrl || !user) {
      setErrorMessage('Failed to process image. Please try again.');
      setScreen('error');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMessage('Authentication failed. Please log in again.');
        setScreen('error');
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      console.log('Calling Edge Function for bet extraction');

      const response = await fetch(
        `${supabaseUrl}/functions/v1/extract-bet-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            image_url: uploadedStoragePath,
          })
        }
      );

      console.log('Edge Function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Edge Function error response:', errorText);
        setErrorMessage('Failed to extract bet details. Please try again.');
        setScreen('error');
        return;
      }

      const result = await response.json();
      console.log('Edge Function response data:', JSON.stringify(result));

      if (result.success) {
        setExtractedData(result.data);
        setScreen('success');
      } else {
        setErrorMessage(result.error || 'Failed to extract bet details. Please try again.');
        setScreen('error');
      }
    } catch (err) {
      console.log('Edge Function error:', err instanceof Error ? err.message : String(err));
      console.error('Error calling Edge Function:', err);
      setErrorMessage('An error occurred while processing your ticket. Please try again.');
      setScreen('error');
    }
  };

  const navigateToManualForm = () => {
    if (!extractedData) {
      router.push('/manual-add-bet');
      return;
    }

    router.push({
      pathname: '/manual-add-bet',
      params: {
        sportsbook: extractedData.sportsbook || '',
        bet_type: extractedData.bet_type || '',
        sport: extractedData.sport || '',
        matchup: extractedData.matchup || '',
        description: extractedData.description || '',
        odds: extractedData.odds || '',
        odds_format: extractedData.odds_format || 'american',
        wager: extractedData.wager?.toString() || '',
        potential_payout: extractedData.potential_payout?.toString() || '',
        status: extractedData.status || 'pending',
        placed_at: extractedData.placed_at || '',
        notes: extractedData.notes || '',
        ticket_image_url: uploadedImageUrl,
        parlay_legs: extractedData.parlay_legs ? JSON.stringify(extractedData.parlay_legs) : '',
        tags: extractedData.tags ? JSON.stringify(extractedData.tags) : '',
        confidence: extractedData.confidence?.toString() || ''
      }
    });
  };

  const uploadImageToStorage = async (uri: string): Promise<{ publicUrl: string; storagePath: string } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const fileName = `${session.user.id}/${Date.now()}.jpg`;
      console.log('DEBUG upload uri:', uri);
      console.log('DEBUG upload fileName:', fileName);

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { data, error } = await supabase.storage
        .from('betting-slips')
        .upload(fileName, formData, {
          contentType: 'multipart/form-data',
          upsert: true,
        });

      console.log('DEBUG upload result data:', data, 'error:', error);

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('betting-slips')
        .getPublicUrl(data.path);

      return { publicUrl: urlData.publicUrl, storagePath: data.path };
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: false,
      exif: false,
    });

    if (result.canceled) return;
    if (!result.assets?.length) return;

    const asset = result.assets[0];

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (asset.type && !allowedTypes.includes(asset.type)) {
      Alert.alert('Invalid File', 'Please upload a JPEG or PNG image.');
      return;
    }

    // Validate file size (10MB max)
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Please upload an image under 10MB.');
      return;
    }

    const uri = asset.uri;
    setScreen('processing');

    const uploadResult = await uploadImageToStorage(uri);
    if (!uploadResult) {
      setErrorMessage('Failed to upload image. Please try again.');
      setScreen('error');
      return;
    }

    setUploadedStoragePath(uploadResult.storagePath);
    setUploadedImageUrl(uploadResult.publicUrl);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please enable camera access in Settings to take photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: false,
      exif: false,
    });

    if (result.canceled) return;
    if (!result.assets?.length) return;

    const asset = result.assets[0];

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (asset.type && !allowedTypes.includes(asset.type)) {
      Alert.alert('Invalid File', 'Please upload a JPEG or PNG image.');
      return;
    }

    // Validate file size (10MB max)
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Please upload an image under 10MB.');
      return;
    }

    const uri = asset.uri;
    setScreen('processing');

    const uploadResult = await uploadImageToStorage(uri);
    if (!uploadResult) {
      setErrorMessage('Failed to upload image. Please try again.');
      setScreen('error');
      return;
    }

    setUploadedStoragePath(uploadResult.storagePath);
    setUploadedImageUrl(uploadResult.publicUrl);
  };

  const handleRetryUpload = () => {
    setErrorMessage('');
    setUploadedImageUrl('');
    setUploadedStoragePath('');
    setExtractedData(null);
    setScreen('default');
  };

  const handleEnterManually = () => {
    router.push({
      pathname: '/manual-add-bet',
      params: {
        ticket_image_url: uploadedImageUrl
      }
    });
  };

  const handleSuccessTap = () => {
    setScreen('default');
  };

  if (screen === 'processing') {
    return (
      <TabScreenTransition>
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Bet</Text>
            <Text style={styles.subtitle}>Scan your betting slips to auto-log your trades</Text>
          </View>

          {/* Processing Card - Centered */}
          <View style={styles.centeredCardContainer}>
            <Animated.View style={[styles.processingCard, pulseStyle]}>
              {/* Spinning Circle with AI Icon */}
              <Animated.View style={[styles.spinningCircle, spinStyle]}>
                <View style={styles.spinningCircleInner} />
              </Animated.View>
              <View style={styles.aiIconContainer}>
                <Ionicons name="sparkles" size={34} color={colors.ai} />
              </View>

              <Text style={styles.processingTitle}>Processing Ticket...</Text>
              <Text style={styles.processingDescription}>
                Extracting wager details from your slip
              </Text>

              {/* Status Steps */}
              <View style={styles.stepsContainer}>
                {visibleSteps >= 1 && (
                  <RNAnimated.View style={[styles.stepRow, { opacity: step1Opacity }]}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Reading ticket image</Text>
                  </RNAnimated.View>
                )}
                {visibleSteps >= 2 && (
                  <RNAnimated.View style={[styles.stepRow, { opacity: step2Opacity }]}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Identifying wager amount</Text>
                  </RNAnimated.View>
                )}
                {visibleSteps >= 3 && (
                  <RNAnimated.View style={[styles.stepRow, { opacity: step3Opacity }]}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Extracting parlay legs</Text>
                  </RNAnimated.View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
      </TabScreenTransition>
    );
  }

  if (screen === 'success') {
    return (
      <TabScreenTransition>
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <AnimatedPressable
          style={styles.fullScreenContainer}
          onPress={handleSuccessTap}
          scaleDown={1}
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
              <RNAnimated.View
                style={[
                  styles.successIconContainer,
                  { transform: [{ scale: checkmarkScale }] },
                ]}
              >
                <View style={styles.checkmarkCircle}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.accent} />
                </View>
              </RNAnimated.View>

              <Text style={styles.successTitle}>Bet Logged Successfully</Text>
              <Text style={styles.successDescription}>
                Your ticket has been added to the ledger.
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      </SafeAreaView>
      </TabScreenTransition>
    );
  }

  if (screen === 'error') {
    return (
      <TabScreenTransition>
      <SafeAreaView style={styles.container}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Bet</Text>
            <Text style={styles.subtitle}>Scan your betting slips to auto-log your trades</Text>
          </View>

          {/* Error Card - Centered */}
          <View style={styles.centeredCardContainer}>
            <Animated.View style={[styles.errorCard, errorShakeStyle]}>
              {/* Error Icon */}
              <View style={styles.errorIconContainer}>
                <Ionicons name="alert-circle" size={40} color={colors.loss} />
              </View>

              <Text style={styles.errorTitle}>Couldn't Extract Bet Details</Text>
              <Text style={styles.errorDescription}>{errorMessage}</Text>

              {/* Buttons */}
              <View style={styles.errorButtonsContainer}>
                <AnimatedPressable
                  style={styles.errorRetryButton}
                  onPress={handleRetryUpload}
                  scaleDown={0.97}
                >
                  <Text style={styles.errorRetryButtonText}>Try Again</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.errorManualButton}
                  onPress={handleEnterManually}
                  scaleDown={0.97}
                >
                  <Text style={styles.errorManualButtonText}>Enter Manually</Text>
                </AnimatedPressable>
              </View>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
      </TabScreenTransition>
    );
  }

  // Default Add Bet Screen
  return (
    <TabScreenTransition>
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <FadeInView delay={0} direction="bottom">
          <View style={styles.header}>
            <Text style={styles.title}>Add Your Bet</Text>
            <Text style={styles.subtitle}>Scan your betting slips to auto-log your trades</Text>
          </View>
        </FadeInView>

        {/* Card 1 - Upload Betting Slip (Primary Action) */}
        <FadeInView delay={80} direction="bottom">
          <AnimatedPressable style={styles.uploadCard} onPress={handlePickImage} scaleDown={0.97}>
            <View style={styles.uploadIconCircle}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.iconSecondary} />
            </View>
            <Text style={styles.uploadCardTitle}>Upload Betting Slip</Text>
            <Text style={styles.uploadCardDescription}>
              Take a screenshot or upload an image of your betting slip
            </Text>
          </AnimatedPressable>
        </FadeInView>

        {/* Card 2 - Take a Photo (Secondary Action) */}
        <FadeInView delay={140} direction="bottom">
          <AnimatedPressable style={styles.compactCard} onPress={handleTakePhoto} scaleDown={0.97}>
            <View style={styles.compactIconCircle}>
              <Ionicons name="camera-outline" size={24} color={colors.iconSecondary} />
            </View>
            <View style={styles.compactTextContainer}>
              <Text style={styles.compactCardTitle}>Take a Photo</Text>
              <Text style={styles.compactCardDescription}>Capture physical betting slip</Text>
            </View>
          </AnimatedPressable>
        </FadeInView>

        {/* Divider Section with OR */}
        <FadeInView delay={180} direction="none">
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerTextContainer}>
              <Text style={styles.dividerText}>OR</Text>
            </View>
          </View>
        </FadeInView>

        {/* Card 3 - Manually Add Your Bet */}
        <FadeInView delay={220} direction="bottom">
          <AnimatedPressable style={styles.compactCard} onPress={() => router.push('/manual-add-bet')} scaleDown={0.97}>
            <View style={styles.compactIconCircle}>
              <Ionicons name="add-outline" size={28} color={colors.iconSecondary} />
            </View>
            <View style={styles.compactTextContainer}>
              <Text style={styles.compactCardTitle}>Manually Add Your Bet</Text>
              <Text style={styles.compactCardDescription}>Enter bet details by hand</Text>
            </View>
          </AnimatedPressable>
        </FadeInView>

        {/* Card 4 - AI-Powered Recognition (Info Card) */}
        <FadeInView delay={280} direction="bottom">
          <View style={styles.infoCard}>
            <Ionicons name="sparkles" size={20} color={colors.ai} style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoCardTitle}>AI-Powered Recognition</Text>
              <Text style={styles.infoCardDescription}>
                Our smart scanner automatically extracts wager amount, odds, parlay legs, and calculates potential payout from your betting slips.
              </Text>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
    </TabScreenTransition>
  );
}

function createStyles(colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
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
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderColor: colors.ai,
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
      color: colors.text,
      marginTop: 24,
      textAlign: 'center',
    },
    processingDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
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
      backgroundColor: colors.ai,
      marginRight: 12,
    },
    stepText: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },

    // Success Card
    successCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.accentBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    successTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    successDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Upload Card (Primary Action - Large Card)
    uploadCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.iconCircleBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    uploadCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    uploadCardDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 12,
    },

    // Compact Card (Take a Photo & Manual Add)
    compactCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.iconCircleBg,
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
      color: colors.text,
      marginBottom: 4,
    },
    compactCardDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
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
      backgroundColor: colors.dividerLine,
    },
    dividerTextContainer: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      zIndex: 1,
    },
    dividerText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textTertiary,
      letterSpacing: 0.5,
    },

    // Info Card (AI-Powered Recognition)
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.text,
      marginBottom: 6,
    },
    infoCardDescription: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
      lineHeight: 19,
    },

    // Error Card
    errorCard: {
      backgroundColor: '#FFF0F0',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#FFE0E0',
      paddingVertical: 40,
      paddingHorizontal: 24,
      alignItems: 'center',
      width: '100%',
      maxWidth: 400,
    },
    errorIconContainer: {
      marginBottom: 20,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    errorDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
    },
    errorButtonsContainer: {
      width: '100%',
      gap: 12,
    },
    errorRetryButton: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorRetryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    errorManualButton: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorManualButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
