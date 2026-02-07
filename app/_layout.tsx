import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const AUTH_SCREENS = ['index', 'signup'];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const currentScreen = segments[0] || 'index';
    const onAuthScreen = AUTH_SCREENS.includes(currentScreen as string);

    if (!session && !onAuthScreen) {
      // Not signed in but trying to access protected routes
      hasRedirected.current = true;
      router.replace('/');
    } else if (session && onAuthScreen && !hasRedirected.current) {
      // Signed in but on login/signup screen
      hasRedirected.current = true;
      router.replace('/(tabs)');
    } else {
      hasRedirected.current = false;
    }
  }, [session, isLoading]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGuard>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="bet-details/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="account-settings" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="preferences" options={{ headerShown: false }} />
            <Stack.Screen name="help-support" options={{ headerShown: false }} />
            <Stack.Screen name="manual-add-bet" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        </AuthGuard>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
