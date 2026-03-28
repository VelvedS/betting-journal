import { supabase } from './supabase';
import { Season, SEASONS } from './seasonDefinitions';

export interface SeasonReport {
  season: Season;
  totalBets: number;
  record: { wins: number; losses: number; pushes: number };
  winRate: number;
  roi: number;
  netProfit: number;
  totalWagered: number;

  biggestWin: { amount: number; description: string; date: string } | null;
  worstLoss: { amount: number; description: string; date: string } | null;
  longestWinStreak: number;
  longestLossStreak: number;

  bestBetType: { type: string; roi: number; record: string } | null;
  worstBetType: { type: string; roi: number; record: string } | null;
  bestSportsbook: { name: string; roi: number } | null;

  averageWager: number;
  averageOdds: string;
  betsPerWeek: number;
  favoriteDayOfWeek: string;

  bestReasoningTag: { tag: string; roi: number } | null;
  averageConfidence: number | null;

  personalityLabel: string;
  personalityDescription: string;

  previousSeasonROI: number | null;
  roiChange: number | null;
}

// ── Helpers ──

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((groups, item) => {
    const val = item[key];
    if (val) {
      if (!groups[val]) groups[val] = [];
      groups[val].push(item);
    }
    return groups;
  }, {} as Record<string, any[]>);
}

function parseAmericanOdds(odds: string | number | null | undefined): number | null {
  if (odds === null || odds === undefined) return null;
  const str = String(odds).trim().replace(/^\+/, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function formatAverageOdds(avg: number): string {
  const rounded = Math.round(avg);
  return rounded >= 0 ? `+${rounded}` : String(rounded);
}

function findPreviousSeason(current: Season): Season | null {
  return (
    SEASONS
      .filter((s) => s.sport === current.sport && s.endDate < current.startDate)
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] || null
  );
}

function matchesSport(betSport: string | null, seasonSport: string): boolean {
  if (!betSport) return false;
  return betSport.toLowerCase().includes(seasonSport.toLowerCase());
}

function getBetDateStr(bet: any): string {
  return ((bet.placed_at || bet.created_at) ?? '').split('T')[0];
}

function filterSeasonBets(bets: any[], season: Season): any[] {
  return bets.filter((b) => {
    if (!matchesSport(b.sport, season.sport)) return false;
    const date = getBetDateStr(b);
    return date >= season.startDate && date <= season.endDate;
  });
}

function computeGroupROI(bets: any[]): number {
  const wagered = bets.reduce((s, b) => s + (b.wager || 0), 0);
  const won = bets
    .filter((b) => b.status === 'won')
    .reduce((s, b) => s + ((b.potential_payout || 0) - (b.wager || 0)), 0);
  const lost = bets
    .filter((b) => b.status === 'lost')
    .reduce((s, b) => s + (b.wager || 0), 0);
  return wagered > 0 ? ((won - lost) / wagered) * 100 : 0;
}

function computePersonality(
  roi: number,
  avgConfidence: number | null,
  betsPerWeek: number,
  bestReasoningTag: { tag: string; roi: number } | null,
  worstBetType: { type: string; roi: number; record: string } | null
): { personalityLabel: string; personalityDescription: string } {
  if (roi > 20 && avgConfidence !== null && avgConfidence >= 4) {
    return {
      personalityLabel: 'The Sharp',
      personalityDescription:
        'Precise, confident, and profitable. You trust your reads and they pay off.',
    };
  }
  if (roi > 20 && betsPerWeek < 3) {
    return {
      personalityLabel: 'The Sniper',
      personalityDescription:
        'Few bets, high accuracy. You wait for the right shot and take it.',
    };
  }
  if (roi > 20 && betsPerWeek >= 5) {
    return {
      personalityLabel: 'The Grinder',
      personalityDescription:
        'Volume and edge. You put in the work and the numbers show it.',
    };
  }
  if (roi > 0 && bestReasoningTag?.tag === 'value') {
    return {
      personalityLabel: 'The Value Hunter',
      personalityDescription:
        'You find the gaps the books miss. Patient and profitable.',
    };
  }
  if (roi > 0) {
    return {
      personalityLabel: 'In the Green',
      personalityDescription:
        "Profitable and building. Keep doing what's working.",
    };
  }
  if (roi >= -10) {
    return {
      personalityLabel: 'The Student',
      personalityDescription:
        'Close to breaking through. Small adjustments could flip your results.',
    };
  }
  if (roi < -10 && worstBetType !== null) {
    return {
      personalityLabel: 'The Experimenter',
      personalityDescription:
        'Still finding your lane. Your data shows where to focus — and where to cut.',
    };
  }
  return {
    personalityLabel: 'The Journaler',
    personalityDescription:
      'Tracking is the first step. Your data is building the roadmap.',
  };
}

// ── Main generator ──

export async function generateSeasonReport(
  userId: string,
  season: Season
): Promise<SeasonReport> {
  // Fetch all settled bets (used for current + previous season comparison)
  const { data } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['won', 'lost', 'void']);

  const allUserBets = data || [];
  const seasonBets = filterSeasonBets(allUserBets, season);

  // ── Basic stats ──
  const wins = seasonBets.filter((b) => b.status === 'won');
  const losses = seasonBets.filter((b) => b.status === 'lost');
  const voids = seasonBets.filter((b) => b.status === 'void');

  const totalWagered = seasonBets.reduce((s, b) => s + (b.wager || 0), 0);
  const wonProfit = wins.reduce(
    (s, b) => s + ((b.potential_payout || 0) - (b.wager || 0)),
    0
  );
  const lostAmount = losses.reduce((s, b) => s + (b.wager || 0), 0);
  const netProfit = wonProfit - lostAmount;

  const settled = wins.length + losses.length;
  const winRate = settled > 0 ? (wins.length / settled) * 100 : 0;
  const roi = totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0;

  // ── Biggest win / worst loss ──
  let biggestWin: SeasonReport['biggestWin'] = null;
  if (wins.length > 0) {
    const best = wins.reduce((top, b) => {
      const profit = (b.potential_payout || 0) - (b.wager || 0);
      const topProfit = (top.potential_payout || 0) - (top.wager || 0);
      return profit > topProfit ? b : top;
    });
    biggestWin = {
      amount: (best.potential_payout || 0) - (best.wager || 0),
      description: best.description || best.matchup || '',
      date: getBetDateStr(best),
    };
  }

  let worstLoss: SeasonReport['worstLoss'] = null;
  if (losses.length > 0) {
    const worst = losses.reduce((top, b) =>
      (b.wager || 0) > (top.wager || 0) ? b : top
    );
    worstLoss = {
      amount: worst.wager || 0,
      description: worst.description || worst.matchup || '',
      date: getBetDateStr(worst),
    };
  }

  // ── Streaks ──
  const sorted = [...seasonBets].sort((a, b) => {
    const da = a.placed_at || a.created_at || '';
    const db = b.placed_at || b.created_at || '';
    return da.localeCompare(db);
  });

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const bet of sorted) {
    if (bet.status === 'won') {
      curWin++;
      curLoss = 0;
      longestWinStreak = Math.max(longestWinStreak, curWin);
    } else if (bet.status === 'lost') {
      curLoss++;
      curWin = 0;
      longestLossStreak = Math.max(longestLossStreak, curLoss);
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  // ── By bet type (min 3) ──
  const betTypeGroups = groupBy(
    seasonBets.filter((b) => b.bet_type),
    'bet_type'
  );
  const betTypeStats = Object.entries(betTypeGroups)
    .filter(([, bets]) => bets.length >= 3)
    .map(([type, bets]) => {
      const w = bets.filter((b) => b.status === 'won').length;
      const l = bets.filter((b) => b.status === 'lost').length;
      return { type, roi: computeGroupROI(bets), record: `${w}-${l}` };
    });

  const bestBetType =
    betTypeStats.length > 0
      ? betTypeStats.reduce((best, cur) => (cur.roi > best.roi ? cur : best))
      : null;
  const worstBetType =
    betTypeStats.length > 1
      ? betTypeStats.reduce((worst, cur) =>
          cur.roi < worst.roi ? cur : worst
        )
      : null;

  // ── By sportsbook (min 3) ──
  const bookGroups = groupBy(
    seasonBets.filter((b) => b.sportsbook),
    'sportsbook'
  );
  const bookStats = Object.entries(bookGroups)
    .filter(([, bets]) => bets.length >= 3)
    .map(([name, bets]) => ({ name, roi: computeGroupROI(bets) }));

  const bestSportsbook =
    bookStats.length > 0
      ? bookStats.reduce((best, cur) => (cur.roi > best.roi ? cur : best))
      : null;

  // ── Averages ──
  const averageWager =
    seasonBets.length > 0 ? totalWagered / seasonBets.length : 0;

  const oddsValues = seasonBets
    .map((b) => parseAmericanOdds(b.odds))
    .filter((v): v is number => v !== null);
  const averageOdds =
    oddsValues.length > 0
      ? formatAverageOdds(
          oddsValues.reduce((s, v) => s + v, 0) / oddsValues.length
        )
      : 'N/A';

  const seasonMs =
    new Date(season.endDate).getTime() - new Date(season.startDate).getTime();
  const seasonWeeks = seasonMs / (7 * 24 * 60 * 60 * 1000);
  const betsPerWeek = seasonWeeks > 0 ? seasonBets.length / seasonWeeks : 0;

  const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const bet of seasonBets) {
    const d = new Date(bet.placed_at || bet.created_at || '');
    if (!isNaN(d.getTime())) dayCounts[d.getDay()]++;
  }
  const favoriteDayOfWeek = DAYS[dayCounts.indexOf(Math.max(...dayCounts))];

  // ── Reasoning tags ──
  const taggedBets = seasonBets.filter((b) => b.reasoning_tag);
  const tagGroups = groupBy(taggedBets, 'reasoning_tag');
  const tagStats = Object.entries(tagGroups).map(([tag, bets]) => ({
    tag,
    roi: computeGroupROI(bets),
  }));
  const bestReasoningTag =
    tagStats.length > 0
      ? tagStats.reduce((best, cur) => (cur.roi > best.roi ? cur : best))
      : null;

  // ── Confidence ──
  const confBets = seasonBets.filter((b) => b.confidence_level != null);
  const averageConfidence =
    confBets.length > 0
      ? confBets.reduce((s, b) => s + b.confidence_level, 0) / confBets.length
      : null;

  // ── Personality ──
  const { personalityLabel, personalityDescription } = computePersonality(
    roi,
    averageConfidence,
    betsPerWeek,
    bestReasoningTag,
    worstBetType
  );

  // ── Previous season comparison ──
  let previousSeasonROI: number | null = null;
  const prevSeason = findPreviousSeason(season);
  if (prevSeason) {
    const prevBets = filterSeasonBets(allUserBets, prevSeason);
    if (prevBets.length >= 5) {
      previousSeasonROI = computeGroupROI(prevBets);
    }
  }
  const roiChange = previousSeasonROI !== null ? roi - previousSeasonROI : null;

  return {
    season,
    totalBets: seasonBets.length,
    record: { wins: wins.length, losses: losses.length, pushes: voids.length },
    winRate,
    roi,
    netProfit,
    totalWagered,
    biggestWin,
    worstLoss,
    longestWinStreak,
    longestLossStreak,
    bestBetType,
    worstBetType,
    bestSportsbook,
    averageWager,
    averageOdds,
    betsPerWeek,
    favoriteDayOfWeek,
    bestReasoningTag,
    averageConfidence,
    personalityLabel,
    personalityDescription,
    previousSeasonROI,
    roiChange,
  };
}
