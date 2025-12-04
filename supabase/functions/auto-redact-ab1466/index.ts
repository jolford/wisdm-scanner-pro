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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AB 1466 restricted terms - discriminatory language in property documents
const AB1466_KEYWORDS = [
  // Race-based restrictions
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
  
  // National origin
  { term: 'foreign born', category: 'national_origin' },
  { term: 'alien', category: 'national_origin' },
  { term: 'foreigner', category: 'national_origin' },
  
  // Common restrictive covenant phrases
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
        for (const visionResult of visionResults) {
          const matchingViolation = detectedViolations.find(v => 
            v.text.toLowerCase().includes(visionResult.text.toLowerCase()) ||
            visionResult.text.toLowerCase().includes(v.text.toLowerCase())
          );
          
          if (matchingViolation && !matchingViolation.boundingBox && visionResult.boundingBox) {
            matchingViolation.boundingBox = visionResult.boundingBox;
          } else if (!matchingViolation && visionResult.boundingBox) {
            // New violation found by vision
            detectedViolations.push(visionResult);
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

    // Step 3: Generate redaction metadata (NOT a redacted image URL)
    const violationsWithBoxes = detectedViolations.filter(v => v.boundingBox);
    let redactionMetadata = null;

    if (violationsWithBoxes.length > 0) {
      // Store redaction boxes as metadata for client-side rendering
      // Do NOT set redacted_file_url to a JSON path - keep original image URL
      redactionMetadata = {
        redactionBoxes: violationsWithBoxes.map(v => ({
          ...v.boundingBox,
          category: v.category,
          term: v.term,
          padding: 5
        })),
        createdAt: new Date().toISOString(),
        violationCount: violationsWithBoxes.length
      };
      console.log('Generated redaction metadata with', violationsWithBoxes.length, 'boxes');
    }

    // Step 4: Update document with violation info
    // IMPORTANT: Do NOT set redacted_file_url - keep using original image
    // The client renders redaction boxes as overlays using ab1466_detected_terms
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
      redaction_metadata: redactionMetadata,
      redacted_file_url: null, // Clear any previously set JSON path
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
          redaction_boxes_count: violationsWithBoxes.length
        },
        success: true
      });

    return new Response(
      JSON.stringify({
        success: true,
        violationsFound: detectedViolations.length,
        violations: detectedViolations,
        redactionMetadata,
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

    // Focus on specific discriminatory keywords that are easy to locate
    const targetKeywords = [
      'negro', 'colored', 'caucasian', 'white', 'asian', 'oriental',
      'african', 'chinese', 'japanese', 'mexican', 'hispanic', 'jewish',
      'hebrew', 'aryan', 'mongolian', 'semitic', 'malay', 'ethiopian'
    ];
    
    // Also include short detected terms
    const shortTerms = existingViolationTerms
      .filter(t => t.length < 30)
      .map(t => t.toLowerCase())
      .slice(0, 10);
    
    const allTargets = [...new Set([...targetKeywords, ...shortTerms])];
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Use Pro for better vision accuracy
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this property document for California AB 1466 discriminatory language that must be redacted.

FIND these discriminatory words: ${allTargets.join(', ')}

RETURN a JSON array with bounding boxes that FULLY COVER each word for redaction:

FORMAT: [{"text":"word","category":"race","boundingBox":{"x":LEFT,"y":TOP,"width":WIDTH,"height":HEIGHT}}]

BOUNDING BOX RULES (all values are PERCENTAGES 0-100):
- x = left edge (0=left margin, 100=right margin)
- y = TOP of the text (not bottom!)
- width = word width (typically 5-15% for single words)
- height = FULL text line height (typically 3-5% to COVER the word completely)

CRITICAL: The box must be tall enough to COMPLETELY HIDE the word when filled black. A typical text line is 3-5% of image height.

EXAMPLE for word "caucasian" at middle of page:
{"text":"caucasian","category":"race","boundingBox":{"x":45,"y":50,"width":12,"height":4}}

Return [] if nothing found. No markdown, no explanation - ONLY the JSON array.`
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
          content: `You are an expert in California AB 1466 compliance. Analyze property documents for unlawfully restrictive covenant language that discriminates based on race, color, religion, sex, sexual orientation, familial status, marital status, disability, veteran or military status, national origin, source of income, or genetic information.

Return ONLY a JSON array of detected violations. Each violation should have:
- "text": the exact discriminatory text found
- "category": one of "race", "religion", "national_origin", "familial_status", "disability", "restrictive_covenant"
- "reason": brief explanation of why this is a violation

If no violations found, return an empty array: []
DO NOT include any explanatory text, only the JSON array.`
        },
        {
          role: 'user',
          content: `Analyze this property document text for AB 1466 violations:\n\n${text.substring(0, 8000)}`
        }
      ],
      max_tokens: 2000
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
 * Generate a redacted version of the document image
 * Uses canvas-like approach via image manipulation
 */
async function generateRedactedImage(
  supabase: any,
  document: any,
  violations: DetectedViolation[]
): Promise<string | null> {
  // Download original file
  const fileName = document.file_url?.split('/').pop();
  const batchId = document.batch_id || 'unknown-batch';
  const storagePath = `${batchId}/${fileName}`;

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (downloadError || !fileBlob) {
    console.error('Failed to download original file:', downloadError);
    return null;
  }

  // Convert to base64
  const arrayBuffer = await fileBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binaryString);

  // For images, we'll create redaction metadata that the client can overlay
  // For a production system, you would use an image processing library
  // Since Deno doesn't have native canvas, we store redaction boxes as metadata
  // and generate the visual redaction client-side or via a dedicated image service

  // Create redacted version metadata file
  const redactionMetadata = {
    originalFile: storagePath,
    redactionBoxes: violations.map(v => ({
      ...v.boundingBox,
      category: v.category,
      padding: 5 // pixels of padding around text
    })),
    createdAt: new Date().toISOString(),
    violationCount: violations.length
  };

  // Upload redaction metadata
  const redactedFileName = `redacted_${fileName}.json`;
  const redactedPath = `${batchId}/${redactedFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(redactedPath, JSON.stringify(redactionMetadata), {
      contentType: 'application/json',
      upsert: true
    });

  if (uploadError) {
    console.error('Failed to upload redaction metadata:', uploadError);
    return null;
  }

  // Return the storage path for the redaction metadata
  return redactedPath;
}
