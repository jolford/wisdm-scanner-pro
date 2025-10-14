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
    const { imageData, isPdf } = await req.json();
    
    if (!imageData) {
      throw new Error('No image data provided');
    }

    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // For PDFs, we need to extract text differently
    // For now, inform user that PDF text extraction requires additional setup
    if (isPdf) {
      // Try to use the AI to extract text from PDF preview/first page
      // Note: This is a workaround - proper PDF parsing would need pdf.js or similar
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
              role: 'user',
              content: 'This is a PDF document. Please inform the user that PDF text extraction requires converting the PDF to images first. For now, please try to extract any visible text from the PDF preview if possible, otherwise suggest they convert the PDF to images (JPG/PNG) for text extraction.'
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        throw new Error('PDF processing is not yet fully supported. Please convert your PDF to images (JPG/PNG) and try again.');
      }

      const data = await response.json();
      const message = data.choices[0].message.content;

      return new Response(
        JSON.stringify({ 
          text: `PDF Support Note:\n\n${message}\n\nFor best results, please:\n1. Convert your PDF pages to JPG or PNG images\n2. Upload the images one at a time\n3. Or use a physical scanner with the Physical Scanner tab\n\nThis will ensure the highest quality text extraction.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
            content: 'You are an advanced OCR and ICR system. Extract ALL text from the provided image with high accuracy. Include formatting, structure, and layout information. Preserve headings, paragraphs, lists, tables, and any special formatting. If handwriting is present, apply intelligent character recognition to transcribe it accurately.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all text from this image using OCR/ICR. Preserve the original formatting and structure as much as possible.'
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

    console.log('OCR processing completed successfully');

    return new Response(
      JSON.stringify({ text: extractedText }),
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
