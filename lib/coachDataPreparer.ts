import { supabase } from '@/lib/supabase';

export type CoachDataSnapshot = {
  totalBets: number;
  record: { wins: number; losses: number };
  roi: number;
  netProfit: number;
  betTypeBreakdown: Array<{ type: string; wins: number; losses: number; roi: number; avgWager: number }>;
  sportBreakdown: Array<{ sport: string; wins: number; losses: number; roi: number }>;
  bookBreakdown: Array<{ book: string; wins: number; losses: number; roi: number }>;
  reasoningBreakdown: Array<{ tag: string; wins: number; losses: number; roi: number }>;
  confidenceBreakdown: Array<{ level: number; wins: number; losses: number; roi: number }>;
  avgWager: number;
  avgOdds: number;
  betsPerWeek: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  currentStreak: { type: 'win' | 'loss'; count: number };
  longestWinStreak: number;
  longestLossStreak: number;
  bettingByDayOfWeek: Array<{ day: string; bets: number; roi: number }>;
  bettingByHour: Array<{ hour: number; bets: number; roi: number }>;
  wagerAfterWin: { avgWager: number; roi: number };
  wagerAfterLoss: { avgWager: number; roi: number };
};

type Bet = {
  id: string;
  status: string;
  wager: number | null;
  potential_payout: number | null;
  odds: number | null;
  odds_format: string | null;
  bet_type: string | null;
  sport: string | null;
  sportsbook: string | null;
  reasoning_tag: string | null;
  confidence_level: number | null;
  placed_at: string | null;
  created_at: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function profit(bet: Bet): number {
  if (bet.status === 'won') return (bet.potential_payout || 0) - (bet.wager || 0);
  if (bet.status === 'lost') return -(bet.wager || 0);
  return 0;
}

function roi(wagered: number, netProfit: number): number {
  return wagered > 0 ? (netProfit / wagered) * 100 : 0;
}

function groupBy<K extends string | number>(
  bets: Bet[],
  keyFn: (b: Bet) => K | null,
): Map<K, Bet[]> {
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

function breakdownStats(bets: Bet[]) {
  const wins = bets.filter((b) => b.status === 'won').length;
  const losses = bets.filter((b) => b.status === 'lost').length;
  const wagered = bets.reduce((s, b) => s + (b.wager || 0), 0);
  const net = bets.reduce((s, b) => s + profit(b), 0);
  return { wins, losses, roi: roi(wagered, net), avgWager: wagered / (bets.length || 1) };
}

export async function prepareCoachData(userId: string): Promise<CoachDataSnapshot> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['won', 'lost'])
    .order('placed_at', { ascending: true });

  if (error) throw error;
  const bets: Bet[] = (data || []) as Bet[];

  const totalBets = bets.length;
  const wins = bets.filter((b) => b.status === 'won').length;
  const losses = bets.filter((b) => b.status === 'lost').length;
  const totalWagered = bets.reduce((s, b) => s + (b.wager || 0), 0);
  const netProfit = bets.reduce((s, b) => s + profit(b), 0);
  const overallRoi = roi(totalWagered, netProfit);

  // ── Bet type breakdown ──
  const byType = groupBy(bets, (b) => b.bet_type);
  const betTypeBreakdown = [...byType.entries()].map(([type, arr]) => ({
    type,
    ...breakdownStats(arr),
  }));

  // ── Sport breakdown ──
  const bySport = groupBy(bets, (b) => b.sport);
  const sportBreakdown = [...bySport.entries()].map(([sport, arr]) => {
    const s = breakdownStats(arr);
    return { sport, wins: s.wins, losses: s.losses, roi: s.roi };
  });

  // ── Sportsbook breakdown ──
  const byBook = groupBy(bets, (b) => b.sportsbook);
  const bookBreakdown = [...byBook.entries()].map(([book, arr]) => {
    const s = breakdownStats(arr);
    return { book, wins: s.wins, losses: s.losses, roi: s.roi };
  });

  // ── Reasoning breakdown ──
  const byReasoning = groupBy(bets, (b) => b.reasoning_tag);
  const reasoningBreakdown = [...byReasoning.entries()].map(([tag, arr]) => {
    const s = breakdownStats(arr);
    return { tag, wins: s.wins, losses: s.losses, roi: s.roi };
  });

  // ── Confidence breakdown ──
  const byConfidence = groupBy(bets, (b) => b.confidence_level);
  const confidenceBreakdown = [...byConfidence.entries()].map(([level, arr]) => {
    const s = breakdownStats(arr);
    return { level: Number(level), wins: s.wins, losses: s.losses, roi: s.roi };
  });

  // ── Average wager ──
  const avgWager = totalWagered / (totalBets || 1);

  // ── Average odds ──
  const oddsValues = bets.filter((b) => b.odds != null).map((b) => b.odds as number);
  const avgOdds = oddsValues.length > 0
    ? oddsValues.reduce((s, o) => s + o, 0) / oddsValues.length
    : 0;

  // ── Bets per week ──
  let betsPerWeek = 0;
  if (bets.length >= 2) {
    const first = new Date(bets[0].placed_at || bets[0].created_at).getTime();
    const last = new Date(bets[bets.length - 1].placed_at || bets[bets.length - 1].created_at).getTime();
    const weeks = Math.max((last - first) / (7 * 24 * 60 * 60 * 1000), 1);
    betsPerWeek = Math.round((totalBets / weeks) * 10) / 10;
  }

  // ── Recent trend ──
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentBets = bets.filter(
    (b) => new Date(b.placed_at || b.created_at).getTime() >= thirtyDaysAgo,
  );
  const recentWagered = recentBets.reduce((s, b) => s + (b.wager || 0), 0);
  const recentProfit = recentBets.reduce((s, b) => s + profit(b), 0);
  const recentRoi = roi(recentWagered, recentProfit);
  const recentTrend: CoachDataSnapshot['recentTrend'] =
    recentRoi > overallRoi + 5 ? 'improving' : recentRoi < overallRoi - 5 ? 'declining' : 'stable';

  // ── Streaks (bets are sorted by placed_at ascending, iterate from end) ──
  let currentStreak: CoachDataSnapshot['currentStreak'] = { type: 'win', count: 0 };
  if (bets.length > 0) {
    const lastStatus = bets[bets.length - 1].status === 'won' ? 'win' : 'loss';
    let count = 0;
    for (let i = bets.length - 1; i >= 0; i--) {
      const s = bets[i].status === 'won' ? 'win' : 'loss';
      if (s === lastStatus) count++;
      else break;
    }
    currentStreak = { type: lastStatus, count };
  }

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let winRun = 0;
  let lossRun = 0;
  for (const b of bets) {
    if (b.status === 'won') {
      winRun++;
      lossRun = 0;
      if (winRun > longestWinStreak) longestWinStreak = winRun;
    } else {
      lossRun++;
      winRun = 0;
      if (lossRun > longestLossStreak) longestLossStreak = lossRun;
    }
  }

  // ── Bets by day of week ──
  const dayMap: Record<string, { wagered: number; profit: number; count: number }> = {};
  for (const d of DAYS) dayMap[d] = { wagered: 0, profit: 0, count: 0 };
  for (const b of bets) {
    const d = DAYS[new Date(b.placed_at || b.created_at).getDay()];
    dayMap[d].count++;
    dayMap[d].wagered += b.wager || 0;
    dayMap[d].profit += profit(b);
  }
  const bettingByDayOfWeek = DAYS.map((day) => ({
    day,
    bets: dayMap[day].count,
    roi: roi(dayMap[day].wagered, dayMap[day].profit),
  }));

  // ── Bets by hour ──
  const hourMap: Record<number, { wagered: number; profit: number; count: number }> = {};
  for (let h = 0; h < 24; h++) hourMap[h] = { wagered: 0, profit: 0, count: 0 };
  for (const b of bets) {
    const h = new Date(b.placed_at || b.created_at).getHours();
    hourMap[h].count++;
    hourMap[h].wagered += b.wager || 0;
    hourMap[h].profit += profit(b);
  }
  const bettingByHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    bets: hourMap[h].count,
    roi: roi(hourMap[h].wagered, hourMap[h].profit),
  })).filter((h) => h.bets > 0);

  // ── Wager after win / after loss ──
  const afterWin: Bet[] = [];
  const afterLoss: Bet[] = [];
  for (let i = 1; i < bets.length; i++) {
    if (bets[i - 1].status === 'won') afterWin.push(bets[i]);
    else if (bets[i - 1].status === 'lost') afterLoss.push(bets[i]);
  }
  const awStats = breakdownStats(afterWin);
  const alStats = breakdownStats(afterLoss);

  return {
    totalBets,
    record: { wins, losses },
    roi: overallRoi,
    netProfit,
    betTypeBreakdown,
    sportBreakdown,
    bookBreakdown,
    reasoningBreakdown,
    confidenceBreakdown,
    avgWager,
    avgOdds,
    betsPerWeek,
    recentTrend,
    currentStreak,
    longestWinStreak,
    longestLossStreak,
    bettingByDayOfWeek,
    bettingByHour,
    wagerAfterWin: { avgWager: awStats.avgWager, roi: awStats.roi },
    wagerAfterLoss: { avgWager: alStats.avgWager, roi: alStats.roi },
  };
}
