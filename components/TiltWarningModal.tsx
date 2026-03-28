import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import * as Haptics from 'expo-haptics';
import { TiltAlert, logTiltAlert } from '@/lib/tiltDetection';
import { useMemo } from 'react';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SEVERITY_COLORS: Record<string, string> = {
  low: '#F59E0B',
  moderate: '#F97316',
  high: '#EF4444',
};

interface TiltWarningModalProps {
  visible: boolean;
  alert: TiltAlert;
  userId: string;
  onProceed: () => void;
  onTakeBreak: () => void;
}

export default function TiltWarningModal({
  visible,
  alert,
  userId,
  onProceed,
  onTakeBreak,
}: TiltWarningModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accentColor = SEVERITY_COLORS[alert.severity] || '#F59E0B';

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 150 });
    }
  }, [visible]);

  const dismiss = (callback: () => void) => {
    overlayOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
      runOnJS(callback)();
    });
  };

  const handleProceed = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    logTiltAlert(userId, alert, true);
    dismiss(onProceed);
  };

  const handleBreak = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    logTiltAlert(userId, alert, false);
    dismiss(onTakeBreak);
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none">
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBreak} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Severity accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

          <View style={styles.content}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: accentColor + '1A' }]}>
              <Ionicons name="alert-circle" size={36} color={accentColor} />
            </View>

            {/* Title */}
            <Text style={styles.title}>Hold Up</Text>

            {/* Message */}
            <Text style={styles.message}>{alert.message}</Text>

            {/* Suggestion */}
            <Text style={styles.suggestion}>{alert.suggestion}</Text>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, styles.outlineButton, { borderColor: accentColor }]}
                onPress={handleProceed}
              >
                <Text style={[styles.outlineButtonText, { color: accentColor }]}>
                  I'm Good — Place Bet
                </Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.filledButton, { backgroundColor: accentColor }]}
                onPress={handleBreak}
              >
                <Text style={styles.filledButtonText}>Take a Break</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    accentBar: {
      height: 4,
      width: '100%',
    },
    content: {
      padding: 24,
      paddingBottom: 40,
      alignItems: 'center',
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 8,
    },
    suggestion: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineButton: {
      borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
    outlineButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    filledButton: {},
    filledButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
