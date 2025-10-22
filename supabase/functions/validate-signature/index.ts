/**
 * Signature Validation Edge Function
 * 
 * Validates signatures on petition documents using AI vision analysis.
 * 
 * Features:
 * - Detects presence of signatures
 * - Extracts signature regions with bounding boxes
 * - Compares signatures against reference samples
 * - Provides similarity scores
 * 
 * Request body:
 * - signatureImage: Base64 data URL of signature to validate
 * - referenceImage: Optional base64 data URL of reference signature for comparison
 * - strictMode: Boolean for stricter validation (default: false)
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const { signatureImage, referenceImage, strictMode = false } = await req.json();
    
    if (!signatureImage) {
      return new Response(
        JSON.stringify({ error: 'Signature image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('Service configuration error');
    }

    console.log('Processing signature validation...', referenceImage ? 'with reference' : 'detection only');

    // Prepare AI prompt based on validation mode
    let systemPrompt = `You are an expert signature validation system. Analyze the provided signature image and provide detailed analysis.

Return your response as a JSON object with this structure:
{
  "signatureDetected": boolean,
  "confidence": 0.0-1.0,
  "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0},
  "characteristics": {
    "isHandwritten": boolean,
    "hasFlowingStrokes": boolean,
    "complexity": "simple|moderate|complex",
    "clarity": "clear|moderate|unclear"
  },
  "analysis": "Brief description of the signature"
}`;

    let userPrompt = 'Analyze this signature. Is there a clear signature present? Provide bounding box coordinates and characteristics.';

    // If reference image provided, add comparison analysis
    if (referenceImage) {
      systemPrompt = `You are an expert signature validation system. Compare the two signatures provided and determine their similarity.

Return your response as a JSON object with this structure:
{
  "match": boolean,
  "similarityScore": 0.0-1.0,
  "confidence": 0.0-1.0,
  "analysis": "Detailed comparison explanation",
  "differences": ["list of differences"],
  "similarities": ["list of similarities"],
  "recommendation": "accept|review|reject"
}`;

      userPrompt = `Compare these two signatures. The first image is the signature to validate, the second is the reference signature. Analyze stroke patterns, overall shape, character formation, and writing style. ${strictMode ? 'Use strict validation criteria.' : 'Use moderate validation criteria.'}`;
    }

    // Build messages array for API call
    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: referenceImage 
          ? [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: signatureImage } },
              { type: 'image_url', image_url: { url: referenceImage } }
            ]
          : [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: signatureImage } }
            ]
      }
    ];

    // Call Lovable AI for signature analysis
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
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
      
      throw new Error('Service error');
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    // Parse JSON response
    let result;
    try {
      let jsonToParse = responseText;
      
      // Remove markdown code fences if present
      if (responseText.includes('```')) {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonToParse = codeBlockMatch[1].trim();
        }
      }
      
      // Extract JSON object
      const jsonMatch = jsonToParse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.error('Response text:', responseText);
      
      // Fallback response
      result = {
        error: 'Failed to parse validation results',
        rawResponse: responseText.substring(0, 500)
      };
    }

    console.log('Signature validation completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in signature validation:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to validate signature. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
