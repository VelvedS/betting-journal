import { supabase } from './supabase';

export interface Season {
  sport: string;
  label: string;
  startDate: string;
  endDate: string;
}

export const SEASONS: Season[] = [
  { sport: 'NFL', label: '2024-25 NFL Season', startDate: '2024-09-05', endDate: '2025-02-10' },
  { sport: 'NFL', label: '2025-26 NFL Season', startDate: '2025-09-04', endDate: '2026-02-09' },
  { sport: 'NBA', label: '2024-25 NBA Season', startDate: '2024-10-22', endDate: '2025-06-22' },
  { sport: 'NBA', label: '2025-26 NBA Season', startDate: '2025-10-21', endDate: '2026-06-21' },
  { sport: 'MLB', label: '2025 MLB Season', startDate: '2025-03-27', endDate: '2025-11-05' },
  { sport: 'MLB', label: '2026 MLB Season', startDate: '2026-03-26', endDate: '2026-11-04' },
  { sport: 'NHL', label: '2024-25 NHL Season', startDate: '2024-10-08', endDate: '2025-06-25' },
  { sport: 'NHL', label: '2025-26 NHL Season', startDate: '2025-10-07', endDate: '2026-06-24' },
  { sport: 'NCAAF', label: '2025 College Football', startDate: '2025-08-23', endDate: '2026-01-20' },
  { sport: 'NCAAB', label: '2025-26 College Basketball', startDate: '2025-11-04', endDate: '2026-04-07' },
];

export function getCompletedSeasons(): Season[] {
  const now = new Date();
  return SEASONS.filter((s) => new Date(s.endDate) < now);
}

export function getActiveSeasons(): Season[] {
  const now = new Date();
  return SEASONS.filter(
    (s) => new Date(s.startDate) <= now && new Date(s.endDate) >= now
  );
}

function getBetDate(bet: { placed_at?: string | null; created_at?: string | null }): string {
  return ((bet.placed_at || bet.created_at) ?? '').split('T')[0];
}

export async function getAvailableReports(
  userId: string
): Promise<Array<Season & { betCount: number }>> {
  const completed = getCompletedSeasons();
  if (completed.length === 0) return [];

  const { data } = await supabase
    .from('bets')
    .select('sport, placed_at, created_at, status')
    .eq('user_id', userId)
    .in('status', ['won', 'lost', 'void']);

  const bets = data || [];

  return completed
    .map((season) => {
      const betCount = bets.filter((b) => {
        if (!b.sport) return false;
        if (!b.sport.toLowerCase().includes(season.sport.toLowerCase())) return false;
        const date = getBetDate(b);
        return date >= season.startDate && date <= season.endDate;
      }).length;
      return { ...season, betCount };
    })
    .filter((r) => r.betCount >= 5);
}
