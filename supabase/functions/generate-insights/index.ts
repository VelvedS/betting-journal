import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are the AI Betting Coach inside Ledgr, a private sports betting journal app. Your job is to analyze a bettor's historical data and generate behavioral insights. You are NOT a prediction engine — you never suggest what to bet on. Instead, you help the user understand their own patterns, strengths, weaknesses, and emotional tendencies.

Rules:
- Be direct and specific. Reference actual numbers from their data.
- Be encouraging but honest. If they're losing money, say so constructively.
- Never recommend specific bets, teams, or picks.
- Focus on BEHAVIOR, not outcomes. Example: 'Your wager size increases 40% after wins' not 'Bet more on NBA.'
- Keep each insight to 2-3 sentences max.
- Return EXACTLY 3-5 insights as a JSON array.
- Each insight needs: title (short, punchy), body (2-3 sentences with specific data), type (one of: strength, weakness, pattern, warning, opportunity)
- Return ONLY valid JSON. No markdown, no code fences, no preamble.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth: extract user from JWT ──
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }
    const userId = user.id

    // Admin client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // ── Parse request body ──
    const { dataSnapshot } = await req.json()
    if (!dataSnapshot) {
      return new Response(
        JSON.stringify({ error: 'Missing dataSnapshot in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // ── Minimum data check ──
    if (!dataSnapshot.totalBets || dataSnapshot.totalBets < 10) {
      return new Response(
        JSON.stringify({ error: 'Not enough data yet. Log at least 10 bets to unlock AI coaching.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // ── Rate limit: 1 generation per 24 hours ──
    const { data: recentInsights } = await adminClient
      .from('ai_insights')
      .select('generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (recentInsights && recentInsights.length > 0) {
      const lastGenerated = new Date(recentInsights[0].generated_at)
      const now = new Date()
      const hoursSince = (now.getTime() - lastGenerated.getTime()) / (1000 * 60 * 60)

      if (hoursSince < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSince)
        return new Response(
          JSON.stringify({ error: `Insights refresh available in ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 },
        )
      }
    }

    // ── Call Anthropic API ──
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    let anthropicRes: Response
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Here is my complete betting data. Generate behavioral insights:\n\n${JSON.stringify(dataSnapshot)}`,
            },
          ],
        }),
      })
    } catch (err) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timed out. Please try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      throw err
    }
    clearTimeout(timeout)

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, errBody)
      return new Response(
        JSON.stringify({ error: 'AI analysis temporarily unavailable. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const anthropicData = await anthropicRes.json()
    let rawText = anthropicData?.content?.[0]?.text ?? ''

    // Strip markdown code fences if present
    rawText = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim()

    // ── Parse and validate insights ──
    let insights: Array<{ title: string; body: string; type: string }>
    try {
      insights = JSON.parse(rawText)
    } catch {
      console.error('Failed to parse insights JSON:', rawText)
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    if (!Array.isArray(insights) || insights.length === 0) {
      return new Response(
        JSON.stringify({ error: 'AI returned empty insights. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const validTypes = ['strength', 'weakness', 'pattern', 'warning', 'opportunity']
    insights = insights
      .filter((i) => i.title && i.body && i.type)
      .map((i) => ({
        title: String(i.title),
        body: String(i.body),
        type: validTypes.includes(i.type) ? i.type : 'pattern',
      }))
      .slice(0, 5)

    // ── Store insights in DB ──
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const rows = insights.map((insight) => ({
      user_id: userId,
      title: insight.title,
      body: insight.body,
      type: insight.type,
      data_snapshot: dataSnapshot,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }))

    const { error: insertError } = await adminClient
      .from('ai_insights')
      .insert(rows)

    if (insertError) {
      console.error('Failed to store insights:', insertError)
      // Still return the insights even if storage fails
    }

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
