import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, extractionFields, projectId, documentId, mode = 'standard' } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build system prompt based on mode
    let systemPrompt = '';
    if (mode === 'handwriting') {
      systemPrompt = `You are an advanced OCR system specialized in handwriting recognition. 
Extract text from handwritten documents with extreme precision. Pay special attention to:
- Cursive and print handwriting styles
- Variable letter spacing and sizes
- Ink smudges and corrections
- Partially legible text
Always indicate confidence level for each extracted field.`;
    } else {
      systemPrompt = `You are an advanced OCR system with confidence scoring. 
Extract the following fields from this document with precision.
For each field, provide:
1. The extracted value
2. A confidence score (0.0 to 1.0)
3. Whether the field needs human review (if confidence < 0.85)`;
    }

    const fieldList = extractionFields.map((f: any) => f.name).join(', ');
    const userPrompt = `Extract these fields: ${fieldList}

Return ONLY valid JSON in this format:
{
  "fields": {
    "field_name": {
      "value": "extracted value",
      "confidence": 0.95,
      "needs_review": false
    }
  }
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mode === 'handwriting' ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0]?.message?.content || '{}';
    
    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : { fields: {} };

    // Store confidence scores in database
    const confidenceRecords = [];
    for (const [fieldName, fieldData] of Object.entries(extracted.fields || {})) {
      const fd = fieldData as any;
      confidenceRecords.push({
        document_id: documentId,
        field_name: fieldName,
        extracted_value: fd.value || '',
        confidence_score: fd.confidence || 0.5,
        needs_review: fd.needs_review || fd.confidence < 0.85,
      });
    }

    if (confidenceRecords.length > 0) {
      await supabaseClient.from('extraction_confidence').insert(confidenceRecords);
    }

    // Check for ML templates to improve accuracy
    const { data: mlTemplates } = await supabaseClient
      .from('ml_document_templates')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .limit(1);

    let enhancedFields = extracted.fields;
    if (mlTemplates && mlTemplates.length > 0) {
      // Apply ML template patterns to improve extraction
      const template = mlTemplates[0];
      const patterns = template.field_patterns as any;
      
      for (const [fieldName, fieldData] of Object.entries(enhancedFields)) {
        if (patterns[fieldName]) {
          const pattern = patterns[fieldName];
          const fd = fieldData as any;
          // Apply learned corrections
          if (pattern.corrections && fd.value in pattern.corrections) {
            fd.value = pattern.corrections[fd.value];
            fd.confidence = Math.min(1.0, fd.confidence + 0.1);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      fields: enhancedFields,
      mode: mode,
      usedTemplate: mlTemplates && mlTemplates.length > 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('OCR Enhanced error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
