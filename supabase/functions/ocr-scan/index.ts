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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
    const { imageData, isPdf, extractionFields, textData, tableExtractionFields, enableCheckScanning, documentId, customerId, projectId } = await req.json();
    
    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image');
    console.log('MICR Mode:', enableCheckScanning);
    console.log('Extraction fields:', extractionFields);
    console.log('Table extraction fields:', tableExtractionFields);
    console.log('Project ID:', projectId);

    // --- CHECK FOR ZONE TEMPLATES ---
    let zoneTemplate: any = null;
    if (projectId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
        
        const { data: templates } = await supabaseAdmin
          .from('zone_templates')
          .select(`
            *,
            zone_definitions(*)
          `)
          .eq('project_id', projectId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (templates) {
          zoneTemplate = templates;
          console.log('Found zone template:', templates.name, 'with', templates.zone_definitions?.length || 0, 'zones');
        }
      } catch (e) {
        console.log('No zone template found or error loading:', e);
      }
    }

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
    
    // Check if this is a casino voucher/jackpot slip (define early for model selection)
    const isCasinoVoucher = extractionFields && extractionFields.some((f: any) => 
      f.name.toLowerCase().includes('validation') || 
      f.name.toLowerCase().includes('ticket') ||
      f.name.toLowerCase().includes('machine')
    );
    
    // Check if this is a medical/healthcare form
    const isMedicalForm = extractionFields && extractionFields.some((f: any) => {
      const lowerName = f.name.toLowerCase();
      return lowerName.includes('patient') || 
             lowerName.includes('medical') ||
             lowerName.includes('birth') ||
             lowerName.includes('release') ||
             lowerName.includes('authorization') ||
             lowerName.includes('hipaa');
    });
    
    // --- BUILD SPECIALIZED PROMPTS BASED ON EXTRACTION REQUIREMENTS ---
    if (extractionFields && extractionFields.length > 0) {
      const fieldNames = extractionFields.map((f: any) => f.name);
      
      // Check if this is a medical/lab form with accessioning/requisition numbers
      // These require special handling for accurate barcode recognition
      const hasAccessioningField = extractionFields.some((f: any) => 
        f.name.toLowerCase().includes('accessioning') || 
        f.name.toLowerCase().includes('requisition')
      );
      
      if (isMedicalForm) {
        // SPECIALIZED PROMPT FOR MEDICAL/HEALTHCARE FORMS
        const baseJson = `{"fullText": "complete extracted text", "documentType": "medical_form", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "extracted value", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting.

You are an advanced OCR system specialized in medical and healthcare forms. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

CRITICAL EXTRACTION INSTRUCTIONS:
This is a FORM with field labels AND potentially filled-in values. You must carefully examine each field area to find ANY handwritten or typed text.

FORM FIELD EXTRACTION RULES:
1. LOOK CAREFULLY: Field labels like "Name of Patient _______" may have handwritten or typed text WRITTEN ON OR NEAR the underscores. This text IS the field value.
2. EXAMINE THOROUGHLY: Check the area immediately after each field label - if there's ANY text (handwritten, typed, printed), that's the value.
3. BLANK vs FILLED: Only return "" if the field truly has NO text written in it. If you see ANY text near the field label, extract it.
4. HANDWRITING: Pay special attention to handwritten text which may be cursive or print. Examples: "Jim Hughes", "John Doe", dates like "10/02/1940"
5. CHECKBOXES: Look for ☑, ✓, X, or filled boxes next to items. List ALL checked items separated by commas.
6. TYPED DATA: Some fields may have typed/printed pre-filled data. Extract this exactly as shown.

FIELD EXTRACTION EXAMPLES:
- If you see "Name of Patient Jim Hughes" → value is "Jim Hughes"
- If you see "Date of Birth 10/02/1940" → value is "10/02/1940"  
- If you see "Name of Patient _______" with no text → value is ""
- If you see checked boxes: ☑ History & Physical ☑ Lab Reports → value is "History & Physical, Lab Reports"

FIELD-SPECIFIC GUIDANCE:
- "Name of Patient": Look RIGHT AFTER this label for handwritten/typed name (may be on underscores)
- "Date of Birth": Look for date in MM/DD/YYYY format near this label
- "Information To Be Released or Accessed": List ALL items with checked boxes (☑, ✓, X)
- "TO: Address": Extract the COMPLETE address block including business name, phone/fax numbers, street, city, state, zip
- "FROM: Address": Extract COMPLETE address if filled, otherwise ""
- "Phone Number": Extract with full formatting including area code
- "Signature Name": Look for handwritten signature or printed name near signature line
- "Date Signed": Look for date near signature area

RESPONSE REQUIREMENTS:
- Return ONLY the JSON object
- NO markdown code blocks (\`\`\`json)
- NO explanatory text
- Extract ACTUAL VALUES from form fields, not just labels
- For truly blank fields: return ""
- For checkboxes: return comma-separated list of ALL checked items`;

        userPrompt = `This is a medical form with FILLED-IN DATA. Extract these fields: ${fieldNames.join(', ')}. 

CRITICAL: Look carefully at each field label and extract ANY handwritten or typed text you see in or near that field. If "Name of Patient" has "Jim Hughes" written on it, extract "Jim Hughes". If checkboxes are marked, list all checked items. DO NOT just return the field labels - extract the ACTUAL VALUES written in the form.

RESPOND WITH ONLY THE JSON OBJECT containing the extracted values.`;
      } else if (isCasinoVoucher) {
        // SPECIALIZED PROMPT FOR CASINO VOUCHER/JACKPOT SLIP EXTRACTION
        const baseJson = `{"fullText": "complete extracted text", "documentType": "casino_voucher", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "extracted value", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting. 

You are an advanced OCR system specialized in casino vouchers and cashout tickets. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

CASINO VOUCHER EXTRACTION RULES:
1. AMOUNT: Look for the LARGEST dollar amount prominently displayed in the CENTER of the voucher (e.g., "$100.30")
2. VALIDATION/TICKET NUMBER: Look for the BARCODE with adjacent text like "VALIDATION" followed by a long number in format ##-####-####-####-#### (e.g., "00-6644-2732-2896-8065")
3. VALIDATION DATE: Look for date near the VALIDATION text or barcode, typically in format MM/DD/YYYY (e.g., "12/3/2024")
4. MACHINE NUMBER: Look for text referencing "MACHINE" or equipment number
5. VOUCHER NUMBER: Often appears as "VOUCHER #" followed by digits

CRITICAL RULES:
- Extract the EXACT numbers as they appear - DO NOT invent or hallucinate numbers
- The prominently displayed dollar amount in large font is the voucher amount
- The validation/ticket number is the long hyphenated number near the barcode
- Verify all digits carefully - accuracy is critical

RESPONSE REQUIREMENTS:
- Return ONLY the JSON object
- NO markdown code blocks (\`\`\`json)
- NO explanatory text before or after JSON
- Use double quotes for all strings
- Ensure valid JSON syntax`;

        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = ` Extract ALL rows from line item tables into "lineItems" array with fields: ${tableExtractionFields.map((f: any) => f.name).join(', ')}.`;
        }

        userPrompt = `This is a CASINO VOUCHER or CASHOUT TICKET. Extract the following fields with EXTREME ACCURACY: ${fieldNames.join(', ')}.${tableInstructions} 

KEY REMINDERS:
- The AMOUNT is the large dollar value displayed prominently (NOT small print amounts)
- The VALIDATION/TICKET NUMBER is the long hyphenated number near the barcode (format: ##-####-####-####-####)
- Extract EXACTLY what you see - do not make up numbers

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
      } else if (hasAccessioningField) {
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
        const baseJson = `{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0, "logoDetected": {"present": false, "companyName": "", "confidence": 0.0}, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "extracted value", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        // Add field-specific extraction guidance with custom descriptions
        const fieldGuidance = extractionFields.map((field: any) => {
          const fname = field.name || field;
          const fdesc = typeof field === 'object' ? field.description : '';
          const lowerName = String(fname).toLowerCase();
          
          // If custom description provided, use it as the primary guidance
          if (fdesc && fdesc.trim()) {
            return `\n- ${fname}: ${fdesc}`;
          }
          
          // Fallback to built-in heuristics
          if (lowerName.includes('invoice') && lowerName.includes('number')) {
            return `\n- ${fname}: CRITICAL - Find the number DIRECTLY ADJACENT to the label "INVOICE NO", "INVOICE NUMBER", "INVOICE #", or "INV#" (usually upper right corner). DO NOT confuse with "CUSTOMER NO", "ACCOUNT NO", or "PURCHASE ORDER". The invoice number is the identifier specifically labeled as "INVOICE". Read ALL digits with extreme precision.`;
          }
          if (lowerName.includes('invoice') && lowerName.includes('date')) {
            return `\n- ${fname}: Usually near invoice number in header area. Format varies: MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD.`;
          }
          if (lowerName.includes('invoice') && lowerName.includes('total')) {
            return `\n- ${fname}: Look for BOTTOM RIGHT total or summary section. Often labeled "TOTAL", "AMOUNT DUE", "INVOICE TOTAL". Include currency symbol if present.`;
          }
          if (lowerName.includes('vendor') && lowerName.includes('name')) {
            return `\n- ${fname}: Usually TOP LEFT of document, company/business name above address.`;
          }
          return '';
        }).filter((g: string) => g).join('');
        
        systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting.

You are an advanced OCR system with logo recognition capabilities. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

LOGO DETECTION:
- Scan the document for any company or brand logos (graphical symbols, icons, branded designs)
- If a logo is present, identify the company/brand name
- Set "logoDetected.present" to true if a logo is found, false otherwise
- Set "logoDetected.companyName" to the identified company/brand name
- Set "logoDetected.confidence" (0.0-1.0) based on logo clarity and recognition certainty
- Common logo locations: top center, top left, header area, letterhead

FIELD EXTRACTION GUIDANCE:${fieldGuidance}

GENERAL RULES:
- Read text EXACTLY as printed - verify each digit/character
- For invoice numbers: Triple-check accuracy, these are critical identifiers
- Preserve formatting (dates, currency symbols, punctuation)
- If a field is not found, return empty string ""

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
        
        userPrompt = `Extract from this ${isPdf ? 'PDF' : 'image'}: ${fieldNames.join(', ')}.${tableInstructions}

IMPORTANT: Also identify any company or brand logos present in the document. Pay special attention to invoice number accuracy. Classify document type. RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
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


    // --- DETERMINE AI MODEL TO USE ---
    // Fetch project's AI model preference if projectId is provided
    let modelUsed = 'google/gemini-2.5-flash'; // default
    if (projectId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { data: project, error: projectError } = await supabaseAdmin
          .from('projects')
          .select('ocr_model')
          .eq('id', projectId)
          .single();
          
        if (!projectError && project?.ocr_model) {
          modelUsed = project.ocr_model;
          console.log(`Using project-configured AI model: ${modelUsed}`);
        }
      } catch (err) {
        console.warn('Failed to fetch project OCR model, using default:', err);
      }
    }
    
    // Override model for casino vouchers - GPT-5 Vision performs better on these
    if (isCasinoVoucher) {
      modelUsed = 'openai/gpt-5';
      console.log('Using GPT-5 Vision for casino voucher text extraction (template matching will refine fields)');
    }

    // --- CALL LOVABLE AI FOR OCR PROCESSING ---
    let response;
    
    // GPT-5 and newer OpenAI models don't support temperature parameter
    const supportsTemperature = !modelUsed.startsWith('openai/gpt-5');
    
    try {
      const requestBody: any = {
        model: modelUsed,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: textData ? `${userPrompt}\n\nDocument text:\n${textData}` : userPrompt
              },
              ...(imageData ? [{
                type: 'image_url',
                image_url: { url: imageData }
              }] : [])
            ]
          }
        ]
      };
      
      // Only add temperature for models that support it
      if (supportsTemperature) {
        requestBody.temperature = 0.1;
      }
      
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // If Pro fails with timeout/error, try Flash as fallback
      if (!response.ok && (response.status === 504 || response.status >= 500)) {
        console.log('Gemini Flash failed, falling back to Flash-Lite...');
        modelUsed = 'google/gemini-2.5-flash-lite';
        
        const fallbackBody: any = {
          model: modelUsed,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: textData ? `${userPrompt}\n\nDocument text:\n${textData}` : userPrompt
                },
                ...(imageData ? [{
                  type: 'image_url',
                  image_url: { url: imageData }
                }] : [])
              ]
            }
          ]
        };
        
        // Flash-lite supports temperature
        fallbackBody.temperature = 0.1;
        
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbackBody),
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
    let fieldConfidence: Record<string, number> = {};
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
          
          // Extract field values with confidence scores
          let fieldConfidence: Record<string, number> = {};
          if (extractionFields && extractionFields.length > 0) {
            // Handle both formats:
            // Old: { "fieldName": "value" }
            // New: { "fieldName": { "value": "value", "bbox": {...}, "confidence": 0.95 } }
            const fields = parsed.fields || {};
            metadata = {};
            fieldConfidence = {};
            
            console.log('Extracting fields from parsed response. Expected fields:', extractionFields.map((f: any) => f.name).join(', '));
            console.log('Fields in response:', Object.keys(fields).join(', ') || '(none)');
            
            Object.keys(fields).forEach(key => {
              if (typeof fields[key] === 'string') {
                // Old format: direct string value
                metadata[key] = fields[key];
                fieldConfidence[key] = 0.85; // Default confidence
                console.log(`Extracted field "${key}": "${fields[key]}"`);
              } else if (fields[key] && typeof fields[key] === 'object') {
                // New format: object with value, bbox, and confidence
                const value = fields[key].value || fields[key];
                const conf = fields[key].confidence || 0.85;
                metadata[key] = value;
                fieldConfidence[key] = conf;
                console.log(`Extracted field "${key}": "${value}" (confidence: ${conf})`);
              }
            });
            
            // Log missing fields
            const extractedFieldNames = Object.keys(metadata);
            const expectedFieldNames = extractionFields.map((f: any) => f.name);
            const missingFields = expectedFieldNames.filter((name: string) => !extractedFieldNames.includes(name));
            if (missingFields.length > 0) {
              console.warn('Missing expected fields:', missingFields.join(', '));
            }
          }
          
          // Skip template/zone extraction here - will be done after word bounding boxes are populated

          // Invoice-specific label-based corrections (avoid mistaking CUSTOMER NO)
          try {
            const text = (extractedText || '').toString();
            const lower = text.toLowerCase();
            const likelyInvoice = documentType === 'invoice' || lower.includes('invoice');
            if (likelyInvoice && extractionFields && extractionFields.length) {
              console.log('Applying invoice label-based extraction post-processing...');
              
              // INVOICE NUMBER extraction
              const wantsInvoiceNumber = extractionFields.some((f: any) => (f.name || '').toLowerCase().includes('invoice number'));
              if (wantsInvoiceNumber) {
                let inv = '';
                const lines = text.split('\n').map((l: string) => l.trim());

                // 0) Helper utils
                const clean = (s: string) => s.replace(/[^A-Za-z0-9-]/g, '');
                const looksLikeId = (s: string) => {
                  if (!s) return false;
                  if (/\//.test(s)) return false; // avoid dates
                  const digits = (s.match(/\d/g) || []).length;
                  if (digits < 5) return false; // invoice IDs usually 5+ digits
                  const leadingZeros = (s.match(/^0+/)?.[0]?.length || 0);
                  // Penalize numbers with many leading zeros (like 00020677) unless nothing else is found
                  return leadingZeros <= 2 || digits >= 6;
                };

                // 1) Header block pattern previously seen on some templates
                const headerIdx = lines.findIndex((ln: string) => /sales\s*person/i.test(ln) && /ship\s*date/i.test(ln) && /invoice\s*number/i.test(ln));
                if (headerIdx !== -1 && lines[headerIdx + 1]) {
                  const valuesLine = lines[headerIdx + 1];
                  const nums = valuesLine.match(/[A-Z]*\d[\d-]{4,}/g) || [];
                  const candidate = nums[nums.length - 1];
                  if (candidate && looksLikeId(candidate)) {
                    inv = clean(candidate);
                    console.log(`Found Invoice Number (header block): ${inv} from values line: ${valuesLine.substring(0, 80)}`);
                  }
                }

                // 1b) Generic header line containing "Invoice Number" or "INV #" etc.
                if (!inv) {
                  const genericHeaderIdx = lines.findIndex((ln: string) => /invoice\s*number|\binv\s*(?:no\.?|num\.?|#)?\b/i.test(ln));
                  if (genericHeaderIdx !== -1 && lines[genericHeaderIdx + 1]) {
                    const valuesLine = lines[genericHeaderIdx + 1];
                    const tokens = (valuesLine.match(/[A-Z]*\d[\d-]{3,}/g) || []).filter((t: string) => looksLikeId(t));
                    if (tokens.length) {
                      inv = clean(tokens[tokens.length - 1]);
                      console.log(`Found Invoice Number (generic header): ${inv} from values line: ${valuesLine.substring(0, 80)}`);
                    }
                  }
                }

                // 2) Explicit label anywhere (same line)
                if (!inv) {
                  for (const line of lines) {
                    const m = line.match(/(?:invoice|inv)\s*(?:no\.?|#|number|num\.?|id)?\s*[:#\-]?\s*([A-Z]*\d[\d-]{4,})/i);
                    if (m && !/customer|account/i.test(line)) {
                      const candidate = clean(m[1]).replace(/^0+(?=\d)/, '');
                      if (looksLikeId(candidate)) {
                        inv = candidate;
                        console.log(`Found Invoice Number (same-line): ${inv} from line: ${line.substring(0, 60)}`);
                        break;
                      }
                    }
                  }
                }

                // 3) Label on one line, value on next (check next 2 lines)
                if (!inv) {
                  for (let i = 0; i < lines.length - 1; i++) {
                    if (/(?:invoice|inv)\s*(?:no\.?|#|number|num\.?|id)?\s*$/i.test(lines[i]) && !/customer|account/i.test(lines[i])) {
                      for (let j = 1; j <= 2; j++) {
                        const next = (lines[i + j] || '').trim();
                        const m2 = next.match(/^([A-Z]*\d[\d-]{4,})/);
                        if (m2) {
                          const candidate = clean(m2[1]);
                          if (looksLikeId(candidate)) {
                            inv = candidate;
                            console.log(`Found Invoice Number (next-line +${j}): ${inv} from lines: ${lines[i]} / ${next}`);
                            break;
                          }
                        }
                      }
                      if (inv) break;
                    }
                  }
                }

                // 4) Fallback: search globally for "INVOICE NO" then nearest id within 40 chars
                if (!inv) {
                  const global = text.match(/(?:invoice|inv)\s*(?:no\.?|#|number|num\.?|id)?\s*[:#\-\s]{0,10}([A-Za-z]*\d[\d-]{3,})/i);
                  if (global && looksLikeId(global[1])) {
                    inv = clean(global[1]);
                    console.log(`Found Invoice Number (global proximity): ${inv}`);
                  }
                }

                if (inv) {
                  metadata['Invoice Number'] = inv;
                  if (fieldConfidence) fieldConfidence['Invoice Number'] = 0.97;
                  console.log(`✓ Label-based override applied for Invoice Number: ${inv}`);
                } else {
                  console.log('✗ No invoice number found via label-based extraction');
                }
              }
              
              // INVOICE DATE extraction
              const wantsInvoiceDate = extractionFields.some((f: any) => (f.name || '').toLowerCase().includes('invoice date'));
              if (wantsInvoiceDate) {
                let invDate = '';
                const lines = text.split('\n').map((l: string) => l.trim());

                // Helper
                const dateRe = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;

                // 1) Table header variant seen on many invoices: "INVOICE DATE | DATE SHIPPED | ..."
                const tableIdx = lines.findIndex((ln: string) => /invoice\s*date/i.test(ln) && /(ship\s*date|date\s*shipp?ed)/i.test(ln));
                if (tableIdx !== -1 && lines[tableIdx + 1]) {
                  const headerLine = lines[tableIdx];
                  const valuesLine = lines[tableIdx + 1];
                  // Pick the date token closest to the "INVOICE DATE" column position
                  const headerPos = headerLine.toLowerCase().indexOf('invoice date');
                  const matches = Array.from(valuesLine.matchAll(dateRe)) as RegExpMatchArray[];
                  if (matches.length) {
                    let best: RegExpMatchArray = matches[0] as RegExpMatchArray;
                    let bestDist = Math.abs(((best.index as number) ?? 0) - Math.max(0, headerPos));
                    for (const m of matches as RegExpMatchArray[]) {
                      const dist = Math.abs(((m.index as number) ?? 0) - Math.max(0, headerPos));
                      if (dist < bestDist) { best = m; bestDist = dist; }
                    }
                    invDate = (best[1] as string);
                    console.log(`Found Invoice Date (table header nearest-col): ${invDate} from values line: ${valuesLine.substring(0, 80)}`);
                  }
                }

                // 2) Header block pattern used on some templates (Sales Person | Ship Date | Invoice Number)
                if (!invDate) {
                  const headerIdx2 = lines.findIndex((ln: string) => /sales\s*person/i.test(ln) && /ship\s*date/i.test(ln) && /invoice\s*number/i.test(ln));
                  if (headerIdx2 !== -1 && lines[headerIdx2 + 1]) {
                    const valuesLine = lines[headerIdx2 + 1];
                    const d = valuesLine.match(dateRe);
                    if (d) {
                      invDate = d[1];
                      console.log(`Found Invoice Date (header block): ${invDate} from values line: ${valuesLine.substring(0, 80)}`);
                    }
                  }
                }

                // 3) Same-line label: "INVOICE DATE: MM/DD/YY"
                if (!invDate) {
                  for (const line of lines) {
                    const m = line.match(/(?:invoice|inv)\s*(?:date|dt\.?)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
                    if (m) {
                      invDate = m[1];
                      console.log(`Found Invoice Date (same-line): ${invDate} from line: ${line.substring(0, 60)}`);
                      break;
                    }
                  }
                }

                // 4) Next-line fallback
                if (!invDate) {
                  for (let i = 0; i < lines.length - 1; i++) {
                    if (/(?:invoice|inv)\s*(?:date|dt\.?)\s*$/i.test(lines[i])) {
                      const next = lines[i + 1].trim();
                      const m2 = next.match(dateRe);
                      if (m2) {
                        invDate = m2[1];
                        console.log(`Found Invoice Date (next-line): ${invDate}`);
                        break;
                      }
                    }
                  }
                }

                // 5) Global fallback near the label
                if (!invDate) {
                  const g = text.match(/invoice\s*(?:date|dt\.?)\s*[:\-\s]{0,10}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
                  if (g) {
                    invDate = g[1];
                    console.log(`Found Invoice Date (global proximity): ${invDate}`);
                  }
                }

                if (invDate) {
                  metadata['Invoice Date'] = invDate;
                  if (fieldConfidence) fieldConfidence['Invoice Date'] = 0.96;
                  console.log(`✓ Label-based override applied for Invoice Date: ${invDate}`);
                } else {
                  console.log('✗ No invoice date found via label-based extraction');
                }
              }
            }
          } catch (fixErr) {
            console.warn('Invoice label-based correction failed:', fixErr);
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
            temperature: 0.1, // Gemini supports temperature
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
            temperature: 0.1, // Gemini supports temperature
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
 
    let zoneExtractedCount = 0;

    // --- ZONE-BASED EXTRACTION (use zone templates when available) ---
    if (zoneTemplate && zoneTemplate.zone_definitions && zoneTemplate.zone_definitions.length > 0 && wordBoundingBoxes.length > 0) {
      console.log(`Applying zone-based extraction with template: ${zoneTemplate.name}`);
      
      try {
        // Convert pixel-based zones (from 1000x700 editor) to percentage if needed
        const normalize = (val: number, axis: 'x' | 'y' | 'w' | 'h') => {
          const base = axis === 'x' || axis === 'w' ? 1000 : 700;
          return val > 100 ? (val / base) * 100 : val;
        };

        // Normalize word box scale: some models return 0..1 instead of 0..100
        if (wordBoundingBoxes.length > 0) {
          const maxX = Math.max(...wordBoundingBoxes.map((w: any) => (w.bbox.x + w.bbox.width)));
          const maxY = Math.max(...wordBoundingBoxes.map((w: any) => (w.bbox.y + w.bbox.height)));
          if (maxX <= 1.5 && maxY <= 1.5) {
            console.log('Scaling wordBoundingBoxes from 0..1 to 0..100');
            wordBoundingBoxes = wordBoundingBoxes.map((w: any) => ({
              text: w.text,
              bbox: {
                x: Math.max(0, Math.min(100, w.bbox.x * 100)),
                y: Math.max(0, Math.min(100, w.bbox.y * 100)),
                width: Math.max(0, Math.min(100, w.bbox.width * 100)),
                height: Math.max(0, Math.min(100, w.bbox.height * 100)),
              }
            }));
          }
        }

        const intersects = (wb: any, zx: number, zy: number, zw: number, zh: number) => {
          const ax1 = wb.x, ay1 = wb.y, ax2 = wb.x + wb.width, ay2 = wb.y + wb.height;
          const bx1 = zx, by1 = zy, bx2 = zx + zw, by2 = zy + zh;
          const ix1 = Math.max(ax1, bx1);
          const iy1 = Math.max(ay1, by1);
          const ix2 = Math.min(ax2, bx2);
          const iy2 = Math.min(ay2, by2);
          const iw = Math.max(0, ix2 - ix1);
          const ih = Math.max(0, iy2 - iy1);
          const interArea = iw * ih;
          const wordArea = Math.max(1e-6, wb.width * wb.height);
          const centerInside = (wb.x + wb.width / 2) >= zx && (wb.x + wb.width / 2) <= (zx + zw) && (wb.y + wb.height / 2) >= zy && (wb.y + wb.height / 2) <= (zy + zh);
          return centerInside || (interArea / wordArea) >= 0.3;
        };

        for (const zone of zoneTemplate.zone_definitions) {
          const zx = normalize(zone.x, 'x');
          const zy = normalize(zone.y, 'y');
          const zw = normalize(zone.width, 'w');
          const zh = normalize(zone.height, 'h');

          const wordsInZone = wordBoundingBoxes.filter((word: any) => intersects(word.bbox, zx, zy, zw, zh));

          if (wordsInZone.length > 0) {
            const sortedWords = wordsInZone.sort((a: any, b: any) => {
              const yDiff = a.bbox.y - b.bbox.y;
              return Math.abs(yDiff) < 2 ? a.bbox.x - b.bbox.x : yDiff;
            });

            let extractedValue = sortedWords.map((w: any) => w.text).join(' ').replace(/\s{2,}/g, ' ').trim();

            if (zone.field_type === 'currency') {
              const match = extractedValue.match(/\$?\s?\d{1,3}(,\d{3})*(\.\d{2})?/);
              if (match) {
                extractedValue = match[0].replace(/\s/g, '');
                if (!extractedValue.startsWith('$')) extractedValue = '$' + extractedValue;
              }
            } else if (zone.field_type === 'date') {
              const match = extractedValue.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/);
              if (match) extractedValue = match[0];
            } else if (zone.field_type === 'number') {
              extractedValue = extractedValue.replace(/[^0-9\-]/g, '');
            }

            if (zone.validation_pattern && extractedValue) {
              const pattern = new RegExp(zone.validation_pattern, zone.validation_flags || 'i');
              if (!pattern.test(extractedValue)) {
                console.log(`Zone ${zone.field_name}: validation failed for "${extractedValue}"`);
                continue;
              }
            }

            metadata[zone.field_name] = extractedValue;
            if (fieldConfidence) fieldConfidence[zone.field_name] = 0.97;
            zoneExtractedCount += 1;
            console.log(`Zone extracted ${zone.field_name}: ${extractedValue}`);
          } else {
            console.log(`Zone ${zone.field_name}: no words found in zone (${zx.toFixed(1)}%, ${zy.toFixed(1)}%, ${zw.toFixed(1)}%x${zh.toFixed(1)}%)`);
          }
        }
        console.log('Zone-based extraction completed');
      } catch (zoneErr) {
        console.error('Zone extraction error:', zoneErr);
      }
    }

    // ROI-based zone extraction when word boxes are unavailable or zones yielded no values
    if (zoneTemplate && zoneTemplate.zone_definitions && zoneTemplate.zone_definitions.length > 0 && (wordBoundingBoxes.length === 0 || zoneExtractedCount === 0) && imageData) {
      try {
        const normalize = (val: number, axis: 'x' | 'y' | 'w' | 'h') => {
          const base = axis === 'x' || axis === 'w' ? 1000 : 700;
          return val > 100 ? (val / base) * 100 : val;
        };

        const zones = zoneTemplate.zone_definitions.map((z: any) => ({
          name: z.field_name,
          type: z.field_type || 'text',
          x: normalize(z.x, 'x'),
          y: normalize(z.y, 'y'),
          width: normalize(z.width, 'w'),
          height: normalize(z.height, 'h'),
          validation_pattern: z.validation_pattern || null,
          validation_flags: z.validation_flags || 'i',
        }));

        const systemPromptRoi = 'You are an OCR system. Read ONLY the specified rectangular regions (percent coordinates 0-100 relative to page). Return STRICT JSON: {"fields": {"Field Name": "value"}}. Do not include any extra text.';
        const userPromptRoi = `Extract each field ONLY from its region (percent of page):\n${zones.map((z: any) => `- ${z.name} (${z.type}) at x:${z.x.toFixed(1)} y:${z.y.toFixed(1)} w:${z.width.toFixed(1)} h:${z.height.toFixed(1)}`).join('\n')}\nRespond with JSON as specified.`;

        const roiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPromptRoi },
              { role: 'user', content: [ { type: 'text', text: userPromptRoi }, { type: 'image_url', image_url: { url: imageData } } ] }
            ],
            temperature: 0.1
          })
        });

        if (roiResp.ok) {
          const roiData = await roiResp.json();
          const raw = roiData.choices?.[0]?.message?.content || '';
          let jsonStr = raw;
          const cb = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (cb) jsonStr = cb[1].trim();
          const objMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (objMatch) {
            try {
              const parsed = JSON.parse(objMatch[0]);
              const fields: Record<string, any> = parsed.fields || parsed;

              for (const z of zones) {
                let val: any = fields[z.name];
                if (val && typeof val === 'object' && 'value' in val) val = val.value;
                if (typeof val === 'string') {
                  let s = val.replace(/\s{2,}/g, ' ').trim();

                  if (z.type === 'currency') {
                    const m = s.match(/\$?\s?\d{1,3}(,\d{3})*(\.\d{2})?/);
                    if (m) {
                      s = m[0].replace(/\s/g, '');
                      if (!s.startsWith('$')) s = '$' + s;
                    }
                  } else if (z.type === 'date') {
                    const m = s.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/);
                    if (m) s = m[0];
                  } else if (z.type === 'number') {
                    s = s.replace(/[^0-9\-]/g, '');
                  }

                  if (z.validation_pattern) {
                    const re = new RegExp(z.validation_pattern, z.validation_flags || 'i');
                    if (!re.test(s)) {
                      console.log(`ROI ${z.name}: validation failed for "${s}"`);
                      continue;
                    }
                  }

                  metadata[z.name] = s;
                  if (fieldConfidence) fieldConfidence[z.name] = 0.97;
                  console.log(`ROI extracted ${z.name}: ${s}`);
                }
              }
            } catch (e) {
              console.log('Failed to parse ROI JSON:', e);
            }
          }
        } else {
          console.log('ROI model call failed:', await roiResp.text());
        }
      } catch (e) {
        console.log('ROI extraction error:', e);
      }
    }

    // Casino voucher deterministic text fallback
    try {
      if (isCasinoVoucher && extractedText) {
        const text = String(extractedText);
        // Amount: choose the largest dollar amount on the page
        const amounts = text.match(/\$\s?\d{1,3}(,\d{3})*(\.\d{2})?/g) || [];
        if (amounts.length) {
          let max = '';
          let maxv = 0;
          for (const a of amounts) {
            const v = parseFloat(a.replace(/[$,\s]/g, ''));
            if (!isNaN(v) && v > maxv) {
              maxv = v;
              max = a.replace(/\s/g, '');
            }
          }
          if (max) {
            const val = max.startsWith('$') ? max : `$${max}`;
            metadata['Amount'] = val;
            if (fieldConfidence) fieldConfidence['Amount'] = 0.98;
            console.log(`Text fallback Amount: ${val}`);
          }
        }

        // Validation Date: support MM/DD/YYYY or MM-DD-YYYY
        const dateMatch = text.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/);
        if (dateMatch) {
          const val = dateMatch[0].replace(/-/g, '/');
          metadata['Validation Date'] = val;
          if (fieldConfidence) fieldConfidence['Validation Date'] = 0.97;
          console.log(`Text fallback Validation Date: ${val}`);
        }

        // Ticket Number: prefer pattern near the word VALIDATION
        let ticket = '';
        const upper = text.toUpperCase();
        const valIdx = upper.indexOf('VALIDATION');
        const slice = valIdx >= 0 ? text.slice(valIdx, valIdx + 200) : text;
        const t1 = slice.match(/\b\d{2}-\d{4}-\d{4}-\d{4}-\d{4}\b/);
        if (t1) ticket = t1[0];
        if (!ticket) {
          const any = text.match(/\b\d{2}-\d{4}-\d{4}-\d{4}-\d{4}\b/);
          if (any) ticket = any[0];
        }
        if (ticket) {
          metadata['Ticket Number'] = ticket;
          if (fieldConfidence) fieldConfidence['Ticket Number'] = 0.97;
          console.log(`Text fallback Ticket Number: ${ticket}`);
        }

        // Machine Number: "MACHINE #12345" or "ASSET# 12345"
        const m = text.match(/(?:MACHINE|ASSET)\s*#?\s*(\d{4,5})/i);
        if (m) {
          const val = m[1];
          metadata['Machine Number'] = val;
          if (fieldConfidence) fieldConfidence['Machine Number'] = 0.96;
          console.log(`Text fallback Machine Number: ${val}`);
        }
      }
    } catch (e) {
      console.log('Casino voucher text fallback failed:', e);
    }

    // --- PII DETECTION ---
    // Scan for personally identifiable information in the extracted text (only if project has PII detection enabled)
    const detectedPiiRegions: Array<{ type: string; category: string; text: string; bbox?: any }> = [];
    let piiDetected = false;
    let piiEnabled = false;
    
    // Check if PII detection is enabled for this project
    if (projectId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { data: projectConfig } = await supabaseAdmin
          .from('projects')
          .select('detect_pii')
          .eq('id', projectId)
          .single();
          
        piiEnabled = projectConfig?.detect_pii === true;
        console.log(`PII Detection: ${piiEnabled ? 'ENABLED' : 'DISABLED'} for project ${projectId}`);
      } catch (e) {
        console.log('Failed to check PII setting, defaulting to disabled');
      }
    }
    
    if (piiEnabled) {
      const piiPatterns = [
        { pattern: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, type: 'ssn', category: 'Social Security Number' },
        { pattern: /\b\d{9}\b/g, type: 'ssn_no_format', category: 'Social Security Number (9 digits)' },
        { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, type: 'credit_card', category: 'Credit Card' },
        { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email', category: 'Email Address' },
        { pattern: /\b\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, type: 'phone', category: 'Phone Number' },
        { pattern: /\b[A-Z]{1,2}[\s-]?\d{6,8}\b/g, type: 'drivers_license', category: "Driver's License" },
        { pattern: /\b[A-Z]{1,2}[\s-]?\d{6,9}\b/g, type: 'passport', category: 'Passport Number' },
        { pattern: /\b(0?[1-9]|1[0-2])[\s/.-](0?[1-9]|[12][0-9]|3[01])[\s/.-](19|20)?\d{2}\b/g, type: 'dob', category: 'Date of Birth' },
        { pattern: /\bpassport no\.?[\s:]*[A-Z0-9\s-]{6,}/gi, type: 'passport_label', category: 'Passport Number (labeled)' },
      ];
      
      for (const piiPattern of piiPatterns) {
        let match: RegExpExecArray | null;
        piiPattern.pattern.lastIndex = 0; // Reset regex
        
        while ((match = piiPattern.pattern.exec(extractedText)) !== null) {
          piiDetected = true;
          detectedPiiRegions.push({
            type: piiPattern.type,
            category: piiPattern.category,
            text: match[0],
            // Try to find bbox from word bounding boxes if available
            bbox: match ? wordBoundingBoxes.find((w: any) => w.text?.includes(match![0]))?.bbox || null : null
          });
        }
      }
      
      console.log(`PII Detection: ${piiDetected ? `Found ${detectedPiiRegions.length} PII items` : 'No PII detected'}`);
    }
    // --- RETURN SUCCESS RESPONSE ---
    // Return all extracted data to the client including field-level confidence and PII detection
    return new Response(
      JSON.stringify({ 
        text: extractedText,              // Full document text
        metadata: metadata,               // Extracted field values
        lineItems: lineItems,             // Extracted table rows (if applicable)
        documentType: documentType,       // Classified document type
        confidence: confidence,           // Overall OCR confidence score
        fieldConfidence: fieldConfidence || {}, // Per-field confidence scores
        validationApplied: validationApplied, // Whether two-pass validation was used
        boundingBoxes: fieldBoundingBoxes, // Field locations on document
        wordBoundingBoxes: wordBoundingBoxes, // Word-level coordinates for highlighting
        piiDetected: piiDetected,         // Whether PII was detected in the document
        detectedPiiRegions: detectedPiiRegions // Array of detected PII with locations
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
