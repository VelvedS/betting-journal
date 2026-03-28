import React, { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { usePhysicsWorld } from '@/hooks/usePhysicsWorld';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BET_TICKETS = [
  { text: 'Lakers ML', sub: '+145', cat: 'sport', platform: 'fanduel' },
  { text: 'Chiefs -3.5', sub: '4:25 PM', cat: 'sport', platform: 'draftkings' },
  { text: 'Yankees Over 8.5', sub: '+120', cat: 'sport', platform: 'betmgm' },
  { text: 'Bills Moneyline', sub: '8:20 PM', cat: 'sport', platform: 'fanduel' },
  { text: 'Nuggets +4', sub: '+105', cat: 'sport', platform: 'draftkings' },
  { text: 'Eagles Under 48', sub: '1:00 PM', cat: 'sport', platform: 'espnbet' },
  { text: 'Parlay 3-Leg', sub: '+310', cat: 'sport', platform: 'fanduel' },
  { text: 'Celtics ML', sub: '-180', cat: 'sport', platform: 'draftkings' },
  { text: 'Dodgers ML', sub: '10:10 PM', cat: 'sport', platform: 'betmgm' },
  { text: 'Ravens -6.5', sub: '1:00 PM', cat: 'sport', platform: 'espnbet' },
  { text: 'Fed cuts rates June?', sub: 'Yes · 62¢', cat: 'kalshi', platform: 'kalshi' },
  { text: 'BTC above $100K?', sub: 'Yes · 74¢', cat: 'kalshi', platform: 'kalshi' },
  { text: 'Rain in NYC Friday?', sub: 'No · 41¢', cat: 'kalshi', platform: 'polymarket' },
  { text: 'Nvidia earnings beat?', sub: 'Yes · 81¢', cat: 'kalshi', platform: 'kalshi' },
  { text: "S&P 500 up this week?", sub: 'No · 53¢', cat: 'kalshi', platform: 'polymarket' },
  { text: 'Trump wins 2028?', sub: 'Yes · 34¢', cat: 'kalshi', platform: 'polymarket' },
  { text: 'Suns Moneyline', sub: '+140', cat: 'sport', platform: 'fanduel' },
  { text: 'Packers +2.5', sub: '8:15 PM', cat: 'sport', platform: 'draftkings' },
] as const;

const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
  fanduel: { bg: '#1493FF', label: 'FD' },
  draftkings: { bg: '#53D337', label: 'DK' },
  betmgm: { bg: '#C4A44E', label: 'M' },
  espnbet: { bg: '#FF4545', label: 'E' },
  kalshi: { bg: '#6366F1', label: 'K' },
  polymarket: { bg: '#0052FF', label: 'P' },
};

interface PhysicsTicketProps {
  index: number;
  data: { text: string; sub: string; cat: string; platform: string };
  bodyPositions: SharedValue<{ x: number; y: number; angle: number }[]>;
  draggedIndex: SharedValue<number>;
  startDrag: (index: number, x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: (vx: number, vy: number) => void;
  ticketWidth: number;
  ticketHeight: number;
  shouldAnimate: boolean;
}

const STAGGER_MS = 40;
const ENTRANCE_MS = 350;
const ENTRANCE_EASING = Easing.out(Easing.back(1.2));

const PhysicsTicket = React.memo(function PhysicsTicket({
  index,
  data,
  bodyPositions,
  draggedIndex,
  startDrag,
  updateDrag,
  endDrag,
  ticketWidth,
  ticketHeight,
  shouldAnimate,
}: PhysicsTicketProps) {
  const isKalshi = data.cat === 'kalshi';
  const isIOS = Platform.OS === 'ios';
  const badge = PLATFORM_BADGES[data.platform];

  const entrance = useSharedValue(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (shouldAnimate && !hasAnimated.current) {
      hasAnimated.current = true;
      const timer = setTimeout(() => {
        entrance.value = withTiming(1, {
          duration: ENTRANCE_MS,
          easing: ENTRANCE_EASING,
        });
      }, index * STAGGER_MS);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimate]);

  const liftProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const pos = bodyPositions.value[index];
    if (!pos) return { opacity: 0 };
    const ready = pos.x !== 0 || pos.y !== 0;
    const isDragged = draggedIndex.value === index;

    const entranceScale = interpolate(
      entrance.value,
      [0, 1],
      [0.85, 1],
      Extrapolation.CLAMP,
    );
    const lift = liftProgress.value;
    const liftScale = interpolate(lift, [0, 1], [1, 1.07]);

    return {
      opacity: (ready ? 1 : 0) * entrance.value,
      transform: [
        { translateX: pos.x - ticketWidth / 2 },
        { translateY: pos.y - ticketHeight / 2 },
        { rotate: `${pos.angle}rad` },
        { scale: entranceScale * liftScale },
      ],
      zIndex: isDragged || lift > 0.5 ? 10 : 1,
      ...(isIOS
        ? {
            shadowOpacity: interpolate(lift, [0, 1], [0.045, 0.12]),
            shadowRadius: interpolate(lift, [0, 1], [8, 16]),
          }
        : {
            elevation: interpolate(lift, [0, 1], [2, 8]),
          }),
    };
  });

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      liftProgress.value = withSpring(1, { damping: 15, stiffness: 200 });
      runOnJS(startDrag)(index, e.absoluteX, e.absoluteY);
    })
    .onChange((e) => {
      runOnJS(updateDrag)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      liftProgress.value = withSpring(0, { damping: 12, stiffness: 150 });
      runOnJS(endDrag)(e.velocityX, e.velocityY);
    })
    .onFinalize(() => {
      liftProgress.value = withSpring(0, { damping: 12, stiffness: 150 });
      runOnJS(endDrag)(0, 0);
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.ticket, { width: ticketWidth, height: ticketHeight }, animatedStyle]}>
        <View style={[styles.platformBadge, { backgroundColor: badge.bg }]}>
          <Text style={styles.platformBadgeText}>{badge.label}</Text>
        </View>
        <View style={styles.ticketContent}>
          <Text style={styles.ticketText} numberOfLines={1}>
            {data.text}
          </Text>
          <Text style={[styles.ticketSub, isKalshi && styles.ticketSubKalshi]}>
            {data.sub}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

interface PhysicsHeroScreenProps {
  isActive: boolean;
}

export default function PhysicsHeroScreen({ isActive }: PhysicsHeroScreenProps) {
  const {
    bodyPositions,
    draggedIndex,
    startDrag,
    updateDrag,
    endDrag,
    ticketWidth,
    ticketHeight,
  } = usePhysicsWorld(BET_TICKETS.length);

  const ctaOpacity = useSharedValue(0);
  const hasFadedCta = useRef(false);

  useEffect(() => {
    if (isActive && !hasFadedCta.current) {
      hasFadedCta.current = true;
      const delay = (BET_TICKETS.length - 1) * STAGGER_MS + ENTRANCE_MS + 200;
      const timer = setTimeout(() => {
        ctaOpacity.value = withTiming(1, { duration: 400 });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const ctaAnimStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Background glows */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="glow_green" cx="15%" cy="8%" r="35%" fx="15%" fy="8%">
            <Stop offset="0" stopColor="#22c55e" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#22c55e" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow_indigo" cx="88%" cy="6%" r="28%" fx="88%" fy="6%">
            <Stop offset="0" stopColor="#6366f1" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#6366f1" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow_gold" cx="50%" cy="75%" r="30%" fx="50%" fy="75%">
            <Stop offset="0" stopColor="#F5A623" stopOpacity="0.08" />
            <Stop offset="1" stopColor="#F5A623" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow_green)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow_indigo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow_gold)" />
      </Svg>

      {/* Physics tickets */}
      <View style={styles.ticketLayer} pointerEvents="box-none">
        {BET_TICKETS.map((ticket, i) => (
          <PhysicsTicket
            key={i}
            index={i}
            data={ticket}
            bodyPositions={bodyPositions}
            draggedIndex={draggedIndex}
            startDrag={startDrag}
            updateDrag={updateDrag}
            endDrag={endDrag}
            ticketWidth={ticketWidth}
            ticketHeight={ticketHeight}
            shouldAnimate={isActive}
          />
        ))}
      </View>

      {/* Bottom CTA — no buttons, just branding */}
      <Animated.View style={[styles.bottomSection, ctaAnimStyle]}>
        <LinearGradient
          colors={[
            'rgba(248,248,246,0)',
            'rgba(248,248,246,0.55)',
            'rgba(248,248,246,0.85)',
            '#f8f8f6',
          ]}
          locations={[0, 0.3, 0.55, 0.75]}
          style={styles.fadeGradient}
        />

        <View style={styles.ctaContent}>
          {/* Logo + speech bubble */}
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>L</Text>
            </View>
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>Hey you, Ready to find your edge? 🎯</Text>
              <View style={styles.speechTail} />
            </View>
          </View>

          <Text style={styles.brandText}>Ledgr</Text>
          <Text style={styles.headline}>Track Every Bet.</Text>
          <Text style={styles.subtext}>
            Sports, props, and predictions — all in one private journal.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  ticketLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  ticket: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.045,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  platformBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  ticketContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 6,
  },
  ticketSub: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketSubKalshi: {
    color: '#6366f1',
  },

  bottomSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.44,
    zIndex: 10,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  ctaContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingBottom: 90,
    backgroundColor: '#f8f8f6',
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2DC672',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  speechBubble: {
    backgroundColor: '#e8f9ef',
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: SCREEN_WIDTH * 0.65,
    position: 'relative',
  },
  speechText: {
    color: '#1a6b3a',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17,
  },
  speechTail: {
    position: 'absolute',
    bottom: -4,
    left: -2,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopColor: '#e8f9ef',
    borderRightColor: 'transparent',
  },

  brandText: {
    color: '#9B9B9B',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  headline: {
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtext: {
    color: '#6B6B6B',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  },
});
