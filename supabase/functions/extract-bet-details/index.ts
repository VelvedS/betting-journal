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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
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
