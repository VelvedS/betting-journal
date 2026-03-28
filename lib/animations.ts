import { Easing } from 'react-native';
import { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

// ── Screen transition (350ms smooth bezier) ──
export const screenTransition: WithTimingConfig = {
  duration: 350,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// ── Staggered entry spring (for FadeInView) ──
export const staggeredEntry: WithSpringConfig = {
  damping: 15,
  stiffness: 100,
  mass: 0.8,
};

// ── Button press scale (100ms fast snap) ──
export const buttonPress: WithTimingConfig = {
  duration: 100,
  easing: Easing.out(Easing.quad),
};

// ── Count-up number (800ms ease-out cubic) ──
export const countUp = {
  duration: 800,
  easing: Easing.out(Easing.cubic),
};

// ── Slide up / fade in ──
export const slideUp: WithTimingConfig = {
  duration: 300,
  easing: Easing.out(Easing.quad),
};

export const fadeIn: WithTimingConfig = {
  duration: 250,
  easing: Easing.out(Easing.quad),
};

// ── Shared spring config for press interactions ──
export const springConfig: WithSpringConfig = {
  damping: 12,
  stiffness: 100,
  mass: 0.8,
};

// ── Pulse (for live / pending indicators) ──
export const pulseConfig: WithTimingConfig = {
  duration: 1500,
  easing: Easing.inOut(Easing.sin),
};

// ── Stagger delay helper ──
export function getStaggerDelay(index: number, base = 60): number {
  return index * base;
}
