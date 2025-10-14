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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageData, isPdf, extractionFields, textData } = await req.json();
    
    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image');
    console.log('Extraction fields:', extractionFields);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('Service configuration error');
    }

    // For PDFs, we require textData to be provided (extracted client-side)
    if (isPdf && !textData) {
      throw new Error('PDF text extraction required. Please ensure text is extracted before sending.');
    }

    // Build optimized single-call prompt with handwriting support
    let systemPrompt = 'You are an advanced OCR and ICR (Intelligent Character Recognition) system. Extract all text from documents including printed text, handwritten text, and cursive writing. Be very careful to accurately recognize handwritten characters.';
    let userPrompt = 'Extract all text from this document, including any handwritten text. Pay special attention to handwritten characters and cursive writing.';
    
    if (extractionFields && extractionFields.length > 0) {
      const fieldNames = extractionFields.map((f: any) => f.name);
      systemPrompt = `You are an advanced OCR and ICR system that can read both printed and handwritten text. Extract text and return JSON: {"fullText": "complete extracted text", "fields": {${fieldNames.map((n: string) => `"${n}": "value"`).join(', ')}}}. Extract actual values from the document for each field, including handwritten values.`;
      userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'} including handwritten text and identify: ${fieldNames.join(', ')}. Return as JSON.`;
    }

    // Single AI call for everything
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: textData
              ? [
                  {
                    type: 'text',
                    text: `${userPrompt}\n\nDocument text:\n${textData}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: userPrompt
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageData
                    }
                  }
                ]
          }
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
      
      throw new Error('Service error');
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    // Parse response
    let extractedText = responseText;
    let metadata: Record<string, string> = {};
    
    if (extractionFields && extractionFields.length > 0) {
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extractedText = parsed.fullText || responseText;
          metadata = parsed.fields || {};
        }
      } catch (e) {
        console.error('JSON parse failed, using raw text:', e);
      }
    }

    console.log('OCR completed - Metadata:', metadata);

    return new Response(
      JSON.stringify({ 
        text: extractedText,
        metadata: metadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Log detailed error server-side only
    console.error('Error in OCR function:', error);
    
    // Return safe generic message to client
    return new Response(
      JSON.stringify({ error: 'Failed to process document. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
