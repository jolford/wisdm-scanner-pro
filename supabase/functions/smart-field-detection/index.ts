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
    const { imageUrl, documentId, projectId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Starting smart field detection for document:', documentId);

    const systemPrompt = `You are an intelligent form field detector. Analyze this document image and automatically identify all form fields present.

For each field you detect, provide:
1. Field name (descriptive, snake_case)
2. Field type (text, number, date, checkbox, signature, address, email, phone)
3. Confidence score (0.0 to 1.0)
4. Bounding box coordinates if visible (x, y, width, height as percentages)

Common field types to look for:
- Names (first, last, full)
- Addresses (street, city, state, zip)
- Dates (DOB, signing date)
- Identification (SSN, DL, ID numbers)
- Contact (phone, email)
- Signatures
- Checkboxes and selections`;

    const userPrompt = `Analyze this form and detect all fillable fields. Return ONLY valid JSON:
{
  "detected_fields": [
    {
      "field_name": "voter_name",
      "field_type": "text",
      "confidence": 0.95,
      "bounding_box": {"x": 10, "y": 20, "width": 30, "height": 5}
    }
  ],
  "document_type": "voter_registration",
  "confidence": 0.92
}`;

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
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const detected = jsonMatch ? JSON.parse(jsonMatch[0]) : { detected_fields: [] };

    console.log('Detected fields:', detected.detected_fields?.length || 0);

    // Store detected fields in database
    const detectedRecords = detected.detected_fields?.map((field: any) => ({
      document_id: documentId,
      field_name: field.field_name,
      field_type: field.field_type,
      bounding_box: field.bounding_box || null,
      confidence: field.confidence || 0.5,
      auto_detected: true,
    })) || [];

    if (detectedRecords.length > 0) {
      await supabaseClient.from('detected_fields').insert(detectedRecords);
    }

    // If document type detected with high confidence, check for ML template
    if (detected.document_type && detected.confidence > 0.8) {
      const { data: existingTemplate } = await supabaseClient
        .from('ml_document_templates')
        .select('id')
        .eq('project_id', projectId)
        .eq('document_type', detected.document_type)
        .limit(1);

      if (!existingTemplate || existingTemplate.length === 0) {
        // Create new ML template for this document type
        const fieldPatterns: any = {};
        detected.detected_fields?.forEach((field: any) => {
          fieldPatterns[field.field_name] = {
            type: field.field_type,
            corrections: {},
            commonValues: [],
          };
        });

        await supabaseClient.from('ml_document_templates').insert({
          project_id: projectId,
          template_name: `Auto-detected ${detected.document_type}`,
          document_type: detected.document_type,
          field_patterns: fieldPatterns,
          training_data_count: 1,
          accuracy_rate: detected.confidence,
          is_active: true,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      detected_fields: detected.detected_fields || [],
      document_type: detected.document_type,
      confidence: detected.confidence,
      auto_template_created: detected.confidence > 0.8,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Smart field detection error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
