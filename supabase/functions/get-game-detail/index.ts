import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPORT_PATH_MAP: Record<string, string> = {
  // Football
  NFL: 'football/nfl',
  NCAAF: 'football/college-football',
  // Basketball
  NBA: 'basketball/nba',
  WNBA: 'basketball/wnba',
  NCAAM: 'basketball/mens-college-basketball',
  NCAAW: 'basketball/womens-college-basketball',
  // Baseball & Hockey
  MLB: 'baseball/mlb',
  NHL: 'hockey/nhl',
  // Soccer
  EPL: 'soccer/eng.1',
  MLS: 'soccer/usa.1',
  UCL: 'soccer/uefa.champions',
  LIGA: 'soccer/esp.1',
  // Combat & Individual
  UFC: 'mma/ufc',
  PGA: 'golf/pga',
  ATP: 'tennis/atp',
  WTA: 'tennis/wta',
}

async function fetchESPNDetail(id: string, sport: string) {
  const sportPath = SPORT_PATH_MAP[sport.toUpperCase()]
  if (!sportPath) throw new Error(`Unknown sport: ${sport}`)

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${id}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`)
  const data = await res.json()

  const competition = data.header?.competitions?.[0]
  const competitors = competition?.competitors || []

  const home = competitors.find((c: any) => c.homeAway === 'home')
  const away = competitors.find((c: any) => c.homeAway === 'away')

  const parseTeam = (c: any) => ({
    name: c?.team?.displayName || c?.team?.shortDisplayName || '',
    abbreviation: c?.team?.abbreviation || '',
    score: c?.score || '',
    record: c?.record?.[0]?.displayValue || '',
    color: c?.team?.color ? `#${c.team.color}` : '#666666',
  })

  const status = data.header?.competitions?.[0]?.status?.type?.name === 'STATUS_IN_PROGRESS'
    ? 'in'
    : data.header?.competitions?.[0]?.status?.type?.name === 'STATUS_FINAL'
      ? 'post'
      : 'pre'

  const statusDetail = data.header?.competitions?.[0]?.status?.type?.shortDetail || ''

  // Venue — try gameInfo first, then competition
  const venue = data.gameInfo?.venue?.fullName
    || competition?.venue?.fullName
    || ''

  // Broadcast
  const broadcast = competition?.broadcasts?.[0]?.names?.[0] || ''

  // Start time
  const startTime = data.header?.competitions?.[0]?.date || new Date().toISOString()

  // Leaders
  let leaders: { category: string; playerName: string; displayValue: string }[] = []
  try {
    const rawLeaders = data.leaders || []
    for (const group of rawLeaders) {
      const topLeader = group?.leaders?.[0]
      if (topLeader?.athlete?.displayName) {
        leaders.push({
          category: group.displayName || group.name || '',
          playerName: topLeader.athlete.displayName,
          displayValue: topLeader.displayValue || '',
        })
      }
      if (leaders.length >= 3) break
    }
  } catch {
    leaders = []
  }

  return {
    type: 'espn' as const,
    id,
    sport: sport.toUpperCase(),
    status,
    statusDetail,
    homeTeam: parseTeam(home),
    awayTeam: parseTeam(away),
    venue,
    broadcast,
    startTime,
    leaders,
  }
}

async function fetchKalshiDetail(id: string) {
  const url = `https://api.elections.kalshi.com/trade-api/v2/markets/${id}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Ledgr/1.0' },
  })
  if (!res.ok) throw new Error(`Kalshi fetch failed: ${res.status}`)
  const data = await res.json()
  const market = data.market || data

  const yesPrice = market.yes_bid ?? 0
  return {
    type: 'kalshi' as const,
    id: market.ticker || id,
    title: market.title || '',
    subtitle: market.subtitle || market.yes_sub_title || '',
    category: market.category || '',
    yesPrice,
    noPrice: 100 - yesPrice,
    lastPrice: market.last_price ?? 0,
    volume: market.volume ?? 0,
    volume24h: market.volume_24h ?? 0,
    openInterest: market.open_interest ?? 0,
    closeTime: market.close_time || market.expiration_time || '',
    status: market.status || '',
    result: market.result ?? null,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, id, sport } = await req.json()

    let result
    if (type === 'espn') {
      result = await fetchESPNDetail(id, sport)
    } else if (type === 'kalshi') {
      result = await fetchKalshiDetail(id)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15',
      },
    })
  } catch (err) {
    console.error('get-game-detail error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to load details' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
