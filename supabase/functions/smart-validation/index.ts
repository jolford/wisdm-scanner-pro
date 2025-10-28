import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Unauthorized');

    const { documentId, fieldName, fieldValue, context } = await req.json();

    console.log(`Smart validation for document ${documentId}, field ${fieldName}`);

    // Get document and project config
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        batches!inner(
          metadata,
          project_id,
          projects!inner(extraction_fields)
        )
      `)
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    const fieldConfig = doc.batches.projects.extraction_fields?.find(
      (f: any) => f.name === fieldName
    );

    // Use AI to validate and suggest corrections
    if (lovableApiKey && fieldConfig) {
      const prompt = `You are validating extracted document data. 

Field: ${fieldName}
Type: ${fieldConfig.type || 'text'}
Extracted Value: ${fieldValue}
Context: ${context || 'None provided'}

Task:
1. Validate if the value seems correct for this field type
2. Calculate confidence score (0-1)
3. Suggest corrections if needed
4. Provide reasoning

Respond with JSON only:
{
  "isValid": boolean,
  "confidence": number (0-1),
  "suggestions": string[],
  "reasoning": string
}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a document validation expert. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI validation failed: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const validationText = aiData.choices?.[0]?.message?.content;
      
      console.log('AI validation response:', validationText);

      let validation;
      try {
        // Strip markdown code blocks if present
        let cleanedText = validationText.trim();
        if (cleanedText.startsWith('```')) {
          // Remove opening code block (```json or just ```)
          cleanedText = cleanedText.replace(/^```(?:json)?\s*\n/, '');
          // Remove closing code block
          cleanedText = cleanedText.replace(/\n```\s*$/, '');
        }
        
        validation = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        console.error('Raw response:', validationText);
        validation = {
          isValid: true,
          confidence: 0.7,
          suggestions: [],
          reasoning: 'Unable to parse AI response'
        };
      }

      // Update document with validation results
      const updatedConfidence = { ...doc.field_confidence, [fieldName]: validation.confidence };
      const updatedSuggestions = { ...doc.validation_suggestions, [fieldName]: validation };

      await supabase
        .from('documents')
        .update({
          field_confidence: updatedConfidence,
          validation_suggestions: updatedSuggestions
        })
        .eq('id', documentId);

      return new Response(
        JSON.stringify({
          success: true,
          validation
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: basic validation without AI
    const validation = {
      isValid: true,
      confidence: 0.8,
      suggestions: [],
      reasoning: 'Basic validation only'
    };

    return new Response(
      JSON.stringify({
        success: true,
        validation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smart-validation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});