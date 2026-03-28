// REQUIRED: Set ANTHROPIC_API_KEY in Supabase Dashboard > Edge Functions > Secrets
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    console.log('DEBUG image_url received:', image_url)
    console.log('DEBUG user_id received:', user_id)

    if (!image_url || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing image_url or user_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Download image from Supabase Storage using admin client (supports private buckets)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract file path — handle raw storage path or full public URL
    let filePath = image_url
    if (image_url.includes('betting-slips/')) {
      const urlParts = image_url.split('betting-slips/')
      filePath = urlParts[urlParts.length - 1]
    }
    console.log('DEBUG filePath extracted:', filePath)

    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('betting-slips')
      .download(filePath)

    console.log('DEBUG download error:', downloadError)
    console.log('DEBUG fileData exists:', !!fileData)
    console.log('DEBUG fileData size:', fileData?.size)

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not download the image. Please try uploading again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('DEBUG fileData type:', typeof fileData)
    console.log('DEBUG fileData constructor:', fileData?.constructor?.name)
    console.log('DEBUG fileData size:', fileData?.size)

    const arrayBuffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j])
      }
    }
    const base64Image = btoa(binary)
    console.log('DEBUG base64 length after fix:', base64Image.length)
    const contentType = fileData.type || 'image/jpeg'

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: `You are an expert betting slip extraction system for the Ledgr app. You analyze screenshots of betting slips from sportsbooks and prediction markets, and extract structured data with high accuracy.

SUPPORTED PLATFORMS: DraftKings, FanDuel, PrizePicks, Underdog Fantasy, BetMGM, Caesars, Bet365, theScore Bet, Fanatics, BetRivers, Hard Rock Bet, Kalshi, Polymarket, Robinhood.

EXTRACTION RULES:
- Return ONLY valid JSON. No markdown, no code fences, no preamble, no explanation.
- Extract every field you can identify. Leave fields as null if not visible in the image.
- For odds: prefer American format (e.g., +150, -110). If decimal or fractional, convert to American.
- For parlays: set bet_type to 'parlay' and populate the parlay_legs array with each individual leg.
- Each parlay leg needs: description (player + stat + line), odds (if visible), status ('won', 'lost', 'pending', or null), and result_value (actual stat value if shown).
- For PrizePicks/Underdog: the 'matchup' is often not a team vs team — use the event or contest name if available. The 'description' should capture all player prop selections.
- For Kalshi/Polymarket: use the market question as 'matchup' and the position (Yes/No) as part of 'description'.
- For status: use 'won', 'lost', 'pending', or 'void'. If the slip shows a green checkmark or 'W', it's won. Red X or 'L' is lost. If unclear, default to 'pending'.
- For placed_at: extract the date/time if visible on the slip. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss). If only a date is visible, append T00:00:00.
- For wager and potential_payout: extract as numbers without currency symbols. If the slip shows 'To Win' instead of total payout, calculate potential_payout = wager + to_win.
- For confidence: assess how clearly readable the slip is from 0.0 to 1.0. Blurry or partially visible = lower confidence.
- For tags: include relevant descriptive tags like the sport name, league, specific bet market type.
- If the image is NOT a betting slip (e.g., a random photo, meme, or unrelated screenshot), return: { "error": "not_a_betting_slip" }

JSON STRUCTURE:
{
  "sportsbook": string | null,
  "bet_type": "single" | "parlay" | "teaser" | "round_robin" | "futures" | "prop" | null,
  "sport": string | null,
  "matchup": string | null,
  "description": string | null,
  "odds": string | null,
  "odds_format": "american" | "decimal" | "fractional" | null,
  "wager": number | null,
  "potential_payout": number | null,
  "status": "won" | "lost" | "pending" | "void" | null,
  "placed_at": string | null,
  "notes": string | null,
  "parlay_legs": [{ "description": string, "odds": string | null, "status": string | null, "result_value": string | null }] | [],
  "tags": string[],
  "confidence": number
}`,
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
                text: base64Image.length > 1_533_333
                  ? 'Extract all betting information from this betting slip image. Return ONLY valid JSON.\n\nNote: This image may be high resolution. Focus on extracting text and numbers from the betting slip area. Ignore any background, navigation bars, or non-slip content.'
                  : 'Extract all betting information from this betting slip image. Return ONLY valid JSON.'
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
      // Try to extract JSON from the response if it has extra text around it
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0])
        } catch {
          // fall through to error
        }
      }
      if (!extractedData) {
        console.error('JSON parse error:', parseError, 'Raw text:', textContent)
        return new Response(
          JSON.stringify({ success: false, error: 'Could not parse the extracted data. Please try again or enter your bet manually.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Handle non-betting-slip images
    if (extractedData.error === 'not_a_betting_slip') {
      return new Response(
        JSON.stringify({ success: false, error: 'The uploaded image does not appear to be a betting slip. Please try again with a screenshot of your bet.' }),
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
