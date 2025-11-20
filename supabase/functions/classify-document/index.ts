import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ClassifyDocumentSchema = z.object({
  documentId: z.string().uuid(),
  extractedText: z.string().max(50000).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document ID and optional text from request
    const body = await req.json();
    const validated = ClassifyDocumentSchema.parse(body);
    const { documentId, extractedText } = validated;

    // Fetch document if text not provided
    let textToClassify = extractedText;
    if (!textToClassify) {
      const { data: doc, error } = await supabase
        .from('documents')
        .select('extracted_text, extracted_metadata')
        .eq('id', documentId)
        .single();

      if (error || !doc) {
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      textToClassify = doc.extracted_text || '';
    }
    
    if (!textToClassify) {
      return new Response(
        JSON.stringify({ error: 'No text content to classify' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Truncate text to first 2000 characters for classification
    const textSample = textToClassify.substring(0, 2000);

    // Call Lovable AI for classification
    const classificationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a document classification expert. Classify documents accurately based on their content.'
          },
          {
            role: 'user',
            content: `Classify this document into one of these categories: check, invoice, purchase_order, receipt, contract, legal_document, form, letter, other.

Document text:
${textSample}

Return your classification.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'classify_document',
            description: 'Classify a document into a specific type',
            parameters: {
              type: 'object',
              properties: {
                document_type: {
                  type: 'string',
                  enum: ['check', 'invoice', 'purchase_order', 'receipt', 'contract', 'legal_document', 'form', 'letter', 'other'],
                  description: 'The classified document type'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Confidence score from 0 to 1'
                },
                reasoning: {
                  type: 'string',
                  description: 'Brief explanation of why this classification was chosen'
                }
              },
              required: ['document_type', 'confidence', 'reasoning'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'classify_document' } }
      }),
    });

    if (!classificationResponse.ok) {
      const errorText = await classificationResponse.text();
      console.error('Lovable AI error:', classificationResponse.status, errorText);
      
      if (classificationResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (classificationResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI classification failed: ${errorText}`);
    }

    const aiResult = await classificationResponse.json();

    // Extract classification from tool call
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'classify_document') {
      throw new Error('Invalid AI response format');
    }

    const classification = JSON.parse(toolCall.function.arguments);

    // Update document with classification
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        document_type: classification.document_type,
        classification_confidence: classification.confidence,
        classification_metadata: {
          reasoning: classification.reasoning,
          classified_at: new Date().toISOString()
        }
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        classification: {
          document_type: classification.document_type,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Classification error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Classification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});