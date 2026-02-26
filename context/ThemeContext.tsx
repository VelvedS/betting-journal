import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ThemeColors } from '@/constants/theme';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const STORAGE_KEY = '@app_theme';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  colors: lightColors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
      setLoaded(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark: theme === 'dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
