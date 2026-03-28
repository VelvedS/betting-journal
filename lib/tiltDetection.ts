import { supabase } from './supabase';

export interface TiltAlert {
  reason: 'rapid_betting_after_loss' | 'loss_chasing_wager_increase' | 'late_night_betting';
  severity: 'low' | 'moderate' | 'high';
  betsInWindow: number;
  windowMinutes: number;
  recentLosses: number;
  historicalWinRateInPattern: number | null;
  message: string;
  suggestion: string;
}

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

async function getRecentAlerts(
  userId: string,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('tilt_alerts')
    .select('reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const latest: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    if (!latest[row.reason]) latest[row.reason] = row.created_at;
  });
  return latest;
}

function isOnCooldown(
  recentAlerts: Record<string, string>,
  reason: string,
): boolean {
  const last = recentAlerts[reason];
  if (!last) return false;
  return Date.now() - new Date(last).getTime() < COOLDOWN_MS;
}

// ── Trigger 1: Rapid Betting After Losses ──

async function checkRapidBetting(
  userId: string,
): Promise<TiltAlert | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recentBets } = await supabase
    .from('bets')
    .select('id, created_at')
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  const betsInWindow = recentBets?.length || 0;
  if (betsInWindow < 3) return null;

  const { data: lastSettled } = await supabase
    .from('bets')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['won', 'lost'])
    .order('created_at', { ascending: false })
    .limit(5);

  const losses = (lastSettled || []).filter((b: any) => b.status === 'lost').length;
  if (losses < 2) return null;

  // Historical win rate for bets placed within 60 min of another bet
  const { data: allBets } = await supabase
    .from('bets')
    .select('status, created_at')
    .eq('user_id', userId)
    .in('status', ['won', 'lost'])
    .order('created_at', { ascending: false })
    .limit(100);

  let patternWins = 0;
  let patternTotal = 0;
  const sorted = (allBets || []).sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
    if (gap <= 60 * 60 * 1000) {
      patternTotal++;
      if (sorted[i].status === 'won') patternWins++;
    }
  }
  const histRate = patternTotal >= 5 ? Math.round((patternWins / patternTotal) * 100) : null;

  const msg = histRate != null
    ? `You've placed ${betsInWindow} bets in the last hour after a rough stretch. Take a breath \u2014 your bets placed in this pattern historically hit at ${histRate}%.`
    : `You've placed ${betsInWindow} bets in the last hour after a rough stretch. Slow down and make sure each bet is intentional.`;

  return {
    reason: 'rapid_betting_after_loss',
    severity: 'moderate',
    betsInWindow,
    windowMinutes: 60,
    recentLosses: losses,
    historicalWinRateInPattern: histRate,
    message: msg,
    suggestion: 'Try waiting 30 minutes before placing your next bet.',
  };
}

// ── Trigger 2: Loss Chasing (Wager Escalation) ──

async function checkLossChasing(
  userId: string,
  currentWager: number,
): Promise<TiltAlert | null> {
  if (currentWager <= 0) return null;

  const { data: recentBets } = await supabase
    .from('bets')
    .select('wager, status, potential_payout')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!recentBets || recentBets.length < 3) return null;

  const avgWager =
    recentBets.reduce((s: number, b: any) => s + (b.wager || 0), 0) / recentBets.length;
  if (avgWager <= 0) return null;

  const multiplier = currentWager / avgWager;
  if (multiplier < 2) return null;

  // Last settled bet must be a loss
  const lastSettled = recentBets.find((b: any) => b.status === 'won' || b.status === 'lost');
  if (!lastSettled || lastSettled.status !== 'lost') return null;

  // Historical ROI when increasing stakes after a loss
  let chasingProfit = 0;
  let chasingWagered = 0;
  for (let i = 0; i < recentBets.length - 1; i++) {
    const cur = recentBets[i];
    const prev = recentBets[i + 1];
    if (
      prev.status === 'lost' &&
      (cur.wager || 0) >= (prev.wager || 0) * 1.5 &&
      (cur.status === 'won' || cur.status === 'lost')
    ) {
      chasingWagered += cur.wager || 0;
      chasingProfit += cur.status === 'won'
        ? (cur.potential_payout || cur.wager * 1.9) - cur.wager
        : -(cur.wager || 0);
    }
  }
  const chasingRoi = chasingWagered > 0 ? Math.round((chasingProfit / chasingWagered) * 100) : null;
  const multiplierStr = multiplier.toFixed(1);

  const msg = chasingRoi != null
    ? `This wager is ${multiplierStr}x your usual size, right after a loss. Chasing rarely works \u2014 your average ROI when increasing stakes after losses is ${chasingRoi}%.`
    : `This wager is ${multiplierStr}x your usual size, right after a loss. Chasing losses rarely ends well.`;

  return {
    reason: 'loss_chasing_wager_increase',
    severity: 'high',
    betsInWindow: recentBets.length,
    windowMinutes: 0,
    recentLosses: recentBets.filter((b: any) => b.status === 'lost').length,
    historicalWinRateInPattern: chasingRoi,
    message: msg,
    suggestion: 'Consider sizing this bet at your normal amount instead.',
  };
}

// ── Trigger 3: Late Night Betting ──

async function checkLateNight(
  userId: string,
): Promise<TiltAlert | null> {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 4) return null; // Only 12 AM – 3:59 AM

  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const { data: sessionBets } = await supabase
    .from('bets')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .gte('created_at', todayMidnight.toISOString())
    .order('created_at', { ascending: false });

  const betsInSession = (sessionBets || []).filter((b: any) => {
    const h = new Date(b.created_at).getHours();
    return h < 4;
  });

  if (betsInSession.length < 2) return null;

  // Historical win rate for bets placed midnight–4 AM
  const { data: allBets } = await supabase
    .from('bets')
    .select('status, created_at')
    .eq('user_id', userId)
    .in('status', ['won', 'lost'])
    .order('created_at', { ascending: false })
    .limit(200);

  let lateWins = 0;
  let lateTotal = 0;
  (allBets || []).forEach((b: any) => {
    const h = new Date(b.created_at).getHours();
    if (h < 4) {
      lateTotal++;
      if (b.status === 'won') lateWins++;
    }
  });
  const histRate = lateTotal >= 5 ? Math.round((lateWins / lateTotal) * 100) : null;

  const msg = histRate != null
    ? `Late-night bets tend to be less disciplined. Your win rate between midnight and 4 AM is ${histRate}%.`
    : `Late-night bets tend to be less disciplined. Sleep on it \u2014 the line will still be there tomorrow.`;

  return {
    reason: 'late_night_betting',
    severity: 'low',
    betsInWindow: betsInSession.length,
    windowMinutes: hour * 60 + now.getMinutes(),
    recentLosses: 0,
    historicalWinRateInPattern: histRate,
    message: msg,
    suggestion: 'Save this bet for tomorrow when you can think it through clearly.',
  };
}

// ── Main Entry Point ──

export async function checkForTilt(
  userId: string,
  currentWager: number = 0,
): Promise<TiltAlert | null> {
  const recentAlerts = await getRecentAlerts(userId);

  // Check in order of severity: high → moderate → low
  if (!isOnCooldown(recentAlerts, 'loss_chasing_wager_increase')) {
    const result = await checkLossChasing(userId, currentWager);
    if (result) return result;
  }

  if (!isOnCooldown(recentAlerts, 'rapid_betting_after_loss')) {
    const result = await checkRapidBetting(userId);
    if (result) return result;
  }

  if (!isOnCooldown(recentAlerts, 'late_night_betting')) {
    const result = await checkLateNight(userId);
    if (result) return result;
  }

  return null;
}

// ── Log alert to DB ──

export async function logTiltAlert(
  userId: string,
  alert: TiltAlert,
  wasDismissed: boolean,
): Promise<void> {
  await supabase.from('tilt_alerts').insert({
    user_id: userId,
    reason: alert.reason,
    severity: alert.severity,
    was_dismissed: wasDismissed,
    message: alert.message,
    created_at: new Date().toISOString(),
  });
}
