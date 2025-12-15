/**
 * Auto-Redact AB 1466 Edge Function
 * 
 * Automatically detects and redacts restrictive covenant language in property documents
 * per California Assembly Bill 1466 requirements.
 * 
 * This function:
 * 1. Downloads the original document image
 * 2. Detects AB 1466 violations using keyword matching and AI analysis
 * 3. Generates a redacted version with black boxes over violations
 * 4. Uploads the redacted version to storage
 * 5. Updates the document record with redaction metadata
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { createCanvas, loadImage } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AB 1466 Protected Classes per California Civil Code
// Restrictions based on ANY of these are unlawful:
const AB1466_PROTECTED_CLASSES = [
  'race', 'color', 'religion', 'sex', 'gender', 'gender identity', 'gender expression',
  'sexual orientation', 'familial status', 'marital status', 'national origin', 
  'ancestry', 'disability', 'veteran status', 'military status', 'genetic information', 
  'source of income'
];

// AB 1466 restricted terms - discriminatory language in property documents
const AB1466_KEYWORDS = [
  // Race/Color restrictions
  { term: 'caucasian', category: 'race' },
  { term: 'white persons', category: 'race' },
  { term: 'white people', category: 'race' },
  { term: 'white race', category: 'race' },
  { term: 'negro', category: 'race' },
  { term: 'colored', category: 'race' },
  { term: 'colored person', category: 'race' },
  { term: 'african', category: 'race' },
  { term: 'asian', category: 'race' },
  { term: 'oriental', category: 'race' },
  { term: 'chinese', category: 'race' },
  { term: 'japanese', category: 'race' },
  { term: 'mexican', category: 'race' },
  { term: 'hispanic', category: 'race' },
  { term: 'semitic', category: 'race' },
  { term: 'aryan', category: 'race' },
  { term: 'mongolian', category: 'race' },
  { term: 'malay', category: 'race' },
  { term: 'ethiopian', category: 'race' },
  { term: 'indian', category: 'race' },
  
  // Religious restrictions
  { term: 'jewish', category: 'religion' },
  { term: 'hebrew', category: 'religion' },
  { term: 'catholic', category: 'religion' },
  { term: 'muslim', category: 'religion' },
  { term: 'protestant', category: 'religion' },
  
  // National origin/ancestry
  { term: 'foreign born', category: 'national_origin' },
  { term: 'alien', category: 'national_origin' },
  { term: 'foreigner', category: 'national_origin' },
  
  // Gender/Sex/Familial status
  { term: 'unmarried persons', category: 'marital_status' },
  { term: 'single persons', category: 'marital_status' },
  { term: 'families with children', category: 'familial_status' },
  
  // Restrictive covenant phrases (trigger words)
  { term: 'shall not be sold to', category: 'restrictive_covenant' },
  { term: 'shall not be occupied by', category: 'restrictive_covenant' },
  { term: 'shall not be leased to', category: 'restrictive_covenant' },
  { term: 'shall not be rented to', category: 'restrictive_covenant' },
  { term: 'shall not be conveyed to', category: 'restrictive_covenant' },
  { term: 'prohibited from', category: 'restrictive_covenant' },
  { term: 'restricted to', category: 'restrictive_covenant' },
  { term: 'no person of', category: 'restrictive_covenant' },
  { term: 'excepting persons of', category: 'restrictive_covenant' },
  { term: 'persons of the', category: 'restrictive_covenant' },
  { term: 'only members of', category: 'restrictive_covenant' },
  { term: 'exclusively for', category: 'restrictive_covenant' },
  { term: 'race or color', category: 'restrictive_covenant' },
  { term: 'blood or descent', category: 'restrictive_covenant' },
  { term: 'ancestry or national origin', category: 'restrictive_covenant' },
  { term: 'except domestic servants', category: 'restrictive_covenant' },
  { term: 'in the capacity of', category: 'restrictive_covenant' },
];

interface DetectedViolation {
  term: string;
  category: string;
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const { documentId, extractedText, wordBoundingBoxes, forceRedaction } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing AB 1466 redaction for document ${documentId}`);

    // Fetch document and project info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        id, file_url, file_type, project_id, batch_id, extracted_text, 
        word_bounding_boxes, ab1466_redaction_applied
      `)
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if already redacted (unless forced)
    if (document.ab1466_redaction_applied && !forceRedaction) {
      console.log('AB 1466 redaction already applied, skipping');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Redaction already applied',
          alreadyRedacted: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if project has AB 1466 enabled
    const { data: project } = await supabase
      .from('projects')
      .select('enable_ab1466_redaction')
      .eq('id', document.project_id)
      .single();

    if (!project?.enable_ab1466_redaction && !forceRedaction) {
      console.log('AB 1466 redaction not enabled for this project');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'AB 1466 redaction not enabled for project',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided text or fetch from document
    const textToAnalyze = extractedText || document.extracted_text || '';
    const boundingBoxes = wordBoundingBoxes || document.word_bounding_boxes || [];

    if (!textToAnalyze) {
      console.log('No text to analyze for AB 1466 violations');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No text available for analysis',
          violationsFound: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Detect violations using keyword matching
    const detectedViolations: DetectedViolation[] = [];
    const searchText = textToAnalyze.toLowerCase();

    for (const keyword of AB1466_KEYWORDS) {
      const searchTerm = keyword.term.toLowerCase();
      let index = searchText.indexOf(searchTerm);
      
      while (index !== -1) {
        const violation: DetectedViolation = {
          term: keyword.term,
          category: keyword.category,
          text: textToAnalyze.substring(index, index + searchTerm.length),
          confidence: 0.95
        };

        // Try to find bounding box for this text
        if (Array.isArray(boundingBoxes)) {
          const matchingBox = findBoundingBoxForText(
            searchTerm, 
            boundingBoxes, 
            index, 
            textToAnalyze
          );
          if (matchingBox) {
            violation.boundingBox = matchingBox;
          }
        }

        detectedViolations.push(violation);
        index = searchText.indexOf(searchTerm, index + 1);
      }
    }

    // Step 2: Use AI to detect additional violations (contextual analysis)
    if (LOVABLE_API_KEY && textToAnalyze.length > 50) {
      try {
        const aiViolations = await detectViolationsWithAI(
          textToAnalyze, 
          boundingBoxes,
          LOVABLE_API_KEY
        );
        
        // Merge AI-detected violations (avoid duplicates)
        for (const aiViolation of aiViolations) {
          const isDuplicate = detectedViolations.some(v => 
            v.text.toLowerCase() === aiViolation.text.toLowerCase() ||
            (v.boundingBox && aiViolation.boundingBox &&
              Math.abs(v.boundingBox.x - aiViolation.boundingBox.x) < 5 &&
              Math.abs(v.boundingBox.y - aiViolation.boundingBox.y) < 5)
          );
          if (!isDuplicate) {
            detectedViolations.push(aiViolation);
          }
        }
      } catch (aiError) {
        console.warn('AI violation detection failed, using keyword-only:', aiError);
      }
    }

    console.log(`Detected ${detectedViolations.length} AB 1466 violations`);

    // Step 3: If we have violations but no bounding boxes, use AI vision to locate them
    const violationsWithoutBoxes = detectedViolations.filter(v => !v.boundingBox);
    if (LOVABLE_API_KEY && violationsWithoutBoxes.length > 0 && document.file_url) {
      console.log(`Using AI Vision to locate ${violationsWithoutBoxes.length} violations without bounding boxes`);
      try {
        const termsToFind = violationsWithoutBoxes.map(v => v.text);
        const visionResults = await detectViolationsWithAIVision(
          document.file_url,
          supabase,
          document,
          LOVABLE_API_KEY,
          termsToFind
        );
        
        console.log(`AI Vision found ${visionResults.length} violations with bounding boxes`);
        
        // Update existing violations with bounding boxes from vision
        // Track which violations have been assigned to avoid re-assignment
        const assignedIndices = new Set<number>();
        
        for (const visionResult of visionResults) {
          if (!visionResult.boundingBox) continue;
          
          // Find a matching violation that doesn't already have a bounding box
          // and hasn't been assigned in this loop
          const matchIdx = detectedViolations.findIndex((v, idx) => 
            !assignedIndices.has(idx) &&
            !v.boundingBox &&
            (v.text.toLowerCase().includes(visionResult.text.toLowerCase()) ||
             visionResult.text.toLowerCase().includes(v.text.toLowerCase()) ||
             v.term.toLowerCase().includes(visionResult.text.toLowerCase()) ||
             visionResult.text.toLowerCase().includes(v.term.toLowerCase()))
          );
          
          if (matchIdx !== -1) {
            // Assign bounding box to this violation
            detectedViolations[matchIdx].boundingBox = visionResult.boundingBox;
            assignedIndices.add(matchIdx);
            console.log(`Assigned bbox to violation ${matchIdx}: "${detectedViolations[matchIdx].term}"`);
          } else {
            // New violation found by vision - add it
            detectedViolations.push(visionResult);
            console.log(`Added new vision-detected violation: "${visionResult.text}"`);
          }
        }
      } catch (visionError) {
        console.warn('AI Vision bounding box detection failed:', visionError);
      }
    }

    if (detectedViolations.length === 0) {
      // No violations found - update document to mark as checked
      await supabase
        .from('documents')
        .update({
          ab1466_violations_detected: false,
          ab1466_violation_count: 0,
          ab1466_redaction_applied: true,
          ab1466_detected_terms: []
        })
        .eq('id', documentId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          violationsFound: 0,
          message: 'No AB 1466 violations detected' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Generate actual redacted image using AI (no bounding boxes needed)
    let redactedFilePath: string | null = null;

    if (detectedViolations.length > 0 && LOVABLE_API_KEY) {
      // Only redact the discriminatory protected-class terms (NOT whole restrictive clauses)
      const redactionViolations = detectedViolations.filter(v =>
        ['race', 'religion', 'national_origin', 'marital_status', 'familial_status'].includes(v.category)
      );

      console.log(
        `Generating server-side redacted image for ${redactionViolations.length}/${detectedViolations.length} violations (word-level protected-class terms only)`
      );

      try {
        redactedFilePath = await generateRedactedImage(
          supabase,
          document,
          redactionViolations,
          LOVABLE_API_KEY
        );
        if (redactedFilePath) {
          console.log(`Redacted image created: ${redactedFilePath}`);
        }
      } catch (redactError) {
        console.warn('Failed to generate redacted image:', redactError);
      }
    }

    // Step 4: Update document with violation info and redacted file path
    const updateData: any = {
      ab1466_violations_detected: true,
      ab1466_violation_count: detectedViolations.length,
      ab1466_redaction_applied: true,
      ab1466_detected_terms: detectedViolations.map(v => ({
        term: v.term,
        category: v.category,
        text: v.text,
        confidence: v.confidence,
        boundingBox: v.boundingBox
      })),
      redacted_file_url: redactedFilePath, // Store path to actual redacted image
      needs_review: true // Flag for manual review
    };

    await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    // Log to audit trail
    await supabase
      .from('audit_trail')
      .insert({
        action_type: 'ab1466_auto_redaction',
        entity_type: 'document',
        entity_id: documentId,
        metadata: {
          violations_count: detectedViolations.length,
          categories: [...new Set(detectedViolations.map(v => v.category))],
          redacted_image_created: !!redactedFilePath
        },
        success: true
      });

    return new Response(
      JSON.stringify({
        success: true,
        violationsFound: detectedViolations.length,
        violations: detectedViolations,
        redactedImagePath: redactedFilePath,
        message: `Detected and processed ${detectedViolations.length} AB 1466 violation(s)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-redact-ab1466:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Find bounding box for detected text using word-level boxes
 */
function findBoundingBoxForText(
  searchTerm: string,
  wordBoxes: any[],
  textIndex: number,
  fullText: string
): { x: number; y: number; width: number; height: number } | null {
  if (!Array.isArray(wordBoxes) || wordBoxes.length === 0) return null;

  const searchWords = searchTerm.toLowerCase().split(/\s+/);
  const normalizedBoxes = wordBoxes
    .filter(b => b && b.text && b.bbox)
    .map(b => ({
      text: String(b.text).toLowerCase().replace(/[^a-z0-9]/gi, ''),
      bbox: b.bbox
    }));

  // Single word search
  if (searchWords.length === 1) {
    const match = normalizedBoxes.find(b => b.text.includes(searchWords[0]));
    if (match) return match.bbox;
  }

  // Multi-word phrase - find consecutive matching boxes
  for (let i = 0; i <= normalizedBoxes.length - searchWords.length; i++) {
    let allMatch = true;
    for (let j = 0; j < searchWords.length; j++) {
      const word = searchWords[j].replace(/[^a-z0-9]/gi, '');
      if (!normalizedBoxes[i + j]?.text.includes(word)) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch) {
      // Merge bounding boxes
      const matchedBoxes = normalizedBoxes.slice(i, i + searchWords.length).map(b => b.bbox);
      const x1 = Math.min(...matchedBoxes.map(b => b.x));
      const y1 = Math.min(...matchedBoxes.map(b => b.y));
      const x2 = Math.max(...matchedBoxes.map(b => b.x + b.width));
      const y2 = Math.max(...matchedBoxes.map(b => b.y + b.height));
      
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }
  }

  return null;
}

/**
 * Use AI vision to detect violations AND get bounding boxes directly from the image
 */
async function detectViolationsWithAIVision(
  imageUrl: string,
  supabase: any,
  document: any,
  apiKey: string,
  existingViolationTerms: string[]
): Promise<DetectedViolation[]> {
  try {
    // Download the image to get base64
    const fileName = document.file_url?.split('/').pop();
    const batchId = document.batch_id || 'unknown-batch';
    const storagePath = `${batchId}/${fileName}`;

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !fileBlob) {
      console.error('Failed to download image for AI vision:', downloadError);
      return [];
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binaryString);
    
    const mimeType = document.file_type || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    console.log('AI Vision searching for FULL restrictive covenant clauses (AB1466 compliance)');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an expert at identifying discriminatory words/phrases in property documents for California AB 1466 compliance.

TASK: Find EACH INDIVIDUAL discriminatory word or short phrase and provide PRECISE bounding boxes for EACH ONE SEPARATELY.

DISCRIMINATORY TERMS TO FIND (provide separate bounding box for EACH occurrence):
- Racial terms: "Caucasian", "white", "negro", "colored", "African", "Asiatic", "Mongolian", "Ethiopian", "Mexican", "Chinese", "Japanese", "Indian"
- Phrases: "of the white race", "of African descent", "of the Caucasian race", "persons of color"
- Restriction phrases: "shall not be sold to", "shall not be occupied by", "shall not be conveyed to", "shall not be leased to"
- Domestic servant exceptions: "domestic servant", "servants quarters"
- Religious/origin terms when used restrictively

CRITICAL - RETURN SEPARATE BOUNDING BOX FOR EACH WORD/PHRASE:
- Do NOT try to cover entire paragraphs
- Each discriminatory word/phrase gets its OWN bounding box
- Be PRECISE - box should tightly fit the specific word/phrase only

BOUNDING BOX PRECISION:
- x = exact left edge of THIS specific word (percentage 0-100)
- y = exact top edge of THIS word's line (percentage 0-100)  
- width = exact width of THIS word only (not the whole line)
- height = height of just this single line of text (typically 2-4% of page)

EXAMPLE - For "No person of the Caucasian race shall...", return MULTIPLE boxes:
[
  {"text":"Caucasian","boundingBox":{"x":45,"y":32,"width":8,"height":2}},
  {"text":"race","boundingBox":{"x":55,"y":32,"width":4,"height":2}}
]

Return [] if no violations. Output ONLY valid JSON array, no explanation.`
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl }
              }
            ]
          }
        ],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Vision API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '[]';
    
    console.log('AI Vision raw response (first 1000 chars):', content.substring(0, 1000));
    
    // Clean response - remove any markdown or extra text
    content = content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/```json?\s*/gi, '').replace(/```\s*/g, '');
    }
    
    // Find the JSON array
    const startIdx = content.indexOf('[');
    const endIdx = content.lastIndexOf(']');
    
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.log('No valid JSON array found in AI response');
      return [];
    }
    
    const jsonStr = content.substring(startIdx, endIdx + 1);
    
    let aiResults;
    try {
      aiResults = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI JSON:', parseError, 'Content:', jsonStr.substring(0, 300));
      return [];
    }
    
    if (!Array.isArray(aiResults)) {
      console.log('AI response is not an array');
      return [];
    }
    
    console.log(`AI Vision parsed ${aiResults.length} results`);
    
    return aiResults.map((result: any) => {
      const violation: DetectedViolation = {
        term: result.text || '',
        category: result.category || 'restrictive_covenant',
        text: result.text || '',
        confidence: 0.90
      };

      if (result.boundingBox) {
        const bbox = result.boundingBox;
        // Validate bounding box values are reasonable percentages
        if (typeof bbox.x === 'number' && typeof bbox.y === 'number' &&
            typeof bbox.width === 'number' && typeof bbox.height === 'number' &&
            bbox.x >= 0 && bbox.x <= 100 && 
            bbox.y >= 0 && bbox.y <= 100 &&
            bbox.width > 0 && bbox.width <= 100 &&
            bbox.height > 0 && bbox.height <= 100) {
          violation.boundingBox = {
            x: Number(bbox.x),
            y: Number(bbox.y),
            width: Number(bbox.width),
            height: Number(bbox.height)
          };
          console.log(`Found bbox for "${result.text}": x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`);
        } else {
          console.log(`Invalid bbox for "${result.text}":`, bbox);
        }
      }

      return violation;
    }).filter((v: DetectedViolation) => v.text && v.boundingBox);
  } catch (error) {
    console.error('AI Vision detection error:', error);
    return [];
  }
}

/**
 * Use AI to detect contextual violations not caught by keyword matching
 * Focuses on finding FULL RESTRICTIVE COVENANT CLAUSES, not individual words
 */
async function detectViolationsWithAI(
  text: string,
  wordBoxes: any[],
  apiKey: string
): Promise<DetectedViolation[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert in California AB 1466 compliance for unlawfully restrictive covenants.

AB 1466 requires identifying restrictions based on ANY protected class:
Race, Color, Religion, Sex, Gender, Gender identity, Gender expression, Sexual orientation, Familial status, Marital status, National origin, Ancestry, Disability, Veteran/military status, Genetic information, Source of income.

Find COMPLETE restrictive clauses/sentences - the exact text that needs redaction.

EXAMPLES:
1. "No lot shall be used or occupied by any person whose blood is not entirely that of the white or Caucasian race, excepting persons kept thereon strictly in the capacity of a domestic servant"
2. "No person of African or Asiatic descent shall be permitted to own or purchase the above described premises."
3. "shall not sell or convey to a person not of the Caucasian race except as domestic servants"

Return ONLY a JSON array:
[{"text":"exact restrictive text","category":"restrictive_covenant","reason":"brief reason"}]

If no violations, return []. No explanatory text.`
        },
        {
          role: 'user',
          content: `Find ALL unlawfully restrictive covenant language in this property document:\n\n${text.substring(0, 8000)}`
        }
      ],
      max_tokens: 3000
    })
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  
  try {
    // Parse AI response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const aiResults = JSON.parse(jsonMatch[0]);
    
    return aiResults.map((result: any) => {
      const violation: DetectedViolation = {
        term: result.text || '',
        category: result.category || 'restrictive_covenant',
        text: result.text || '',
        confidence: 0.85 // AI-detected confidence slightly lower
      };

      // Try to find bounding box
      if (Array.isArray(wordBoxes) && result.text) {
        const bbox = findBoundingBoxForText(result.text, wordBoxes, 0, text);
        if (bbox) violation.boundingBox = bbox;
      }

      return violation;
    }).filter((v: DetectedViolation) => v.text);
  } catch {
    return [];
  }
}

/**
 * Generate metadata for client-side redaction rendering
 */
function generateRedactionMetadata(storagePath: string, violations: DetectedViolation[]): string {
  const metadata = {
    originalFile: storagePath,
    redactionBoxes: violations.map(v => ({
      ...v.boundingBox,
      category: v.category,
      term: v.term
    })),
    createdAt: new Date().toISOString(),
    violationCount: violations.length,
    renderClientSide: true
  };
  console.log(`Generated redaction metadata with ${violations.length} boxes`);
  return JSON.stringify(metadata);
}

/**
 * Generate a redacted version of the document image using CANVAS (reliable pixel-level drawing)
 * Draws solid black rectangles over discriminatory text - NO AI IMAGE GENERATION
 */
async function generateRedactedImage(
  supabase: any,
  document: any,
  violations: DetectedViolation[],
  apiKey: string
): Promise<string | null> {
  // Get word bounding boxes from document for accurate redaction
  const wordBoxes = document.word_bounding_boxes || [];

  // IMPORTANT: Redact ONLY explicit protected-class discriminatory terms (word-level).
  // Do NOT redact full clauses or generic restriction words like "shall", "not", "banned".
  const termsToRedact = [...new Set(violations.map(v => v.term.toLowerCase().trim()))]
    .filter(Boolean);

  if (termsToRedact.length === 0) {
    console.log('No discriminatory terms to redact');
    return null;
  }

  // Download original file
  const fileName = document.file_url?.split('/').pop();
  const batchId = document.batch_id || 'unknown-batch';
  const storagePath = `${batchId}/${fileName}`;

  console.log(`Downloading original file: ${storagePath}`);

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (downloadError || !fileBlob) {
    console.error('Failed to download original file:', downloadError);
    return null;
  }

  // Determine mime type
  const ext = fileName?.split('.').pop()?.toLowerCase() || 'png';
  const mimeType = ext === 'pdf' ? 'application/pdf' :
                   ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                   ext === 'png' ? 'image/png' : 'image/png';

  // For PDFs, we can't use image editing
  if (mimeType === 'application/pdf') {
    console.log('PDF detected - cannot generate server-side redaction');
    return null;
  }

  console.log(`Found ${wordBoxes.length} word boxes, searching for ${termsToRedact.length} terms`);

  // Find word boxes that match discriminatory terms
  const boxesToRedact: Array<{x: number, y: number, width: number, height: number, isPercentage: boolean}> = [];

  // Canonical AB1466 protected-class terms we redact (tight word-level)
  const protectedTerms = new Set<string>([
    // Race / color / ancestry words
    'white', 'caucasian', 'caucasion', 'negro', 'negros', 'colored',
    'african', 'asiatic', 'ethiopian', 'mongolian', 'malay', 'oriental',
    'aryan', 'semitic', 'race', 'descent', 'blood',
    // Common nationalities/ethnicities historically used
    'mexican', 'chinese', 'japanese', 'indian', 'hindu', 'filipino', 'filipine',
    // Religion
    'jewish', 'hebrew', 'catholic', 'muslim', 'protestant'
  ]);

  // Only add multi-word phrases that contain canonical protected terms
  // DO NOT add arbitrary words from AI detection - stick to AB1466 defined terms only
  for (const t of termsToRedact) {
    const cleaned = t.replace(/[^a-z\s]/g, '').trim();
    if (!cleaned) continue;

    // Only consider multi-word phrases that contain at least one canonical protected term
    // Examples: "white persons", "colored person", "negro race", "Asiatic descent"
    if (cleaned.includes(' ')) {
      const parts = cleaned.split(/\s+/).filter(Boolean);
      if (parts.some(p => protectedTerms.has(p))) {
        protectedTerms.add(cleaned);
      }
    }
    // DO NOT add single words - only use the canonical protectedTerms set above
  }

  // 1) Exact word matches from OCR word boxes
  for (const wordBox of wordBoxes) {
    const rawText = String(wordBox.text || '').toLowerCase().trim();
    const wordText = rawText.replace(/[^a-z]/g, '');
    if (!wordText || wordText.length < 3) continue;

    if (protectedTerms.has(wordText) && wordBox.bbox && typeof wordBox.bbox.x === 'number') {
      boxesToRedact.push({
        x: wordBox.bbox.x,
        y: wordBox.bbox.y,
        width: wordBox.bbox.width || wordBox.bbox.w || 5,
        height: wordBox.bbox.height || wordBox.bbox.h || 2,
        isPercentage: wordBox.bbox.x <= 100 && wordBox.bbox.y <= 100
      });
      console.log(`Matched protected term "${wordText}" at bbox:`, wordBox.bbox);
    }
  }

  // 2) Multi-word protected phrases (tight merged boxes)
  const phraseTerms = [...protectedTerms].filter(t => t.includes(' '));
  for (const phrase of phraseTerms) {
    const bbox = findBoundingBoxForText(phrase, wordBoxes, 0, '');
    if (bbox) {
      boxesToRedact.push({
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        isPercentage: bbox.x <= 100 && bbox.y <= 100
      });
      console.log(`Matched protected phrase "${phrase}" via merged bbox:`, bbox);
    }
  }

  // Also add violations that came with bounding boxes
  for (const v of violations) {
    if (v.boundingBox) {
      const exists = boxesToRedact.some(b => 
        Math.abs(b.x - v.boundingBox!.x) < 2 && Math.abs(b.y - v.boundingBox!.y) < 2
      );
      if (!exists) {
        boxesToRedact.push({
          x: v.boundingBox.x,
          y: v.boundingBox.y,
          width: v.boundingBox.width,
          height: v.boundingBox.height,
          isPercentage: v.boundingBox.x <= 100 && v.boundingBox.y <= 100
        });
      }
    }
  }

  console.log(`Found ${boxesToRedact.length} boxes to redact`);

  // If no word boxes matched, try AI vision to detect coordinates
  if (boxesToRedact.length === 0 && apiKey) {
    console.log('No word boxes matched - falling back to AI vision for box detection');
    
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binaryString);
    
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Find ALL discriminatory words in this property document that violate California AB 1466.

Return a JSON array of bounding boxes (as percentages 0-100) for EACH discriminatory word separately:
[{"x": 10, "y": 20, "width": 8, "height": 2, "text": "word"}]

IMPORTANT: Find these EXACT words and provide TIGHT bounding boxes for EACH:
- "white", "Caucasian", "negro", "colored", "race", "blood", "descent"
- "African", "Asiatic", "Ethiopian", "Mongolian", "Mexican", "Chinese", "Japanese", "Indian"
- "domestic servant", "persons of", "not of the"

Return ONLY the JSON array. Each word gets its OWN small bounding box.`
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64}` }
                }
              ]
            }
          ],
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const aiBoxes = JSON.parse(jsonMatch[0]);
          aiBoxes.forEach((box: any) => {
            if (typeof box.x === 'number' && typeof box.y === 'number') {
              boxesToRedact.push({
                x: box.x,
                y: box.y,
                width: box.width || 10,
                height: box.height || 3,
                isPercentage: true
              });
            }
          });
          console.log(`AI detected ${aiBoxes.length} additional boxes`);
        }
      }
    } catch (e) {
      console.error('AI box detection failed:', e);
    }
  }

  if (boxesToRedact.length === 0) {
    console.log('No boxes to redact - cannot generate redacted image');
    return null;
  }

  // === USE CANVAS TO DRAW SOLID BLACK RECTANGLES ===
  try {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Load image into canvas
    const image = await loadImage(uint8Array);
    const imgWidth = image.width();
    const imgHeight = image.height();
    
    console.log(`Image loaded: ${imgWidth}x${imgHeight}`);
    
    // Create canvas with same dimensions
    const canvas = createCanvas(imgWidth, imgHeight);
    const ctx = canvas.getContext("2d");
    
    // Draw original image onto canvas
    ctx.drawImage(image, 0, 0);
    
    // Draw solid black rectangles over each violation
    ctx.fillStyle = "#000000";  // Pure black
    
    // Tight word-level redaction - minimal padding to just cover the text
    // No artificial minimums that cause huge blocks
    
    for (const box of boxesToRedact) {
      let x: number, y: number, width: number, height: number;
      
      if (box.isPercentage) {
        // Convert percentage to pixels
        x = (box.x / 100) * imgWidth;
        y = (box.y / 100) * imgHeight;
        width = (box.width / 100) * imgWidth;
        height = (box.height / 100) * imgHeight;
      } else {
        // Already in pixels
        x = box.x;
        y = box.y;
        width = box.width;
        height = box.height;
      }
      
      // Sanity check - skip invalid boxes
      if (width <= 0 || height <= 0) continue;
      
      // Add MINIMAL padding (just 10% on each side to ensure text is fully covered)
      const padX = Math.max(2, width * 0.1);
      const padY = Math.max(2, height * 0.15);
      x = Math.max(0, x - padX);
      y = Math.max(0, y - padY);
      width = Math.min(width + padX * 2, imgWidth - x);
      height = Math.min(height + padY * 2, imgHeight - y);
      
      console.log(`Drawing tight black box at (${x.toFixed(0)}, ${y.toFixed(0)}) size ${width.toFixed(0)}x${height.toFixed(0)}`);
      
      // Draw solid black rectangle
      ctx.fillRect(x, y, width, height);
    }
    
    // Convert canvas to PNG buffer
    const buffer = canvas.toBuffer("image/png");
    console.log(`Generated redacted image: ${buffer.length} bytes`);
    
    // Upload redacted image
    const redactedFileName = `redacted_ab1466_${fileName.replace(/\.[^.]+$/, '')}_${Date.now()}.png`;
    const redactedPath = `${batchId}/${redactedFileName}`;

    console.log(`Uploading redacted image to: ${redactedPath}`);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(redactedPath, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Failed to upload redacted image:', uploadError);
      return null;
    }

    console.log(`Successfully created redacted image with CANVAS: ${redactedPath}`);
    return redactedPath;
    
  } catch (canvasError) {
    console.error('Canvas redaction failed:', canvasError);
    return null;
  }
}
