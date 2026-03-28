import { supabase } from './supabase';

export interface WhatIfFilters {
  betTypes: string[];
  sports: string[];
  sportsbooks: string[];
  confidenceLevels: number[];
  reasoningTags: string[];
  includeUntagged: boolean;
  minOdds: number | null;
  maxOdds: number | null;
}

export interface SimulationResult {
  actualTimeline: Array<{ date: string; cumulativePL: number }>;
  simulatedTimeline: Array<{ date: string; cumulativePL: number }>;
  actualSummary: { totalBets: number; wins: number; losses: number; roi: number; netPL: number };
  simulatedSummary: { totalBets: number; wins: number; losses: number; roi: number; netPL: number };
  difference: { betsRemoved: number; plDifference: number; roiDifference: number };
}

export interface FilterOptions {
  betTypes: string[];
  sports: string[];
  sportsbooks: string[];
  reasoningTags: string[];
}

// ── Helpers ──

function betPassesFilter(bet: any, filters: WhatIfFilters): boolean {
  // Bet type
  if (bet.bet_type && filters.betTypes.length > 0 && !filters.betTypes.includes(bet.bet_type)) {
    return false;
  }

  // Sport
  if (bet.sport && filters.sports.length > 0 && !filters.sports.includes(bet.sport)) {
    return false;
  }

  // Sportsbook
  if (bet.sportsbook && filters.sportsbooks.length > 0 && !filters.sportsbooks.includes(bet.sportsbook)) {
    return false;
  }

  // Confidence level
  if (bet.confidence_level != null) {
    if (!filters.confidenceLevels.includes(bet.confidence_level)) return false;
  } else if (!filters.includeUntagged) {
    return false;
  }

  // Reasoning tag
  if (bet.reasoning_tag) {
    if (!filters.reasoningTags.includes(bet.reasoning_tag)) return false;
  } else if (!filters.includeUntagged) {
    return false;
  }

  // Odds range
  if (filters.minOdds !== null || filters.maxOdds !== null) {
    const oddsStr = String(bet.odds || '').trim().replace(/^\+/, '');
    const odds = parseFloat(oddsStr);
    if (!isNaN(odds)) {
      if (filters.minOdds !== null && odds < filters.minOdds) return false;
      if (filters.maxOdds !== null && odds > filters.maxOdds) return false;
    }
  }

  return true;
}

// ── Data fetch ──

export async function fetchWhatIfData(userId: string): Promise<{
  bets: any[];
  options: FilterOptions;
}> {
  const { data } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['won', 'lost'])
    .order('placed_at', { ascending: true });

  const bets = data || [];

  const betTypes = [...new Set(bets.map((b) => b.bet_type).filter(Boolean))] as string[];
  const sports = [...new Set(bets.map((b) => b.sport).filter(Boolean))] as string[];
  const sportsbooks = [...new Set(bets.map((b) => b.sportsbook).filter(Boolean))] as string[];
  const reasoningTags = [...new Set(bets.map((b) => b.reasoning_tag).filter(Boolean))] as string[];

  return { bets, options: { betTypes, sports, sportsbooks, reasoningTags } };
}

// ── Pure computation ──

export function computeSimulation(bets: any[], filters: WhatIfFilters): SimulationResult {
  const sorted = [...bets].sort((a, b) => {
    const da = a.placed_at || a.created_at || '';
    const db = b.placed_at || b.created_at || '';
    return da.localeCompare(db);
  });

  const actualTimeline: Array<{ date: string; cumulativePL: number }> = [];
  const simulatedTimeline: Array<{ date: string; cumulativePL: number }> = [];

  let actualCum = 0;
  let simCum = 0;
  let actualWins = 0;
  let actualLosses = 0;
  let actualWagered = 0;
  let simWins = 0;
  let simLosses = 0;
  let simWagered = 0;
  let betsRemoved = 0;

  for (const bet of sorted) {
    const date = (bet.placed_at || bet.created_at || '').split('T')[0];
    const pl =
      bet.status === 'won'
        ? (bet.potential_payout || 0) - (bet.wager || 0)
        : -(bet.wager || 0);

    actualCum += pl;
    actualWagered += bet.wager || 0;
    if (bet.status === 'won') actualWins++;
    else actualLosses++;

    if (betPassesFilter(bet, filters)) {
      simCum += pl;
      simWagered += bet.wager || 0;
      if (bet.status === 'won') simWins++;
      else simLosses++;
    } else {
      betsRemoved++;
    }

    actualTimeline.push({ date, cumulativePL: actualCum });
    simulatedTimeline.push({ date, cumulativePL: simCum });
  }

  const actualROI = actualWagered > 0 ? (actualCum / actualWagered) * 100 : 0;
  const simROI = simWagered > 0 ? (simCum / simWagered) * 100 : 0;

  return {
    actualTimeline,
    simulatedTimeline,
    actualSummary: {
      totalBets: sorted.length,
      wins: actualWins,
      losses: actualLosses,
      roi: actualROI,
      netPL: actualCum,
    },
    simulatedSummary: {
      totalBets: sorted.length - betsRemoved,
      wins: simWins,
      losses: simLosses,
      roi: simROI,
      netPL: simCum,
    },
    difference: {
      betsRemoved,
      plDifference: simCum - actualCum,
      roiDifference: simROI - actualROI,
    },
  };
}

// ── Full pipeline (spec-matching signature) ──

export async function simulateBetHistory(
  userId: string,
  filters: WhatIfFilters
): Promise<SimulationResult> {
  const { bets } = await fetchWhatIfData(userId);
  return computeSimulation(bets, filters);
}
