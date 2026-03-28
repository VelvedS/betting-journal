import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { shouldSendNotification } from '@/lib/notifications';

export interface PatternAlert {
  type: string;
  priority: 'low' | 'medium' | 'high';
  message: string;
  icon: string;
  timestamp?: string;
}

type Bet = {
  id: string;
  status: string;
  wager: number | null;
  potential_payout: number | null;
  bet_type: string | null;
  sport: string | null;
  placed_at: string | null;
  created_at: string;
};

function betProfit(bet: Bet): number {
  if (bet.status === 'won') return (bet.potential_payout || 0) - (bet.wager || 0);
  if (bet.status === 'lost') return -(bet.wager || 0);
  return 0;
}

function groupBy<K extends string>(bets: Bet[], keyFn: (b: Bet) => K | null): Map<K, Bet[]> {
  const map = new Map<K, Bet[]>();
  for (const b of bets) {
    const k = keyFn(b);
    if (k == null) continue;
    const arr = map.get(k) || [];
    arr.push(b);
    map.set(k, arr);
  }
  return map;
}

// ── Pattern 1: Cold Streak Warning ──
function detectColdStreak(bets: Bet[]): PatternAlert[] {
  const alerts: PatternAlert[] = [];
  const categories = [
    ...Array.from(groupBy(bets, (b) => b.sport).entries()).map(([key, arr]) => ({ label: key, bets: arr })),
    ...Array.from(groupBy(bets, (b) => b.bet_type).entries()).map(([key, arr]) => ({ label: key, bets: arr })),
  ];

  for (const cat of categories) {
    if (cat.bets.length < 5) continue;
    const sorted = [...cat.bets].sort(
      (a, b) => new Date(a.placed_at || a.created_at).getTime() - new Date(b.placed_at || b.created_at).getTime(),
    );

    // Count consecutive losses from the end
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].status === 'lost') streak++;
      else break;
    }

    if (streak >= 4) {
      const wins = sorted.filter((b) => b.status === 'won').length;
      const total = sorted.length;
      const winRate = Math.round((wins / total) * 100);
      if (winRate > 45) {
        alerts.push({
          type: 'cold_streak',
          priority: 'medium',
          message: `You're 0-${streak} on ${cat.label} recently. Your all-time hit rate here is ${winRate}% — this looks like a cold stretch, not a broken strategy.`,
          icon: 'snow-outline',
        });
      }
    }
  }
  return alerts;
}

// ── Pattern 2: Hot Streak Discipline ──
function detectHotStreak(bets: Bet[]): PatternAlert[] {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.placed_at || a.created_at).getTime() - new Date(b.placed_at || b.created_at).getTime(),
  );

  // Current win streak from the end
  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status === 'won') currentStreak++;
    else break;
  }

  if (currentStreak < 5) return [];

  // Calculate average win streak length
  const streaks: number[] = [];
  let run = 0;
  for (const b of sorted) {
    if (b.status === 'won') {
      run++;
    } else {
      if (run > 0) streaks.push(run);
      run = 0;
    }
  }
  // Don't push the current streak into history for average calculation
  const avg = streaks.length > 0
    ? Math.round((streaks.reduce((s, v) => s + v, 0) / streaks.length) * 10) / 10
    : 0;

  return [{
    type: 'hot_streak',
    priority: 'medium',
    message: `${currentStreak}-win streak! Your average streak is ${avg}. Stay sharp — don't let confidence turn into carelessness.`,
    icon: 'flame-outline',
  }];
}

// ── Pattern 3: Market Strength Discovery ──
async function detectMarketStrength(bets: Bet[]): Promise<PatternAlert[]> {
  const alerts: PatternAlert[] = [];
  const bySport = groupBy(bets, (b) => b.sport);

  for (const [sport, arr] of bySport.entries()) {
    if (arr.length < 10) continue;
    const wagered = arr.reduce((s, b) => s + (b.wager || 0), 0);
    const net = arr.reduce((s, b) => s + betProfit(b), 0);
    const roi = wagered > 0 ? (net / wagered) * 100 : 0;

    if (roi > 15) {
      const key = `pattern_shown_market_strength_${sport}`;
      const shown = await AsyncStorage.getItem(key);
      if (shown) continue;
      await AsyncStorage.setItem(key, 'true');
      alerts.push({
        type: 'market_strength',
        priority: 'low',
        message: `You're +${Math.round(roi)}% ROI on ${sport} over ${arr.length} bets. This might be where your real edge is.`,
        icon: 'trending-up-outline',
      });
    }
  }
  return alerts;
}

// ── Pattern 4: Losing Market Warning ──
async function detectLosingMarket(bets: Bet[]): Promise<PatternAlert[]> {
  const alerts: PatternAlert[] = [];
  const byType = groupBy(bets, (b) => b.bet_type);

  for (const [betType, arr] of byType.entries()) {
    if (arr.length < 10) continue;
    const wagered = arr.reduce((s, b) => s + (b.wager || 0), 0);
    const net = arr.reduce((s, b) => s + betProfit(b), 0);
    const roi = wagered > 0 ? (net / wagered) * 100 : 0;

    if (roi < -20) {
      const key = `pattern_shown_losing_market_${betType}`;
      const shown = await AsyncStorage.getItem(key);
      if (shown) continue;
      await AsyncStorage.setItem(key, 'true');
      const label = betType === 'over_under' ? 'Over/Under' : betType.charAt(0).toUpperCase() + betType.slice(1);
      alerts.push({
        type: 'losing_market',
        priority: 'high',
        message: `Your ${label} bets are at ${Math.round(roi)}% ROI over ${arr.length} bets. Consider reducing exposure or adjusting your approach.`,
        icon: 'warning-outline',
      });
    }
  }
  return alerts;
}

// ── Pattern 5: Comeback Alert ──
function detectComeback(bets: Bet[], triggeredByBetId: string): PatternAlert[] {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.placed_at || a.created_at).getTime() - new Date(b.placed_at || b.created_at).getTime(),
  );

  const idx = sorted.findIndex((b) => b.id === triggeredByBetId);
  if (idx < 1) return [];

  const triggeredBet = sorted[idx];
  if (triggeredBet.status !== 'won') return [];

  // Count consecutive losses before this win
  let lossStreak = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (sorted[i].status === 'lost') lossStreak++;
    else break;
  }

  if (lossStreak < 3) return [];

  return [{
    type: 'comeback',
    priority: 'low',
    message: `Back in the win column after ${lossStreak} straight losses. The Iceman badge energy.`,
    icon: 'shield-checkmark-outline',
  }];
}

// ── Pattern 6: Bankroll Milestone ──
async function detectMilestone(bets: Bet[]): Promise<PatternAlert[]> {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.placed_at || a.created_at).getTime() - new Date(b.placed_at || b.created_at).getTime(),
  );

  const totalProfit = sorted.reduce((s, b) => s + betProfit(b), 0);
  if (totalProfit <= 0) return [];

  const thresholds = [100, 500, 1000, 5000, 10000];
  const alerts: PatternAlert[] = [];

  for (const amount of thresholds) {
    if (totalProfit >= amount) {
      const key = `milestone_shown_${amount}`;
      const shown = await AsyncStorage.getItem(key);
      if (shown) continue;
      await AsyncStorage.setItem(key, 'true');
      alerts.push({
        type: 'milestone',
        priority: 'high',
        message: `You just crossed $${amount.toLocaleString()} in lifetime profit. That's real.`,
        icon: 'trophy-outline',
      });
    }
  }
  return alerts;
}

// ── Main Detection Function ──
export async function detectPatterns(userId: string, triggeredByBetId: string): Promise<PatternAlert[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('id, status, wager, potential_payout, bet_type, sport, placed_at, created_at')
    .eq('user_id', userId)
    .in('status', ['won', 'lost'])
    .order('placed_at', { ascending: true });

  if (error || !data || data.length < 2) return [];
  const bets = data as Bet[];

  // Run all pattern detectors
  const [coldStreak, hotStreak, marketStrength, losingMarket, comeback, milestone] = await Promise.all([
    Promise.resolve(detectColdStreak(bets)),
    Promise.resolve(detectHotStreak(bets)),
    detectMarketStrength(bets),
    detectLosingMarket(bets),
    Promise.resolve(detectComeback(bets, triggeredByBetId)),
    detectMilestone(bets),
  ]);

  const alerts: PatternAlert[] = [
    ...coldStreak,
    ...hotStreak,
    ...marketStrength,
    ...losingMarket,
    ...comeback,
    ...milestone,
  ];

  if (alerts.length === 0) return [];

  // ── Store alerts in AsyncStorage ──
  const now = new Date().toISOString();
  const timestamped = alerts.map((a) => ({ ...a, timestamp: now }));

  const existingRaw = await AsyncStorage.getItem('recent_alerts');
  const existing: PatternAlert[] = existingRaw ? JSON.parse(existingRaw) : [];
  const updated = [...timestamped, ...existing].slice(0, 30);
  await AsyncStorage.setItem('recent_alerts', JSON.stringify(updated));

  // ── Rate-limited push notification ──
  const today = now.split('T')[0];
  const countKey = `alert_count_${today}`;
  const countRaw = await AsyncStorage.getItem(countKey);
  const count = countRaw ? parseInt(countRaw, 10) : 0;

  if (count < 3) {
    const canSend = await shouldSendNotification(userId);
    if (canSend) {
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const top = [...timestamped].sort(
        (a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0),
      )[0];

      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: userId,
          title: 'Pattern Detected',
          body: top.message,
          data: { type: 'patternAlert' },
        },
      }).catch(() => {});

      await AsyncStorage.setItem(countKey, String(count + 1));
    }
  }

  return alerts;
}
