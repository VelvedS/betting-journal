import { Platform } from 'react-native';

export type ThemeColors = {
  // Page backgrounds
  background: string;
  // Card / surface backgrounds
  surface: string;
  surfaceElevated: string;
  // Borders
  border: string;
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  // Icon circle fill
  iconCircleBg: string;
  iconSecondary: string;
  // Tab bar
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  // Filter chip / segment pills
  chipBg: string;
  chipText: string;
  chipActiveBg: string;
  chipActiveText: string;
  // Text inputs
  input: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
  // Primary action button (FAB, submit, etc.)
  buttonPrimary: string;
  buttonPrimaryText: string;
  // Divider / HR lines
  dividerLine: string;
  // Status bar style
  statusBar: 'dark' | 'light';
};

export const lightColors: ThemeColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E8E8E8',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  iconCircleBg: '#F0F0F0',
  iconSecondary: '#6B6B6B',
  tabBar: '#FFFFFF',
  tabActive: '#1A1A2E',
  tabInactive: '#B0B0B0',
  chipBg: '#F0F0F0',
  chipText: '#1A1A1A',
  chipActiveBg: '#1A1A1A',
  chipActiveText: '#FFFFFF',
  input: '#FFFFFF',
  inputBorder: '#E5E5E5',
  inputText: '#1A1A1A',
  placeholder: '#9B9B9B',
  buttonPrimary: '#1A1A2E',
  buttonPrimaryText: '#FFFFFF',
  dividerLine: '#E0E0E0',
  statusBar: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#111111',
  surface: '#1C1C1C',
  surfaceElevated: '#252525',
  border: '#2C2C2C',
  text: '#F0F0F0',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  iconCircleBg: '#2A2A2A',
  iconSecondary: '#888888',
  tabBar: '#161616',
  tabActive: '#F0F0F0',
  tabInactive: '#555555',
  chipBg: '#2A2A2A',
  chipText: '#A0A0A0',
  chipActiveBg: '#EBEBEB',
  chipActiveText: '#111111',
  input: '#1C1C1C',
  inputBorder: '#333333',
  inputText: '#F0F0F0',
  placeholder: '#555555',
  buttonPrimary: '#EBEBEB',
  buttonPrimaryText: '#111111',
  dividerLine: '#2C2C2C',
  statusBar: 'light',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
