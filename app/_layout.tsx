import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/context/ThemeContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { scheduleWeeklyRecap } from '@/lib/weeklyRecap';

function RootLayoutInner() {
  const { theme, colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  // Schedule weekly recap notification on each app open
  useEffect(() => {
    if (user?.id) {
      scheduleWeeklyRecap(user.id).catch((err) =>
        console.warn('[WeeklyRecap] Schedule error:', err)
      );
    }
  }, [user?.id]);

  // Handle notification tap — navigate to relevant screen
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.type === 'betResults' && data?.betId) {
        router.push(`/bet-details/${data.betId}` as any);
      } else if (data?.type === 'achievements') {
        router.push('/(tabs)/history');
      } else if (data?.type === 'patternAlert') {
        router.push('/insights');
      } else if (data?.type === 'weeklyRecap') {
        router.push('/(tabs)/stats');
      } else if (data?.type === 'aiCoach') {
        router.push('/ai-coach');
      } else {
        router.push('/(tabs)');
      }
    });

    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Notification] Received in foreground:', notification.request.content.title);
    });

    return () => {
      subscription.remove();
      foregroundSubscription.remove();
    };
  }, [router]);

  const navTheme = theme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bet-details/[id]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="preferences" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="help-support" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="manual-add-bet" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ai-coach" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="insights" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="season-report" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="what-if" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colors.statusBar} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <RootLayoutInner />
          </PreferencesProvider>
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
