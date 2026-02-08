// REQUIRED: Set ANTHROPIC_API_KEY in Supabase Dashboard > Edge Functions > Secrets
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_url, user_id } = await req.json()

    if (!image_url || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing image_url or user_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Download image from Supabase Storage
    const imageResponse = await fetch(image_url, {
      headers: { 'Authorization': req.headers.get('Authorization') || '' }
    })

    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not download the image. Please try uploading again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    // Call Claude Vision API
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error. Please contact support.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: `You are a betting slip data extractor. Analyze the betting slip image and extract all relevant information. Return ONLY valid JSON with no additional text, no markdown backticks, no explanation.

Return this exact JSON structure:
{
  "sportsbook": "platform name (DraftKings, FanDuel, PrizePicks, Underdog Fantasy, BetMGM, Caesars, Kalshi, etc.)",
  "bet_type": "moneyline | spread | over_under | parlay | prop | other",
  "sport": "sport name (NFL, NBA, MLB, NHL, etc.)",
  "matchup": "teams or event",
  "description": "full bet description",
  "odds": "odds as shown (e.g. +150, -110)",
  "odds_format": "american | decimal | fractional",
  "wager": 0.00,
  "potential_payout": 0.00,
  "status": "pending | won | lost",
  "placed_at": "ISO timestamp or null",
  "notes": "any additional context visible",
  "parlay_legs": [{"description": "leg description", "odds": "leg odds", "status": "pending | won | lost"}],
  "tags": [],
  "confidence": 0.0
}

Rules:
- For parlay_legs: include array if parlay, otherwise null
- For tags: suggest from: "underdog_bet", "live_bet", "research_based", "high_confidence", "hedge_bet", "system_play"
- For confidence: rate 0.0-1.0 your extraction accuracy
- For wager/potential_payout: extract as numbers. If not visible set to 0
- For status: look for visual indicators. Default to "pending"
- If you cannot determine a field, set to null or 0
- Return ONLY the JSON object`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: contentType,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: 'Extract all betting information from this betting slip image. Return ONLY valid JSON.'
              }
            ]
          }
        ]
      })
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('Claude API error:', errorText)
      return new Response(
        JSON.stringify({ success: false, error: 'Processing failed. Please try again or enter your bet manually.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const claudeData = await claudeResponse.json()
    const textContent = claudeData.content?.find((c: any) => c.type === 'text')?.text

    if (!textContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not identify a betting slip in this image. Please try a clearer photo.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Parse JSON from Claude response
    let extractedData
    try {
      const cleanText = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extractedData = JSON.parse(cleanText)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw text:', textContent)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not parse the extracted data. Please try again or enter your bet manually.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
