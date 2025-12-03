import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Advanced ICR (Intelligent Character Recognition) modes
type OCRMode = 'standard' | 'handwriting' | 'mixed' | 'cursive' | 'forms';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      imageUrl, 
      extractionFields, 
      projectId, 
      documentId, 
      mode = 'standard',
      documentType,
      enableICR = false 
    } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build advanced system prompt based on mode
    const systemPrompt = buildSystemPrompt(mode as OCRMode, enableICR, documentType);
    
    // Build field extraction prompt with descriptions
    const fieldPrompt = buildFieldPrompt(extractionFields);
    
    const userPrompt = `${fieldPrompt}

For EACH field, you MUST provide:
1. "value": The extracted text (empty string if not found)
2. "confidence": A decimal from 0.0 to 1.0 indicating certainty
3. "needs_review": true if confidence < 0.85 or text is ambiguous
4. "is_handwritten": true if the text appears handwritten
5. "char_confidences": Array of per-character confidence scores for handwritten text (optional)

Return ONLY valid JSON:
{
  "fields": {
    "field_name": {
      "value": "extracted value",
      "confidence": 0.95,
      "needs_review": false,
      "is_handwritten": false,
      "char_confidences": null
    }
  },
  "document_analysis": {
    "has_handwriting": false,
    "handwriting_percentage": 0,
    "image_quality": "good",
    "detected_language": "en",
    "contains_signatures": false,
    "contains_stamps": false
  }
}`;

    // Use more powerful model for handwriting/complex documents
    const model = selectModel(mode as OCRMode, enableICR);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
        max_tokens: 4000,
        temperature: 0.1, // Lower temperature for more consistent extraction
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
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : { fields: {}, document_analysis: {} };

    // Store confidence scores in database with handwriting metadata
    const confidenceRecords = [];
    for (const [fieldName, fieldData] of Object.entries(extracted.fields || {})) {
      const fd = fieldData as any;
      confidenceRecords.push({
        document_id: documentId,
        field_name: fieldName,
        extracted_value: fd.value || '',
        confidence_score: fd.confidence || 0.5,
        needs_review: fd.needs_review || fd.confidence < 0.85 || fd.is_handwritten,
      });
    }

    if (confidenceRecords.length > 0 && documentId) {
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
      const template = mlTemplates[0];
      const patterns = template.field_patterns as any;
      
      for (const [fieldName, fieldData] of Object.entries(enhancedFields)) {
        if (patterns && patterns[fieldName]) {
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
      document_analysis: extracted.document_analysis || {},
      mode: mode,
      model_used: model,
      icr_enabled: enableICR,
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

function buildSystemPrompt(mode: OCRMode, enableICR: boolean, documentType?: string): string {
  const basePrompt = `You are an advanced Intelligent Character Recognition (ICR) system with capabilities comparable to industry-leading solutions like ABBYY FlexiCapture. Your task is to extract data from documents with extreme precision.`;

  const modePrompts: Record<OCRMode, string> = {
    standard: `${basePrompt}

STANDARD OCR MODE:
- Extract printed text with high accuracy
- Identify field locations and boundaries
- Handle multiple fonts and sizes
- Process tables and structured layouts
- Detect and handle multi-column text`,

    handwriting: `${basePrompt}

HANDWRITING RECOGNITION MODE (Advanced ICR):
You are specialized in handwriting recognition. Apply these advanced techniques:

1. CHARACTER-LEVEL ANALYSIS:
   - Analyze each character independently before combining
   - Consider stroke patterns, pen lifts, and connections
   - Handle variable letter sizes and spacing
   - Recognize both print and cursive styles

2. CONTEXTUAL UNDERSTANDING:
   - Use field context to improve recognition (e.g., "Name" field expects alphabetic characters)
   - Apply common word patterns to resolve ambiguous letters
   - Consider that 'a' and 'o', '1' and 'l', 'u' and 'n' are commonly confused

3. WRITING STYLE DETECTION:
   - Identify if text is cursive, print, or mixed
   - Adapt recognition based on detected style
   - Handle connected letters in cursive writing

4. QUALITY COMPENSATION:
   - Adjust for ink smudges, corrections, and crossed-out text
   - Handle light or faded handwriting
   - Process documents with multiple handwriting styles

5. CONFIDENCE SCORING:
   - Provide character-level confidence when uncertain
   - Flag illegible portions for human review
   - Indicate when context-based inference was used`,

    mixed: `${basePrompt}

MIXED CONTENT MODE:
Handle documents containing both printed and handwritten text:
- Automatically detect which portions are handwritten vs. printed
- Apply appropriate recognition techniques for each section
- Maintain high accuracy for both types
- Clearly indicate which fields contain handwritten content`,

    cursive: `${basePrompt}

CURSIVE HANDWRITING MODE (Specialized ICR):
Focus on connected cursive writing:
- Segment connected letters accurately
- Handle variable letter connections
- Recognize common cursive letter forms
- Process flowing signatures and notes
- Handle loops, ascenders, and descenders correctly`,

    forms: `${basePrompt}

FORM PROCESSING MODE:
Specialized for structured forms with filled-in fields:
- Detect form field boundaries (boxes, lines, dotted areas)
- Extract handwritten entries within field boxes
- Handle checkboxes and radio buttons
- Process both typed and handwritten form entries
- Maintain field-value associations`
  };

  let prompt = modePrompts[mode] || modePrompts.standard;

  if (enableICR) {
    prompt += `

ENHANCED ICR FEATURES ENABLED:
- Apply maximum handwriting recognition capabilities
- Use all available contextual clues
- Provide detailed confidence metrics
- Apply post-processing corrections for common OCR errors`;
  }

  if (documentType) {
    prompt += `

DOCUMENT TYPE: ${documentType}
Apply document-specific extraction patterns and field expectations for ${documentType} documents.`;
  }

  prompt += `

CRITICAL INSTRUCTIONS:
1. NEVER guess or fabricate data - if text is illegible, leave value empty and set needs_review: true
2. Confidence scores must accurately reflect certainty
3. For handwritten text, err on the side of lower confidence
4. Always indicate is_handwritten: true for handwritten fields
5. Preserve original formatting (case, punctuation) unless clearly erroneous`;

  return prompt;
}

function buildFieldPrompt(extractionFields: any[]): string {
  if (!extractionFields || extractionFields.length === 0) {
    return 'Extract all visible text fields from this document.';
  }

  const fieldDescriptions = extractionFields.map(f => {
    let desc = `- "${f.name}"`;
    if (f.type) desc += ` (type: ${f.type})`;
    if (f.description) desc += `: ${f.description}`;
    return desc;
  }).join('\n');

  return `Extract the following fields from this document:

${fieldDescriptions}

Pay special attention to any custom descriptions provided above - they contain important guidance for extraction.`;
}

function selectModel(mode: OCRMode, enableICR: boolean): string {
  // Use more powerful model for complex recognition tasks
  if (mode === 'handwriting' || mode === 'cursive' || enableICR) {
    return 'google/gemini-2.5-pro';
  }
  if (mode === 'mixed' || mode === 'forms') {
    return 'google/gemini-2.5-flash';
  }
  return 'google/gemini-2.5-flash';
}
