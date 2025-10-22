/**
 * Offensive Language Detection Edge Function
 * 
 * Uses AI to detect offensive, inappropriate, or discriminatory language in documents
 * Returns bounding box coordinates for highlighting (not redacting) the problematic text
 * 
 * This is specifically designed for AB 1466 compliance where users need to manually
 * review and decide what to redact, but need guidance on where problematic language exists.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, wordBoundingBoxes } = await req.json();
    
    console.log('Analyzing text for offensive language...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('Service configuration error');
    }

    // Build AI prompt for offensive language detection
    const systemPrompt = `You are an expert at identifying offensive, discriminatory, or inappropriate language in legal documents, particularly restrictive covenants that violate fair housing laws (like California AB 1466).

Identify ALL instances of:
1. Racial slurs or discriminatory racial language
2. Religious discrimination or slurs
3. National origin discrimination
4. Discriminatory phrases or restrictive covenants
5. Any language that could be considered offensive or inappropriate in a legal/housing context

Return a JSON array of detected phrases with their exact text matches. Be thorough and catch ALL instances, including subtle or coded discriminatory language.

Format: [{"phrase": "exact text from document", "category": "race|religion|national_origin|restrictive_covenant|other", "severity": "high|medium|low", "reason": "brief explanation"}]`;

    const userPrompt = `Analyze this document text and identify ALL offensive or discriminatory language:\n\n${text}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service unavailable. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('AI service error');
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    // Parse AI response
    let detectedPhrases: Array<{
      phrase: string;
      category: string;
      severity: string;
      reason: string;
    }> = [];

    try {
      // Try to extract JSON from response
      let jsonToParse = responseText;
      if (responseText.includes('```')) {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonToParse = codeBlockMatch[1].trim();
        }
      }
      
      const jsonMatch = jsonToParse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        detectedPhrases = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    // Match detected phrases to word bounding boxes
    const highlights: Array<{
      text: string;
      category: string;
      severity: string;
      reason: string;
      boundingBox: { x: number; y: number; width: number; height: number } | null;
    }> = [];

    if (Array.isArray(wordBoundingBoxes) && wordBoundingBoxes.length > 0) {
      // Prepare normalized word tokens
      const wordTokens = wordBoundingBoxes.map((w: any) => ({
        raw: String(w?.text ?? ''),
        norm: normalizeText(String(w?.text ?? '')),
        bbox: w?.bbox ?? null,
      }));

      for (const detected of detectedPhrases) {
        const searchNorm = normalizeText(detected.phrase);
        const parts = searchNorm.split(' ').filter(Boolean);

        let foundBox: { x: number; y: number; width: number; height: number } | null = null;

        if (parts.length === 1) {
          // Single word
          for (const wt of wordTokens) {
            if (wt.norm === parts[0] && wt.bbox) {
              foundBox = wt.bbox;
              break;
            }
          }
        } else {
          // Multi-word phrase - sliding window
          for (let i = 0; i <= wordTokens.length - parts.length; i++) {
            const window = wordTokens.slice(i, i + parts.length);
            const joined = window.map((w: any) => w.norm).join(' ');
            if (joined === searchNorm) {
              const rects = window.map((w: any) => w.bbox).filter(Boolean);
              if (rects.length) {
                const x1 = Math.min(...rects.map((r: any) => r.x));
                const y1 = Math.min(...rects.map((r: any) => r.y));
                const x2 = Math.max(...rects.map((r: any) => r.x + r.width));
                const y2 = Math.max(...rects.map((r: any) => r.y + r.height));
                foundBox = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
                break;
              }
            }
          }
        }

        highlights.push({
          text: detected.phrase,
          category: detected.category,
          severity: detected.severity,
          reason: detected.reason,
          boundingBox: foundBox,
        });
      }
    } else {
      // No bounding boxes available - return phrases without coordinates
      for (const detected of detectedPhrases) {
        highlights.push({
          text: detected.phrase,
          category: detected.category,
          severity: detected.severity,
          reason: detected.reason,
          boundingBox: null,
        });
      }
    }

    console.log(`Detected ${highlights.length} offensive phrases`);

    return new Response(
      JSON.stringify({ highlights }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in detect-offensive-language:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Normalize text for matching
const normalizeText = (str: string) => str
  .toLowerCase()
  .replace(/[^a-z0-9]+/gi, ' ')
  .trim()
  .replace(/\s+/g, ' ');
