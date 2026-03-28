import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Game = {
  id: string
  sport: string
  status: 'pre' | 'in' | 'post'
  statusDetail: string
  homeTeam: string
  awayTeam: string
  homeScore: string
  awayScore: string
  startTime: string
  isLive: boolean
}

type KalshiMarket = {
  id: string
  title: string
  category: string
  yesPrice: number
  volume24h: number
  status: string
  closeTime: string
  result: string | null
}

const ESPN_ENDPOINTS = [
  // Football
  { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', sport: 'NFL' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', sport: 'NCAAF' },
  // Basketball
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'NBA' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard', sport: 'WNBA' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', sport: 'NCAAM' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard', sport: 'NCAAW' },
  // Baseball & Hockey
  { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', sport: 'MLB' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', sport: 'NHL' },
  // Soccer
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', sport: 'EPL' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', sport: 'MLS' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', sport: 'UCL' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'LIGA' },
  // Combat & Individual
  { url: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard', sport: 'UFC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', sport: 'PGA' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', sport: 'ATP' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard', sport: 'WTA' },
]

function mapStatus(espnStatus: string): 'pre' | 'in' | 'post' {
  switch (espnStatus) {
    case 'STATUS_IN_PROGRESS': return 'in'
    case 'STATUS_FINAL': return 'post'
    case 'STATUS_SCHEDULED':
    default: return 'pre'
  }
}

function parseEvents(events: any[], sport: string): Game[] {
  const games: Game[] = []
  for (const event of events) {
    try {
      const competition = event.competitions?.[0]
      if (!competition) continue

      const competitors = competition.competitors || []
      const home = competitors.find((c: any) => c.homeAway === 'home')
      const away = competitors.find((c: any) => c.homeAway === 'away')
      if (!home || !away) continue

      const statusName = event.status?.type?.name || 'STATUS_SCHEDULED'
      const status = mapStatus(statusName)

      games.push({
        id: String(event.id),
        sport,
        status,
        statusDetail: event.status?.type?.shortDetail || '',
        homeTeam: home.team?.abbreviation || '???',
        awayTeam: away.team?.abbreviation || '???',
        homeScore: status === 'pre' ? '' : String(home.score ?? ''),
        awayScore: status === 'pre' ? '' : String(away.score ?? ''),
        startTime: event.date || new Date().toISOString(),
        isLive: status === 'in',
      })
    } catch {
      // skip malformed event
    }
  }
  return games
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const [espnResults, kalshiResult] = await Promise.all([
      Promise.allSettled(
        ESPN_ENDPOINTS.map(async ({ url, sport }) => {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`${sport} fetch failed: ${res.status}`)
          const data = await res.json()
          return parseEvents(data.events || [], sport)
        })
      ),
      (async (): Promise<KalshiMarket[]> => {
        try {
          const kalshiEventsUrl = 'https://api.elections.kalshi.com/trade-api/v2/events?limit=50&status=open&with_nested_markets=true'
          const res = await fetch(kalshiEventsUrl, {
            headers: { 'User-Agent': 'Ledgr/1.0' },
          })
          if (!res.ok) return []
          const data = await res.json()
          const events: any[] = data.events || []

          // Flatten all markets from events, attaching parent event category
          const allMarkets: any[] = []
          for (const event of events) {
            const cat = event.category || ''
            const eventTitle = event.title || ''
            for (const m of (event.markets || [])) {
              allMarkets.push({ ...m, _category: cat, _eventTitle: eventTitle })
            }
          }

          return allMarkets
            .filter((m: any) => m.status === 'active' && (m.volume || 0) > 0)
            .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 20)
            .map((m: any) => {
              // Build a readable title: use event title + subtitle for context
              const sub = m.yes_sub_title || m.subtitle || ''
              const title = sub
                ? `${m._eventTitle}${sub ? ' — ' + sub : ''}`
                : m._eventTitle || m.title || ''
              return {
                id: m.ticker || '',
                title,
                category: m._category || '',
                yesPrice: m.yes_bid ?? 0,
                volume24h: m.volume_24h ?? 0,
                status: m.status || 'active',
                closeTime: m.close_time || m.expiration_time || '',
                result: m.result ?? null,
              }
            })
        } catch {
          return []
        }
      })(),
    ])

    let allGames: Game[] = []
    for (const result of espnResults) {
      if (result.status === 'fulfilled') {
        allGames = allGames.concat(result.value)
      }
    }

    if (allGames.length === 0 && kalshiResult.length === 0) {
      const allFailed = espnResults.every((r) => r.status === 'rejected')
      return new Response(
        JSON.stringify({
          games: [],
          markets: [],
          ...(allFailed ? { error: 'Unable to fetch scores' } : {}),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=30',
          },
        }
      )
    }

    // Sort: live first (by sport), then upcoming (by start time), then completed
    const sportOrder: Record<string, number> = {
      NFL: 0, NCAAF: 1,
      NBA: 2, WNBA: 3, NCAAM: 4, NCAAW: 5,
      MLB: 6, NHL: 7,
      EPL: 8, MLS: 9, UCL: 10, LIGA: 11,
      UFC: 12, PGA: 13, ATP: 14, WTA: 15,
    }
    allGames.sort((a, b) => {
      const statusOrder = { in: 0, pre: 1, post: 2 }
      const sa = statusOrder[a.status]
      const sb = statusOrder[b.status]
      if (sa !== sb) return sa - sb
      if (a.status === 'in') {
        return (sportOrder[a.sport] ?? 99) - (sportOrder[b.sport] ?? 99)
      }
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })

    return new Response(JSON.stringify({ games: allGames, markets: kalshiResult }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
    })
  } catch (err) {
    console.error('get-live-scores error:', err)
    return new Response(
      JSON.stringify({ games: [], markets: [], error: 'Unable to fetch scores' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
