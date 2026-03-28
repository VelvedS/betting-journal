import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import AnimatedPressable from '@/components/AnimatedPressable';

const PILL_HEIGHT = 56;
const PILL_RADIUS = 28;
const H_PADDING = 16;
const INDICATOR_W = 48;
const INDICATOR_H = 42;
const INDICATOR_R = 14;
const ADD_BTN_SIZE = 48;

const ICON_MAP: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  stats: ['stats-chart', 'stats-chart-outline'],
  history: ['flash', 'flash-outline'],
  profile: ['person', 'person-outline'],
};

// ─── Tab Button ───────────────────────────────────────────────

function TabButton({
  icon,
  label,
  isFocused,
  activeColor,
  inactiveColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const color = isFocused ? activeColor : inactiveColor;

  return (
    <AnimatedPressable style={styles.tabButton} onPress={onPress} scaleDown={0.85}>
      <Ionicons name={icon} size={18} color={color} />
      <Text
        style={[styles.tabLabel, { color, fontWeight: isFocused ? '600' : '500' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Add Bet Button ───────────────────────────────────────────

function AddBetCenterButton({ onPress }: { onPress: () => void }) {
  const glowOpacity = useSharedValue(0.15);
  const glowRadius = useSharedValue(12);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1500 }),
        withTiming(0.15, { duration: 1500 }),
      ),
      -1,
      true,
    );
    glowRadius.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 1500 }),
        withTiming(12, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
    shadowRadius: glowRadius.value,
  }));

  return (
    <View style={styles.tabButton}>
      <Animated.View
        style={[
          styles.addBetGlow,
          glowStyle,
          { shadowColor: '#2DC672', shadowOffset: { width: 0, height: 0 } },
        ]}
      >
        <AnimatedPressable style={styles.addBetCircle} onPress={onPress} scaleDown={0.88}>
          <Ionicons name="add" size={26} color="#2DC672" />
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

// ─── Liquid Glass Tab Bar ─────────────────────────────────────

export default function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  const containerWidthRef = useRef(0);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(INDICATOR_W);
  const indicatorHeight = useSharedValue(INDICATOR_H);
  const indicatorBR = useSharedValue(INDICATOR_R);

  const isCenter = state.routes[state.index]?.name === 'add-bet';
  const springCfg = { damping: 20, stiffness: 200, mass: 0.8 };

  useEffect(() => {
    if (containerWidthRef.current > 0) {
      const tabWidth = containerWidthRef.current / state.routes.length;
      const targetW = isCenter ? ADD_BTN_SIZE : INDICATOR_W;
      indicatorX.value = withSpring(
        tabWidth * state.index + (tabWidth - targetW) / 2,
        springCfg,
      );
      indicatorWidth.value = withSpring(targetW, springCfg);
      indicatorHeight.value = withSpring(isCenter ? ADD_BTN_SIZE : INDICATOR_H, springCfg);
      indicatorBR.value = withSpring(isCenter ? ADD_BTN_SIZE / 2 : INDICATOR_R, springCfg);
    }
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
    height: indicatorHeight.value,
    borderRadius: indicatorBR.value,
    top: (PILL_HEIGHT - indicatorHeight.value) / 2,
  }));

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      containerWidthRef.current = w;
      const tabWidth = w / state.routes.length;
      const targetW = isCenter ? ADD_BTN_SIZE : INDICATOR_W;
      indicatorX.value = tabWidth * state.index + (tabWidth - targetW) / 2;
      indicatorWidth.value = targetW;
      indicatorHeight.value = isCenter ? ADD_BTN_SIZE : INDICATOR_H;
      indicatorBR.value = isCenter ? ADD_BTN_SIZE / 2 : INDICATOR_R;
    },
    [state.routes.length, state.index, isCenter],
  );

  return (
    <View style={styles.outer} pointerEvents="box-none">
      {/* Shadow wrapper (no overflow: hidden so shadow renders) */}
      <View
        style={[
          styles.pillShadow,
          {
            marginHorizontal: H_PADDING,
            marginBottom: bottomPadding,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.4 : 0.1,
            shadowRadius: 24,
            elevation: 20,
          },
        ]}
      >
        {/* Clip wrapper for blur + glass layers */}
        <View
          style={[
            styles.pillClip,
            { borderWidth: 0 },
          ]}
        >
          {/* Blur base layer */}
          <BlurView
            intensity={45}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />

          {/* Glass tint overlay */}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.navGlass }]}
          />

          {/* Tab buttons row */}
          <View style={styles.tabRow} onLayout={handleLayout}>
            {/* Sliding active indicator */}
            <Animated.View
              style={[
                styles.indicator,
                { backgroundColor: colors.navActiveIndicator },
                indicatorStyle,
              ]}
            />

            {state.routes.map((route, index) => {
              const isFocused = state.index === index;

              if (route.name === 'add-bet') {
                return (
                  <AddBetCenterButton
                    key={route.key}
                    onPress={() => navigation.navigate(route.name)}
                  />
                );
              }

              const [activeIcon, inactiveIcon] = ICON_MAP[route.name] ?? [
                'help-circle' as keyof typeof Ionicons.glyphMap,
                'help-circle-outline' as keyof typeof Ionicons.glyphMap,
              ];
              const label =
                descriptors[route.key].options.title ?? route.name;

              return (
                <TabButton
                  key={route.key}
                  icon={isFocused ? activeIcon : inactiveIcon}
                  label={label}
                  isFocused={isFocused}
                  activeColor={colors.tabActive}
                  inactiveColor={colors.tabInactive}
                  onPress={() => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pillShadow: {
    borderRadius: PILL_RADIUS,
  },
  pillClip: {
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabLabel: {
    fontSize: 9,
    marginTop: 2,
  },
  addBetGlow: {
    borderRadius: ADD_BTN_SIZE / 2,
  },
  addBetCircle: {
    width: ADD_BTN_SIZE,
    height: ADD_BTN_SIZE,
    borderRadius: ADD_BTN_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(45, 198, 114, 0.4)',
    backgroundColor: 'rgba(45, 198, 114, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
