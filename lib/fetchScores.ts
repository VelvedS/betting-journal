export type GameTeam = {
  abbreviation: string;
  score: string;
  logo: string;
};

export type Game = {
  id: string;
  sport: string;
  name: string;
  shortName: string;
  status: 'pre' | 'in' | 'post';
  statusDetail: string;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
};

const SPORT_ENDPOINTS: Record<string, string> = {
  NBA: 'basketball/nba',
  NFL: 'football/nfl',
  MLB: 'baseball/mlb',
  NHL: 'hockey/nhl',
  NCAAB: 'basketball/mens-college-basketball',
  NCAAF: 'football/college-football',
};

export const SPORTS = ['All', ...Object.keys(SPORT_ENDPOINTS)] as const;
export type SportFilter = (typeof SPORTS)[number];

function parseCompetitor(competitors: any[], homeAway: 'home' | 'away'): GameTeam {
  const c = competitors.find((x: any) => x.homeAway === homeAway) || competitors[homeAway === 'home' ? 0 : 1];
  return {
    abbreviation: c?.team?.abbreviation ?? '???',
    score: c?.score ?? '0',
    logo: c?.team?.logo ?? '',
  };
}

async function fetchSport(sport: string, endpoint: string): Promise<Game[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/scoreboard`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const events = data?.events ?? [];
  return events.map((event: any) => {
    const comp = event.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    return {
      id: event.id,
      sport,
      name: event.name ?? '',
      shortName: event.shortName ?? '',
      status: event.status?.type?.state ?? 'pre',
      statusDetail: event.status?.type?.shortDetail ?? '',
      homeTeam: parseCompetitor(competitors, 'home'),
      awayTeam: parseCompetitor(competitors, 'away'),
    } as Game;
  });
}

export async function fetchAllScores(): Promise<Game[]> {
  const results = await Promise.allSettled(
    Object.entries(SPORT_ENDPOINTS).map(([sport, endpoint]) => fetchSport(sport, endpoint)),
  );

  const games: Game[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') games.push(...r.value);
  }
  if (games.length === 0) return [];

  // Sort: live first, then upcoming (soonest), then final
  const order: Record<string, number> = { in: 0, pre: 1, post: 2 };
  games.sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1));
  return games;
}
