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
    const { imageData, isPdf, extractionFields } = await req.json();
    
    if (!imageData) {
      throw new Error('No image data provided');
    }

    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image');
    console.log('Extraction fields:', extractionFields);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build extraction prompt based on provided fields
    let extractionPrompt = 'Please extract all text from this document using OCR/ICR. Preserve the original formatting and structure as much as possible.';
    
    if (extractionFields && extractionFields.length > 0) {
      const fieldsList = extractionFields.map((f: any) => `- ${f.name}: ${f.description || 'Extract this field'}`).join('\n');
      extractionPrompt = `Extract ALL text from this ${isPdf ? 'PDF' : 'image'} document AND identify the following specific fields:\n\n${fieldsList}\n\nProvide both the full text extraction and the identified field values.`;
    }


    // Process images with vision model
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
            content: 'You are an advanced OCR and ICR system with metadata extraction capabilities. Extract ALL text from documents and identify specific data fields when requested. Return results in a clear, structured format.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: extractionPrompt
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
          JSON.stringify({ error: 'AI credits depleted. Please add more credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    // Parse metadata from the response if extraction fields were provided
    const metadata: Record<string, string> = {};
    
    if (extractionFields && extractionFields.length > 0) {
      // Use AI to structure the extracted data into metadata
      const metadataResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: 'You extract specific field values from text. Return ONLY valid JSON with the requested field names as keys and their extracted values. If a field is not found, use an empty string.'
            },
            {
              role: 'user',
              content: `From this extracted text, identify these fields and return as JSON:\n\nFields needed:\n${extractionFields.map((f: any) => f.name).join(', ')}\n\nExtracted text:\n${extractedText}\n\nReturn format: {"field1": "value1", "field2": "value2"}`
            }
          ],
          temperature: 0.1,
        }),
      });

      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        const metadataText = metadataData.choices[0].message.content;
        
        try {
          // Try to parse JSON from the response
          const jsonMatch = metadataText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsedMetadata = JSON.parse(jsonMatch[0]);
            Object.assign(metadata, parsedMetadata);
          }
        } catch (e) {
          console.error('Failed to parse metadata JSON:', e);
        }
      }
    }

    console.log('OCR processing completed successfully');
    console.log('Extracted metadata:', metadata);

    return new Response(
      JSON.stringify({ 
        text: extractedText,
        metadata: metadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in OCR function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
