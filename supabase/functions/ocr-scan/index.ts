/**
 * OCR Scan Edge Function
 * 
 * This serverless function performs Optical Character Recognition (OCR) and
 * Intelligent Character Recognition (ICR) on images and PDFs using Lovable AI.
 * 
 * Features:
 * - Extracts printed and handwritten text from documents
 * - Recognizes and reads barcodes and accessioning numbers
 * - Classifies document types (invoice, receipt, form, etc.)
 * - Extracts specific metadata fields defined by the project
 * - Optionally extracts line item tables (for invoices, receipts, etc.)
 * - Returns bounding boxes for each extracted field
 * 
 * Authentication: Required (must pass Authorization header)
 * 
 * Request body:
 * - imageData: Base64 data URL of the image (required if not PDF with text)
 * - isPdf: Boolean indicating if document is a PDF
 * - extractionFields: Array of field definitions to extract
 * - textData: Pre-extracted text from PDF (for text-based PDFs)
 * - tableExtractionFields: Optional fields for extracting line item tables
 * 
 * Response:
 * - text: Full extracted text from the document
 * - metadata: Object with extracted field values
 * - lineItems: Array of line items (if table extraction enabled)
 * - documentType: Classified document type
 * - confidence: OCR confidence score (0.0-1.0)
 * - boundingBoxes: Bounding box coordinates for each field
 */

// Import XHR polyfill for fetch API compatibility

// Import Deno standard library server
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers to allow requests from web applications
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AUTHENTICATION CHECK ---
    // Verify that the request includes an Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- PARSE REQUEST BODY ---
    // Extract parameters from the request
    const { imageData, isPdf, extractionFields, textData, tableExtractionFields, enableCheckScanning, documentId, customerId } = await req.json();
    
    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image');
    console.log('MICR Mode:', enableCheckScanning);
    console.log('Extraction fields:', extractionFields);
    console.log('Table extraction fields:', tableExtractionFields);

    // --- API KEY VALIDATION ---
    // Get Lovable AI API key from environment (auto-configured)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('Service configuration error');
    }

    // --- PDF TEXT REQUIREMENT ---
    // For PDFs, we require textData to be provided (extracted client-side for better performance)
    if (isPdf && !textData) {
      throw new Error('PDF text extraction required. Please ensure text is extracted before sending.');
    }

    // --- BUILD AI PROMPT ---
    // Create optimized prompts for the AI model to extract text, classify document,
    // identify specific fields with bounding box coordinates
    let systemPrompt = 'You are an advanced OCR, ICR, and document classification system. Extract all text from documents including printed text, handwritten text, cursive writing, and barcodes. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other). Be very careful to accurately recognize handwritten characters and barcode labels. For each extracted field, provide approximate bounding box coordinates (x, y, width, height) as percentages of the document dimensions (0-100).';
    let userPrompt = 'Extract all text from this document, including any handwritten text. Classify the document type. Pay special attention to handwritten characters, cursive writing, and barcode labels. For each field value, estimate its location on the document as bounding box coordinates.';
    
    // Add MICR-specific instructions if check scanning is enabled
    if (enableCheckScanning) {
      systemPrompt += '\n\nSPECIALIZED CHECK/MICR EXTRACTION: You are also specialized in reading checks and MICR (Magnetic Ink Character Recognition) lines. The MICR line is typically at the bottom of checks and contains routing number, account number, and check number in a specific format. Extract these with extreme accuracy.';
      userPrompt = 'This is a CHECK document. Extract the MICR line information from the bottom of the check:\n- Routing Number (9 digits)\n- Account Number (variable length)\n- Check Number (variable length)\n- Amount (written and/or numeric)\nThe MICR line uses special characters: ⑆ (transit), ⑈ (amount), ⑉ (on-us). Format: ⑆routing⑆ account⑈ check⑉\nAlso extract any other visible check information. For each field, provide bounding box coordinates.';
    }
    
    // Determine if we need to extract line item tables (for invoices, receipts, etc.)
    const hasTableExtraction = tableExtractionFields && Array.isArray(tableExtractionFields) && tableExtractionFields.length > 0;
    
    
    // --- BUILD SPECIALIZED PROMPTS BASED ON EXTRACTION REQUIREMENTS ---
    if (extractionFields && extractionFields.length > 0) {
      const fieldNames = extractionFields.map((f: any) => f.name);
      
      // Check if this is a medical/lab form with accessioning/requisition numbers
      // These require special handling for accurate barcode recognition
      const hasAccessioningField = extractionFields.some((f: any) => 
        f.name.toLowerCase().includes('accessioning') || 
        f.name.toLowerCase().includes('requisition')
      );
      
      if (hasAccessioningField) {
        // SPECIALIZED PROMPT FOR BARCODE/ACCESSIONING NUMBER EXTRACTION
        // These numbers are critical for lab forms and must be extracted with high accuracy
        const baseJson = `{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "extracted value", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting. 

You are an advanced OCR system. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

BARCODE/ACCESSIONING EXTRACTION RULES:
1. Look for barcode labels (typically upper right corner)
2. Accessioning numbers follow formats: CL####-######## or EN####-########
3. Read human-readable text below/adjacent to barcode
4. Verify each digit and hyphen

RESPONSE REQUIREMENTS:
- Return ONLY the JSON object
- NO markdown code blocks (\`\`\`json)
- NO explanatory text before or after JSON
- Use double quotes for all strings
- Ensure valid JSON syntax`;

        // Add table extraction instructions if needed
        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = ` Extract ALL rows from line item tables into "lineItems" array with fields: ${tableExtractionFields.map((f: any) => f.name).join(', ')}.`;
        }

        userPrompt = `Extract from this ${isPdf ? 'PDF' : 'image'}: ${fieldNames.join(', ')}.${tableInstructions} Classify document type. RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
      } else {
        // STANDARD PROMPT FOR GENERAL FIELD EXTRACTION
        const baseJson = `{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "extracted value", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting.

You are an advanced OCR system. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

RESPONSE REQUIREMENTS:
- Return ONLY the JSON object
- NO markdown code blocks (\`\`\`json)
- NO explanatory text before or after JSON
- Use double quotes for all strings
- Property names: use "text" not "text_content" or "text_text"
- Ensure valid JSON syntax`;
        
        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = ` Extract ALL rows from line item tables into "lineItems" array with fields: ${tableExtractionFields.map((f: any) => f.name).join(', ')}.`;
        }
        
        userPrompt = `Extract from this ${isPdf ? 'PDF' : 'image'}: ${fieldNames.join(', ')}.${tableInstructions} Classify document type. RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
      }
    } else {
      // NO CUSTOM FIELDS - JUST OCR AND CLASSIFICATION
      // Extract all text and classify the document without specific field extraction
      const baseJson = '{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0}';
      const tableJson = hasTableExtraction 
        ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
        : '';
      
      systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting.

You are an advanced OCR system. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

RESPONSE REQUIREMENTS:
- Return ONLY the JSON object
- NO markdown code blocks (\`\`\`json)
- NO explanatory text before or after JSON
- Use double quotes for all strings
- Property names: use "text" not "text_content" or "text_text"
- Ensure valid JSON syntax`;
      
      let tableInstructions = '';
      if (hasTableExtraction) {
        tableInstructions = ` Extract ALL rows from line item tables into "lineItems" array with fields: ${tableExtractionFields.map((f: any) => f.name).join(', ')}.`;
      }
      
      userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'}.${tableInstructions} Classify document type. RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
    }


    // --- CALL LOVABLE AI FOR OCR PROCESSING WITH FALLBACK ---
    // Try Gemini Pro first, fall back to Flash on failure
    let response;
    let modelUsed = 'google/gemini-2.5-flash';
    
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelUsed,
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

      // If Pro fails with timeout/error, try Flash as fallback
      if (!response.ok && (response.status === 504 || response.status >= 500)) {
        console.log('Gemini Flash failed, falling back to Flash-Lite...');
        modelUsed = 'google/gemini-2.5-flash-lite';
        
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelUsed,
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
      }
    } catch (fetchError) {
      console.error('Primary OCR call failed:', fetchError);
      throw new Error('OCR service unavailable');
    }

    console.log(`OCR processed with model: ${modelUsed}`);


    // --- ERROR HANDLING FOR AI API ---
    // Check for various error conditions and return appropriate responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      // Rate limit exceeded (429) - too many requests
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Payment required (402) - insufficient credits
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service unavailable. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Bad request (400) - invalid image format
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: 'Image format not supported. Please use JPG, PNG, or WEBP format.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Service error');
    }


    // --- PARSE AI RESPONSE ---
    // Extract the AI's response and parse the JSON data
    const data = await response.json();
    const responseText = data.choices[0].message.content;

    // Initialize result variables with defaults
    let extractedText = responseText;
    let metadata: Record<string, string> = {};
    let lineItems: any[] = [];
    let documentType = 'other';
    let confidence = 0;
    
    try {
      // Try to extract JSON from the response (AI may include extra text or markdown code blocks)
      let jsonToParse = responseText;
      
      // Remove markdown code fences if present (```json ... ```)
      if (responseText.includes('```')) {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonToParse = codeBlockMatch[1].trim();
        }
      }
      
      // Decode HTML entities first (before any other processing)
      jsonToParse = jsonToParse
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      // Try to extract JSON object - be greedy but ensure we get a complete object
      let jsonMatch = jsonToParse.match(/\{[\s\S]*\}/);
      
      // If no complete JSON found, try to find at least the start and close it
      if (!jsonMatch && jsonToParse.includes('{')) {
        console.log('Incomplete JSON detected, attempting to salvage...');
        const startIdx = jsonToParse.indexOf('{');
        let partialJson = jsonToParse.substring(startIdx);
        
        // Try to extract fullText at minimum
        const fullTextMatch = partialJson.match(/"fullText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (fullTextMatch) {
          // Build minimal valid JSON with just fullText
          jsonToParse = `{"fullText": "${fullTextMatch[1]}", "documentType": "other", "confidence": 0}`;
          jsonMatch = [jsonToParse];
        }
      }
      
      if (jsonMatch) {
        let parsed;
        try {
          // Normalize inconsistent property names
          let cleanJson = jsonMatch[0]
            .replace(/"text_content":/g, '"text":')
            .replace(/"text_text":/g, '"text":')
            // Remove trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Remove control characters
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          
          parsed = JSON.parse(cleanJson);
        } catch (firstError) {
          console.error('First JSON parse attempt failed:', firstError);
          console.log('Attempting more aggressive repairs...');
          
          // Try more aggressive repairs
          let repairedJson = jsonMatch[0];
          
          // 1. Remove any control characters and normalize whitespace
          repairedJson = repairedJson.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
          
          // 2. Fix missing quotes around property names
          repairedJson = repairedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          
          // 3. Remove trailing commas
          repairedJson = repairedJson.replace(/,(\s*[}\]])/g, '$1');
          
          // 4. Fix Unicode escapes
          repairedJson = repairedJson.replace(/\\u([0-9A-Fa-f]{4})/g, (_match: string, grp: string) => String.fromCharCode(parseInt(grp, 16)));
          
          try {
            parsed = JSON.parse(repairedJson);
            console.log('JSON repair successful!');
          } catch (secondError) {
            console.error('JSON repair failed:', secondError);
            console.error('Problematic JSON (first 500 chars):', repairedJson.substring(0, 500));
            
            // Last resort: extract fullText with regex
            const fullTextMatch = repairedJson.match(/"fullText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (fullTextMatch) {
              console.log('Extracted fullText from failed JSON');
              extractedText = fullTextMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              // Use defaults for other fields and continue processing
              parsed = null; // Signal that we only have fullText
            } else {
              throw new Error('Unable to parse AI response as JSON');
            }
          }
        }
        
        // Only process parsed data if we successfully parsed it
        if (parsed) {
          extractedText = parsed.fullText || responseText;
          documentType = parsed.documentType || 'other';
          confidence = parsed.confidence || 0;
          
          // Extract field values and handle both old and new formats
          if (extractionFields && extractionFields.length > 0) {
            // Handle both formats:
            // Old: { "fieldName": "value" }
            // New: { "fieldName": { "value": "value", "bbox": {...} } }
            const fields = parsed.fields || {};
            metadata = {};
            Object.keys(fields).forEach(key => {
              if (typeof fields[key] === 'string') {
                // Old format: direct string value
                metadata[key] = fields[key];
              } else if (fields[key] && typeof fields[key] === 'object') {
                // New format: object with value and bbox
                metadata[key] = fields[key].value || fields[key];
              }
            });
          }
          
          // Extract line items if table extraction was requested
          if (hasTableExtraction && parsed.lineItems) {
            lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
          }
        }
      } else {
        throw new Error('No JSON object found in response');
      }
    } catch (e) {
      // JSON parsing failed - fallback to raw text to avoid blocking the app
      console.error('JSON parse failed, returning fallback text:', e);
      console.error('Response text (truncated):', responseText.substring(0, 1000));
      extractedText = responseText;
      metadata = {};
      lineItems = [];
      documentType = 'other';
      confidence = 0;
      // continue without throwing so user gets at least the text
    }

    // --- CALCULATION VERIFICATION ---
    // Verify line items sum matches invoice total (if both are available)
    if (lineItems && lineItems.length > 0) {
      try {
        // Calculate sum of line items
        let calculatedTotal = 0;
        let hasValidAmounts = false;
        
        lineItems.forEach((item: any) => {
          let itemAmount = 0;
          
          // Search through all item keys for amount-like fields
          for (const key of Object.keys(item)) {
            const lowerKey = key.toLowerCase();
            // Match fields containing: total, amount, price, extended, subtotal
            if (lowerKey.includes('total') || lowerKey.includes('amount') || 
                lowerKey.includes('price') || lowerKey.includes('extended') ||
                lowerKey.includes('subtotal')) {
              const value = item[key];
              if (value !== null && value !== undefined && value !== '') {
                // Parse the amount, removing currency symbols and commas
                const cleanAmount = String(value).replace(/[$,]/g, '').trim();
                const parsed = parseFloat(cleanAmount);
                if (!isNaN(parsed) && parsed !== 0) {
                  itemAmount = parsed;
                  hasValidAmounts = true;
                  break;
                }
              }
            }
          }
          
          calculatedTotal += itemAmount;
        });
        
        // Look for invoice total in metadata
        if (hasValidAmounts && metadata) {
          let invoiceTotal: number | null = null;
          
          // Search through all metadata keys for total-like fields
          for (const key of Object.keys(metadata)) {
            const lowerKey = key.toLowerCase();
            // Match fields containing: total, amount, grand, balance, due
            if (lowerKey.includes('total') || lowerKey.includes('amount') || 
                lowerKey.includes('grand') || lowerKey.includes('balance') ||
                lowerKey.includes('due')) {
              const value = metadata[key];
              if (value !== null && value !== undefined && value !== '') {
                const cleanTotal = String(value).replace(/[$,]/g, '').trim();
                const parsed = parseFloat(cleanTotal);
                if (!isNaN(parsed) && parsed > 0) {
                  invoiceTotal = parsed;
                  console.log(`Found invoice total in field '${key}': ${invoiceTotal}`);
                  break;
                }
              }
            }
          }
          
          // Calculate variance if we found an invoice total
          if (invoiceTotal !== null && invoiceTotal > 0) {
            const variance = Math.abs(calculatedTotal - invoiceTotal);
            const variancePercent = (variance / invoiceTotal) * 100;
            
            // Store variance information in metadata
            metadata['_calculatedLineItemsTotal'] = calculatedTotal.toFixed(2);
            metadata['_invoiceTotal'] = invoiceTotal.toFixed(2);
            metadata['_calculationVariance'] = variance.toFixed(2);
            metadata['_calculationVariancePercent'] = variancePercent.toFixed(2);
            metadata['_calculationMatch'] = variance < 0.01 ? 'true' : 'false';
            
            console.log(`Calculation verification: Line items total = ${calculatedTotal.toFixed(2)}, Invoice total = ${invoiceTotal.toFixed(2)}, Variance = ${variance.toFixed(2)} (${variancePercent.toFixed(2)}%)`);
          } else {
            console.log('No valid invoice total found in metadata for calculation verification');
          }
        }
      } catch (verifyError) {
        console.error('Calculation verification failed:', verifyError);
        // Don't fail the OCR due to verification errors
      }
    }

    console.log('OCR completed - Document Type:', documentType, 'Confidence:', confidence, 'Metadata:', metadata, 'Line Items:', lineItems.length);

    // --- TWO-PASS VALIDATION DISABLED FOR PERFORMANCE ---
    // Previously: If confidence < 0.85, ran second validation pass
    // This was causing 2x processing time - disabled to restore speed
    const CONFIDENCE_THRESHOLD = 0.85;
    let validationApplied = false;
    
    // Validation pass disabled for performance
    if (false && confidence < CONFIDENCE_THRESHOLD && confidence > 0) {
      console.log(`Low confidence detected (${confidence}). Running validation pass...`);
      
      try {
        // Build validation prompt with extracted data
        const validationSystemPrompt = `You are an OCR validation expert. Your job is to:
1. Compare the extracted text against the original image
2. Fix common OCR errors (O vs 0, l vs 1, S vs 5, etc.)
3. Validate field formats (dates should be dates, amounts should be numbers)
4. Ensure extracted values match what's visible in the image
5. Return corrected JSON with same structure

CRITICAL: Return ONLY valid JSON, no explanations.`;

        const fieldsJson = extractionFields && extractionFields.length > 0
          ? JSON.stringify(metadata, null, 2)
          : null;
        
        const validationUserPrompt = fieldsJson
          ? `Original extraction (confidence: ${confidence}):
${fieldsJson}

Line items: ${lineItems.length > 0 ? JSON.stringify(lineItems, null, 2) : 'none'}

Review the image and correct any OCR errors. Common issues:
- "O" misread as "0" or vice versa
- "l" (lowercase L) vs "1" (one) vs "I" (capital i)
- "S" vs "5"
- Dates in wrong format
- Missing decimal points in amounts
- Transposed digits

Return corrected JSON in EXACT same structure.`
          : `Full text extraction (confidence: ${confidence}):
${extractedText}

Review the image and provide corrected text with any OCR errors fixed.`;

        const validationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash', // Faster model for validation
            messages: [
              {
                role: 'system',
                content: validationSystemPrompt
              },
              {
                role: 'user',
                content: textData
                  ? [{ type: 'text', text: validationUserPrompt }]
                  : [
                      { type: 'text', text: validationUserPrompt },
                      { type: 'image_url', image_url: { url: imageData } }
                    ]
              }
            ],
            temperature: 0.1,
          }),
        });

        if (validationResponse.ok) {
          const validationData = await validationResponse.json();
          const validationText = validationData.choices[0].message.content;
          
          // Try to parse validation response
          try {
            let validationJson = validationText;
            if (validationText.includes('```')) {
              const match = validationText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              if (match) validationJson = match[1].trim();
            }
            
            const jsonMatch = validationJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const validated = JSON.parse(jsonMatch[0]);
              
              // Update metadata with validated values
              if (validated.fields) {
                Object.keys(validated.fields).forEach(key => {
                  const val = validated.fields[key];
                  metadata[key] = typeof val === 'string' ? val : (val?.value || val);
                });
              }
              
              // Update line items if provided
              if (validated.lineItems && Array.isArray(validated.lineItems)) {
                lineItems = validated.lineItems;
              }
              
              // Update full text if provided
              if (validated.fullText) {
                extractedText = validated.fullText;
              }
              
              // Boost confidence after validation
              confidence = Math.min(confidence + 0.15, 0.99);
              validationApplied = true;
              
              console.log('Validation pass completed successfully. New confidence:', confidence);
            }
          } catch (parseError) {
            console.error('Failed to parse validation response:', parseError);
            // Continue with original extraction
          }
        }
      } catch (validationError) {
        console.error('Validation pass failed:', validationError);
        // Continue with original extraction
      }
    }

    // --- TRACK COST AND USAGE ---
    // Always track document usage when we know the customer
    if (customerId) {
      // Import Supabase client using service role (server-side only)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        let costUsd = 0;
        // Calculate AI cost when usage tokens are available
        try {
          const inputTokens = data?.usage?.prompt_tokens || 0;
          const outputTokens = data?.usage?.completion_tokens || 0;
          const hasUsage = inputTokens > 0 || outputTokens > 0;
          if (hasUsage) {
            const { data: costData, error: costErr } = await supabaseAdmin.rpc('calculate_ai_cost', {
              _model: modelUsed,
              _input_tokens: inputTokens,
              _output_tokens: outputTokens,
              _is_image: !isPdf,
            });
            if (!costErr && typeof costData === 'number') costUsd = costData;
          }
        } catch (e) {
          console.warn('Cost calculation skipped:', e);
        }

        // Upsert tenant usage (increments docs and total cost)
        const { error: usageErr } = await supabaseAdmin.rpc('update_tenant_usage', {
          _customer_id: customerId,
          _job_type: 'ocr_document',
          _cost_usd: costUsd,
          _documents_count: 1,
          _failed: false,
        });
        if (usageErr) console.error('Usage RPC error:', usageErr);
        else console.log('Usage tracked successfully with cost:', costUsd);
      } catch (error) {
        console.error('Failed to track usage:', error);
        // Do not fail the OCR response due to usage tracking problems
      }
    }

    // --- EXTRACT BOUNDING BOXES ---
    // Parse the response again to get bounding box coordinates for each field
    // Bounding boxes help users visually locate fields on the document
    let fieldBoundingBoxes: Record<string, any> = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.fields) {
          Object.keys(parsed.fields).forEach(key => {
            if (parsed.fields[key] && typeof parsed.fields[key] === 'object' && parsed.fields[key].bbox) {
              fieldBoundingBoxes[key] = parsed.fields[key].bbox;
            }
          });
        }
      }
    } catch (e) {
      console.log('No bounding boxes extracted');
    }

    // --- EXTRACT WORD-LEVEL BOUNDING BOXES FOR SENSITIVE LANGUAGE DETECTION ---
    // Using Flash-Lite for fast, efficient word extraction
    let wordBoundingBoxes: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }> = [];
    try {
      // For image processing (not text-based PDFs), extract word coordinates if available
      if (!textData && imageData) {
        const systemPromptWords = `You are a specialized OCR system that returns word-level bounding boxes. Return ONLY a JSON array of words with coordinates: [{"text": "word", "bbox": {"x": 0, "y": 0, "width": 10, "height": 10}}]. Use percentage coordinates (0-100). Extract ALL visible words.`;
        const userPromptWords = 'Extract all words from this image with their exact bounding box coordinates as percentages of image dimensions.';
        
        const wordsResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: systemPromptWords },
              { 
                role: 'user', 
                content: [
                  { type: 'text', text: userPromptWords },
                  { type: 'image_url', image_url: { url: imageData } }
                ]
              }
            ],
            temperature: 0.1,
          }),
        });
        
        if (wordsResponse.ok) {
          const wordsData = await wordsResponse.json();
          const wordsText = wordsData.choices[0].message.content;
          
          try {
            let jsonToParse = wordsText;
            if (wordsText.includes('```')) {
              const codeBlockMatch = wordsText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              if (codeBlockMatch) {
                jsonToParse = codeBlockMatch[1].trim();
              }
            }
            
            const jsonMatch = jsonToParse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed)) {
                wordBoundingBoxes = parsed.filter((item: any) => 
                  item && typeof item === 'object' && 
                  item.text && item.bbox &&
                  typeof item.bbox.x === 'number'
                );
              }
            }
          } catch (e) {
            console.log('Failed to parse word bounding boxes:', e);
          }
        }
      }
    } catch (e) {
      console.log('Word bounding box extraction failed (non-critical):', e);
    }

    // --- RETURN SUCCESS RESPONSE ---
    // Return all extracted data to the client
    return new Response(
      JSON.stringify({ 
        text: extractedText,              // Full document text
        metadata: metadata,               // Extracted field values
        lineItems: lineItems,             // Extracted table rows (if applicable)
        documentType: documentType,       // Classified document type
        confidence: confidence,           // OCR confidence score (boosted if validation applied)
        validationApplied: validationApplied, // Whether two-pass validation was used
        boundingBoxes: fieldBoundingBoxes, // Field locations on document
        wordBoundingBoxes: wordBoundingBoxes // Word-level coordinates for highlighting
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // --- ERROR HANDLING ---
    // Log detailed error server-side only (for debugging)
    console.error('Error in OCR function:', error);
    
    // Return safe generic message to client (don't expose internal details)
    return new Response(
      JSON.stringify({ error: 'Failed to process document. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
