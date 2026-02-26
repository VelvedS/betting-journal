import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/context/ThemeContext';

function RootLayoutInner() {
  const { theme, colors } = useTheme();
  const navTheme = theme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bet-details/[id]" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="preferences" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="help-support" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="manual-add-bet" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
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
          <RootLayoutInner />
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
