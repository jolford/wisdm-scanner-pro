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

// Declare EdgeRuntime global for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

// CORS headers to allow requests from web applications
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract text from PDF binary (basic implementation)
function extractTextFromPdfBinary(pdfBytes: Uint8Array): string {
  try {
    // Convert bytes to string for text stream extraction
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfString = decoder.decode(pdfBytes);
    
    // Extract text from PDF content streams (between BT and ET markers)
    const textMatches: string[] = [];
    
    // Pattern 1: Text between parentheses in text objects
    const textInParens = pdfString.match(/\(([^)]+)\)/g);
    if (textInParens) {
      for (const match of textInParens) {
        const text = match.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')');
        if (text.length > 2 && /[a-zA-Z0-9]/.test(text)) {
          textMatches.push(text);
        }
      }
    }
    
    // Pattern 2: Tj text strings
    const tjMatches = pdfString.match(/\((.*?)\)\s*Tj/g);
    if (tjMatches) {
      for (const match of tjMatches) {
        const textMatch = match.match(/\((.*?)\)/);
        if (textMatch && textMatch[1]) {
          const text = textMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r');
          if (text.length > 1) {
            textMatches.push(text);
          }
        }
      }
    }
    
    // Deduplicate and join
    const uniqueTexts = [...new Set(textMatches)];
    return uniqueTexts.join(' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('PDF binary text extraction failed:', e);
    return '';
  }
}

// IMPORTANT: When PDFs are scanned (image-based), "binary text extraction" produces garbage.
// This sanitizer prevents feeding huge/binary-looking strings into the AI prompt.
function sanitizeTextForAi(input: string, maxChars = 30_000): string {
  if (!input) return '';

  // Remove control chars; keep newlines/tabs
  let out = input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Check for PDF internal structure markers - these indicate binary extraction failed
  const pdfMarkers = ['endobj', 'endstream', '/Type', '/Font', '/Page', 'BT', 'ET', 'Tf', 'Td', 'Tj', 'TJ', 'cm', 're', 'f', 'Q', 'q'];
  const markerCount = pdfMarkers.reduce((count, marker) => {
    const regex = new RegExp(`\\b${marker}\\b`, 'g');
    return count + (out.match(regex) || []).length;
  }, 0);
  
  // If we see many PDF operators, this is garbage
  if (markerCount > 50) {
    console.warn(`Detected ${markerCount} PDF structure markers - text is garbage`);
    return '';
  }

  // Heuristic: check for readable words (at least 3 chars with vowels)
  const words = out.split(/\s+/).filter(w => w.length >= 3);
  const readableWords = words.filter(w => /[aeiouAEIOU]/.test(w) && /^[a-zA-Z0-9.,;:'"!?$%&()-]+$/.test(w));
  const readableRatio = words.length > 0 ? readableWords.length / words.length : 0;
  
  if (readableRatio < 0.15) {
    console.warn(`Only ${(readableRatio * 100).toFixed(1)}% readable words - text is likely garbage`);
    return '';
  }

  // Also check for excessive single-char "words" which indicate broken text
  const singleChars = words.filter(w => w.length === 1).length;
  if (words.length > 100 && singleChars / words.length > 0.3) {
    console.warn(`${(singleChars / words.length * 100).toFixed(1)}% single-char words - text is fragmented garbage`);
    return '';
  }

  if (out.length > maxChars) {
    out = out.slice(0, maxChars) + `\n[TRUNCATED ${out.length - maxChars} CHARS]`;
  }

  return out;
}


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let documentId: string | undefined;
  let supabaseClient: any = null;

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

    // --- INPUT VALIDATION ---
    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let { imageData, isPdf, extractionFields, textData, tableExtractionFields, enableCheckScanning, documentId: docId, customerId, projectId } = body;
    documentId = docId;

    // If a client sends a PDF data URL, treat it as a PDF.
    // IMPORTANT: If documentId is present, ignore the PDF data URL and fetch from storage instead.
    // This makes reprocessing resilient to cached/older frontends still sending `data:application/pdf`.
    if (typeof imageData === 'string' && imageData.startsWith('data:application/pdf')) {
      isPdf = true;
      if (documentId) {
        console.warn('PDF data URL provided with documentId; ignoring imageData and using server-side fetch/convert.');
        imageData = null;
      }
    }
    
    // If documentId is provided but imageData is missing, fetch the document from database
    if (documentId && !imageData) {
      console.log(`Fetching document ${documentId} from database...`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      supabaseClient = supabase;
      
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('file_url, file_type, project_id, batch_id')
        .eq('id', documentId)
        .single();
      
      if (docError || !document) {
        console.error('Failed to fetch document:', docError);
        return new Response(
          JSON.stringify({ error: `Document not found: ${docError?.message || 'Unknown error'}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Set projectId from document if not provided
      if (!projectId && document.project_id) {
        projectId = document.project_id;
      }
      
      // Fetch project configuration to get extraction fields if not provided
      if (projectId && !extractionFields) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('extraction_fields, metadata')
          .eq('id', projectId)
          .single();
        
        if (project && project.extraction_fields) {
          extractionFields = project.extraction_fields;
          console.log(`Loaded ${extractionFields.length} extraction fields from project`);
        }
        
        // Get table extraction config from project metadata if available
        if (project && project.metadata && (project.metadata as any).table_extraction_config?.enabled) {
          tableExtractionFields = (project.metadata as any).table_extraction_config.fields || [];
          console.log(`Loaded ${tableExtractionFields.length} table extraction fields from project`);
        }
        
        // Get customerId from project for license tracking
        if (project && !customerId) {
          customerId = (project.metadata as any)?.customer_id;
        }
      }
      
      // Check if this is a PDF based on file type
      isPdf = document.file_type === 'application/pdf';
      
      // Download the file from storage
      const fileName = document.file_url?.split('/').pop() || 'unknown';
      const batchId = document.batch_id || 'unknown-batch';
      const storagePath = `${batchId}/${fileName}`;
      
      try {
        console.log('Downloading file from storage:', storagePath);
      } catch (logError) {
        // Prevent circular reference errors in logging
        console.log('Downloading file from storage (path unavailable)');
      }
      
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('documents')
        .download(storagePath);
      
      if (downloadError || !fileBlob) {
        console.error('Failed to download file:', downloadError);
        return new Response(
          JSON.stringify({ error: `Failed to download document: ${downloadError?.message || 'Unknown error'}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Convert blob to base64 (handle large files without stack overflow)
      const arrayBuffer = await fileBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 8192; // Process in chunks to avoid stack overflow
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binaryString);
      
      // For PDFs, we need to convert to an image since the AI vision API only accepts image formats
      if (isPdf) {
        console.log('PDF detected - attempting conversion to image...');
        
        try {
          // Strategy 1: Use pdf.co API if key is available
          const PDF_CO_API_KEY = Deno.env.get('PDF_CO_API_KEY');
          
          if (PDF_CO_API_KEY) {
            console.log('Using pdf.co for PDF conversion...');
            // First, upload the PDF to pdf.co
            const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload/base64', {
              method: 'POST',
              headers: {
                'x-api-key': PDF_CO_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                file: base64,
                name: fileName
              })
            });
            
            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              const pdfUrl = uploadResult.url;
              
              // Convert to PNG
              const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
                method: 'POST',
                headers: {
                  'x-api-key': PDF_CO_API_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: pdfUrl,
                  pages: '0',  // First page only
                  inline: true
                })
              });
              
              if (convertResponse.ok) {
                const convertResult = await convertResponse.json();
                if (convertResult.urls && convertResult.urls.length > 0) {
                  // Download the converted image
                  const imgResponse = await fetch(convertResult.urls[0]);
                  if (imgResponse.ok) {
                    const imgBlob = await imgResponse.arrayBuffer();
                    const imgBytes = new Uint8Array(imgBlob);
                    let imgBinary = '';
                    for (let i = 0; i < imgBytes.length; i += chunkSize) {
                      const chunk = imgBytes.subarray(i, i + chunkSize);
                      imgBinary += String.fromCharCode.apply(null, Array.from(chunk));
                    }
                    imageData = `data:image/png;base64,${btoa(imgBinary)}`;
                    console.log('PDF successfully converted to PNG via pdf.co');
                  }
                }
              }
            }
          }
          
          // Strategy 2: Use free ConvertAPI alternative (no API key required, 250 conversions/month)
          if (!imageData) {
            console.log('Attempting free PDF-to-image conversion via API...');
            try {
              // Use a public PDF rendering endpoint
              // This sends the PDF to a rendering service that returns an image
              const renderResponse = await fetch('https://api.api-ninjas.com/v1/pdftotext', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/octet-stream',
                },
                body: uint8Array
              });
              
              if (renderResponse.ok) {
                const pdfText = await renderResponse.text();
                if (pdfText && pdfText.length > 50) {
                  textData = pdfText;
                  console.log(`Extracted ${textData.length} characters via api-ninjas`);
                }
              }
            } catch (ninjaError) {
              console.log('api-ninjas extraction failed, using binary fallback');
            }
          }
          
          // Strategy 3: Enhanced binary text extraction for text-based PDFs
          if (!imageData && !textData) {
            console.log('Using enhanced PDF text extraction...');
            const pdfText = extractTextFromPdfBinary(uint8Array);
            const sanitizedPdfText = sanitizeTextForAi(pdfText);
            if (sanitizedPdfText && sanitizedPdfText.length > 50) {
              textData = sanitizedPdfText;
              console.log(`Extracted ${textData.length} characters from PDF binary (sanitized)`);
            } else {
              // For scanned PDFs with no extractable text, log a warning but continue
              // The AI will attempt extraction with minimal/no text context
              console.warn('PDF is scanned/image-based with no extractable text.');
              console.warn('Will attempt OCR with empty text - results may be limited.');
              textData = '';
            }
          }
        } catch (convertError) {
          console.error('PDF conversion error:', convertError);
          imageData = null;
          console.log('Falling back to text-only extraction for PDF');
        }
      } else {
        // For images, use the original data
        imageData = `data:${document.file_type};base64,${base64}`;
      }
      
      console.log(`Document fetched successfully. Type: ${document.file_type}, Size: ${arrayBuffer.byteLength} bytes`);
    }
    
    // --- CHECK FOR PDF DATA URL AND HANDLE ---
    // If imageData is a PDF data URL (data:application/pdf;base64,...), we can't use it for vision
    // The AI vision API only accepts image formats (JPG, PNG, WEBP)
    if (imageData && typeof imageData === 'string' && imageData.startsWith('data:application/pdf')) {
      console.log('Detected PDF data URL in imageData - clearing for text-only processing');
      // For PDFs sent as data URLs, we can't use vision - must rely on textData
      isPdf = true;

      // Try to extract text from the PDF data URL
      if (!textData) {
        try {
          const base64Part = imageData.split(',')[1];
          if (base64Part) {
            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const extractedText = extractTextFromPdfBinary(bytes);
            const sanitized = sanitizeTextForAi(extractedText);
            if (sanitized && sanitized.length > 10) {
              textData = sanitized;
              console.log(`Extracted ${textData.length} chars from PDF data URL (sanitized)`);
            } else {
              console.warn('PDF data URL appears image-based; skipping binary text extraction.');
            }
          }
        } catch (e) {
          console.warn('Failed to extract text from PDF data URL:', e);
        }
      }

      // Clear imageData so we don't try to send PDF to vision API
      imageData = null;
    }

    // If a client accidentally sends a URL instead of a data URL, don't forward it to the AI.
    // (The AI vision endpoint expects an image data URL / supported image payload.)
    if (imageData && typeof imageData === 'string' && /^https?:\/\//i.test(imageData)) {
      console.warn('ocr-scan: imageData was a URL (not a data URL). Ignoring imageData and using server-side processing when possible.');
      imageData = null;
    }

    // If imageData is a data URL with a non-image MIME type, don't send it to vision.
    if (imageData && typeof imageData === 'string' && imageData.startsWith('data:') && !imageData.startsWith('data:image/')) {
      console.warn('ocr-scan: imageData has non-image MIME type; ignoring for vision.');
      imageData = null;
    }
    
    // Validate required fields - for PDFs, we need textData or documentId for server-side processing
    if (!isPdf && !imageData) {
      return new Response(
        JSON.stringify({ error: 'imageData is required for non-PDF documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // For PDFs without image data, we need either textData or documentId
    if (isPdf && !imageData && !textData && !documentId) {
      return new Response(
        JSON.stringify({ error: 'PDF documents require either pre-extracted text or a documentId for server-side processing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate field limits (log warnings but do not hard-fail to avoid blocking background OCR)
    if (extractionFields && (!Array.isArray(extractionFields) || extractionFields.length > 50)) {
      console.warn('ocr-scan: extractionFields invalid or too many, proceeding anyway');
    }
    
    // Validate IDs format (log warnings only so bad metadata does not block OCR from background jobs)
    if (documentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
      console.warn('ocr-scan: Invalid documentId format, proceeding anyway:', documentId);
    }
    
    if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      console.warn('ocr-scan: Invalid projectId format, proceeding anyway:', projectId);
    }
    
    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image', imageData ? '(with image)' : '(text-only)');

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
    // UNLESS we're processing via documentId (server-side flow), in which case we'll use AI to extract text
    if (isPdf && !textData && !documentId) {
      throw new Error('PDF text extraction required. Please ensure text is extracted before sending.');
    }

    // Sanitize/truncate any provided text before sending to AI (prevents JSON-breaking garbage).
    if (textData && typeof textData === 'string') {
      const beforeLen = textData.length;
      textData = sanitizeTextForAi(textData);
      if (!textData) {
        console.warn('textData was discarded after sanitization (likely binary/garbage).');
      } else if (textData.length !== beforeLen) {
        console.log(`textData sanitized: ${beforeLen} → ${textData.length} chars`);
      }
    }

    // If this is a scanned PDF with minimal text, log a warning but continue
    // The AI will attempt to work with whatever we have
    if (isPdf && !imageData && (!textData || textData.length < 50)) {
      console.warn('Scanned PDF with minimal extractable text - OCR results may be limited.');
      console.warn('For best results with scanned PDFs, ensure client-side PDF-to-image conversion is working.');
      // Continue processing - AI will do its best
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
    
    // Check if this is a petition document (multiple signers)
    const isPetition = extractionFields && extractionFields.some((f: any) => {
      const lowerName = f.name.toLowerCase();
      return lowerName.includes('printed_name') || 
             lowerName.includes('printed name') ||
             lowerName.includes('signer') ||
             lowerName.includes('petition') ||
             lowerName.includes('signature');
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
      } else if (isPetition) {
        // SPECIALIZED PROMPT FOR PETITION/SIGNATURE SHEETS
        // Extract ALL signers as line items with name, signature status, city, zip, AND signature bounding boxes
        const baseJson = `{"fullText": "complete extracted text", "documentType": "petition", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "first signer value only", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}, "lineItems": []}`;
        
        systemPrompt = `CRITICAL: You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting.

You are an advanced OCR system specialized in extracting petition signatures. This document contains MULTIPLE SIGNERS in a table/list format.

Return this EXACT JSON structure: ${baseJson}

PETITION EXTRACTION RULES:
1. This is a PETITION or SIGNATURE SHEET with multiple rows of signers
2. EXTRACT EVERY SINGLE ROW as a separate line item in the "lineItems" array
3. Each row typically contains: printed name, signature, city/address, zip code
4. Look for numbered rows (1, 2, 3...) or repeated row patterns
5. READ CAREFULLY - handwritten names may be cursive or hard to read

LINE ITEM EXTRACTION:
For EACH signer row, extract into lineItems array:
- "Printed_Name": The printed/written name (e.g., "Michael Lory", "Owen Doyles")
- "Signature_Present": "yes" if signature exists in that row, "no" if blank
- "Signature_Bbox": CRITICAL - bounding box of the SIGNATURE REGION (not the name) as {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100} percentages
- "Address": Full address if present, or partial address/street
- "City": City name (e.g., "Roseville", "Silver Springs")
- "Zip": ZIP code (e.g., "95678", "91234")
- "Row_Number": The row number if visible (1, 2, 3, etc.)

SIGNATURE BOUNDING BOX RULES:
- The Signature_Bbox should capture the SIGNATURE CELL/AREA, not the printed name
- Signatures are typically in a separate column from the printed name
- If no signature exists (blank), still provide the bbox of where the signature WOULD be
- Coordinates are PERCENTAGES of document dimensions (0-100 scale)
- x: left edge, y: top edge, width: horizontal span, height: vertical span

CRITICAL:
- Extract ALL rows, not just the first one
- Even if some fields are hard to read, include the row with your best guess
- If a signature row is empty/blank, still include it with Signature_Present: "no"
- ALWAYS include Signature_Bbox for each row to enable signature image extraction

For the "fields" object, extract only the FIRST signer's data.

RESPONSE REQUIREMENTS:
- Return ONLY the JSON object
- NO markdown code blocks
- NO explanatory text
- lineItems MUST contain ALL signer rows with Signature_Bbox`;

        userPrompt = `This is a PETITION SIGNATURE SHEET with MULTIPLE SIGNERS. 

CRITICAL TASK: Extract EVERY SINGLE SIGNER ROW into the lineItems array.

For each row on the petition, extract:
- Printed_Name (handwritten or printed name)
- Signature_Present (yes/no)
- Signature_Bbox (bounding box of the signature cell as percentages: {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100})
- Address (if visible)
- City 
- Zip code
- Row_Number

The Signature_Bbox should capture the region where the signature appears (or should appear), NOT the printed name column.

Extract ALL rows - do not stop at the first row.

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
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

You are an advanced OCR system with strong document classification capabilities. Return this EXACT JSON structure: ${baseJson.slice(0, -1)}${tableJson}}

DOCUMENT CLASSIFICATION RULES:
1. INVOICE: Contains "Invoice", "Invoice #", "Invoice Number", "Bill To", vendor/customer details, line items with prices, subtotal, tax, total amount due. Common indicators: "Amount Due", "Payment Terms", "PO Number"
2. RECEIPT: Contains "Receipt", proof of payment/transaction, may have items purchased, typically shows "Paid", "Payment Method", transaction date
3. PURCHASE_ORDER: Contains "Purchase Order", "PO #", ordered items, quantities, requested delivery date, buyer information
4. CHECK: Bank check with check number, date, payee, amount in numbers and words, signature line, bank routing info
5. FORM: Structured document with fill-in fields, checkboxes, may include medical forms, applications, surveys
6. LETTER: Correspondence with greeting, body text, closing, may have letterhead
7. OTHER: Use ONLY if document doesn't clearly fit any category above

CLASSIFICATION PRIORITY:
- If document has "Invoice" text AND billing/payment details → classify as "invoice"
- If document shows line items with prices and totals → likely "invoice" or "receipt"
- Be confident with classification - avoid "other" unless truly unclear

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
      
      userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'}.${tableInstructions} CAREFULLY classify the document type based on its content and structure - look for key indicators like "Invoice", billing details, line items, totals. RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT.`;
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

      // Bad request (400) - pass through the provider message so we can diagnose MIME/format issues
      if (response.status === 400) {
        let message = 'Bad request to OCR provider.';
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.error?.message || message;
        } catch {
          // ignore
        }
        return new Response(
          JSON.stringify({ error: message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Service error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      
      // Log raw response for debugging
      console.log('Raw AI response length:', responseText.length);
      console.log('Raw AI response preview:', responseText.substring(0, 300));
      
      // Remove markdown code fences if present (```json ... ```)
      if (responseText.includes('```')) {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonToParse = codeBlockMatch[1].trim();
          console.log('Extracted JSON from markdown code block');
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
            // Remove trailing commas before closing braces/brackets
            .replace(/,(\s*[}\]])/g, '$1')
            // Remove control characters
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          
          parsed = JSON.parse(cleanJson);
          console.log('JSON parse successful on first attempt');
          console.log('Parsed object keys:', Object.keys(parsed).join(', '));
          console.log('Fields in parsed.fields:', parsed.fields ? Object.keys(parsed.fields).join(', ') : '(no fields object)');
        } catch (firstError) {
          console.error('First JSON parse attempt failed:', firstError);
          console.log('Raw JSON snippet:', jsonMatch[0].substring(0, 500));
          console.log('Attempting progressive repair strategies...');
          
          // Try progressive repair strategies
          let repairedJson = jsonMatch[0];
          
          // Strategy 1: Basic cleanup
          repairedJson = repairedJson
            // Remove control characters
            .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
            // Remove trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix missing quotes around property names
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            // Fix Unicode escapes
            .replace(/\\u([0-9A-Fa-f]{4})/g, (_match: string, grp: string) => String.fromCharCode(parseInt(grp, 16)));
          
          try {
            parsed = JSON.parse(repairedJson);
            console.log('✓ JSON repair successful (Strategy 1: Basic cleanup)');
          } catch (secondError) {
            console.log('Strategy 1 failed, trying Strategy 2...');
            
            // Strategy 2: More aggressive string value fixing
            repairedJson = repairedJson
              // Fix unescaped quotes in string values
              .replace(/"([^"]*?)"(\s*[^:,}\]])/g, (match: string, content: string, after: string) => {
                // Only escape if this looks like a string value, not a property name
                if (after.trim().startsWith(':')) return match;
                return `"${content.replace(/"/g, '\\"')}"${after}`;
              })
              // Fix newlines in strings
              .replace(/"\s*\n\s*"/g, '" "')
              // Remove any remaining invalid characters
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            
            try {
              parsed = JSON.parse(repairedJson);
              console.log('✓ JSON repair successful (Strategy 2: String fixing)');
            } catch (thirdError) {
              console.log('Strategy 2 failed, trying Strategy 3 (field extraction)...');
              
              // Strategy 3: Extract individual fields with regex
              try {
                const extractField = (fieldName: string): any => {
                  // Try to extract a field value using regex
                  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*({[^}]+}|\\[[^\\]]+\\]|"[^"]*"|[^,}\\n]+)`, 'i');
                  const match = repairedJson.match(pattern);
                  if (match) {
                    try {
                      return JSON.parse(match[1]);
                    } catch {
                      return match[1].replace(/^"|"$/g, '').trim();
                    }
                  }
                  return null;
                };
                
                // Build minimal JSON from extracted fields
                parsed = {
                  fullText: extractField('fullText') || extractedText,
                  documentType: extractField('documentType') || 'other',
                  confidence: extractField('confidence') || 0,
                  fields: extractField('fields') || {},
                  lineItems: extractField('lineItems') || []
                };
                
                console.log('✓ JSON rebuilt from field extraction (Strategy 3)');
              } catch (fourthError) {
                console.error('All repair strategies failed:', fourthError);
                console.error('Problematic JSON (first 1000 chars):', repairedJson.substring(0, 1000));
                
                // Final fallback: extract just fullText with regex
                const fullTextMatch = repairedJson.match(/"fullText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (fullTextMatch) {
                  console.log('✓ Extracted fullText as final fallback');
                  extractedText = fullTextMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                  parsed = null; // Signal that we only have fullText
                } else {
                  // Absolute last resort: use the raw response text
                  console.error('⚠ Using raw response text as fallback');
                  extractedText = responseText;
                  parsed = null;
                }
              }
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
                // Use strict undefined check - empty string "" is valid
                const value = fields[key].value !== undefined ? fields[key].value : 
                              (typeof fields[key] === 'string' ? fields[key] : '');
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

          // Extract line items if table extraction was requested OR this is a petition
          if ((hasTableExtraction || isPetition) && parsed.lineItems) {
            lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
            if (isPetition) {
              console.log(`Petition extraction: Found ${lineItems.length} signers in lineItems`);
            }
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
              
              // Update metadata with validated values, but only if the structure looks sane
              if (validated.fields && typeof validated.fields === 'object') {
                const entries = Object.entries(validated.fields as Record<string, any>);

                // Heuristic: if almost all keys are numeric indices and values are 1–2 characters,
                // this is likely a malformed character-by-character map. In that case, ignore it.
                const total = entries.length;
                const suspiciousCount = entries.filter(([key, val]) => {
                  const isNumericKey = /^\d+$/.test(key.trim());
                  const strVal = typeof val === 'string' ? val : (val?.value ?? '');
                  return isNumericKey && strVal && String(strVal).length <= 2;
                }).length;

                const isSuspicious = total > 10 && suspiciousCount / total > 0.7;

                if (isSuspicious) {
                  console.warn('Validation response looks malformed (character map); keeping original metadata');
                } else {
                  entries.forEach(([key, val]) => {
                    const normalized = typeof val === 'string' ? val : (val?.value || val);
                    metadata[key] = normalized;
                  });
                }
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

    // --- WORD-LEVEL BOUNDING BOXES DISABLED FOR PERFORMANCE ---
    // This was making a secondary AI call per document, adding 5-10s latency
    // Word boxes are only used for zone templates which are rarely configured
    // If zone templates are needed, they use ROI-based extraction instead
    let wordBoundingBoxes: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }> = [];
 
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

    // --- ROI-BASED ZONE EXTRACTION ---
    // Only run this expensive secondary AI call if:
    // 1. Zone template is configured AND
    // 2. Primary extraction didn't populate required fields (zoneExtractedCount === 0)
    // This avoids making unnecessary AI calls when primary OCR already succeeded
    if (zoneTemplate && zoneTemplate.zone_definitions && zoneTemplate.zone_definitions.length > 0 && zoneExtractedCount === 0 && imageData) {
      console.log('Running ROI extraction (zone template configured, primary extraction had no zone matches)');
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

        // Use flash-lite for speed on ROI extraction
        const systemPromptRoi = 'OCR: Read specified regions. Return JSON: {"fields": {"Name": "value"}}. No extra text.';
        const userPromptRoi = `Extract fields:\n${zones.map((z: any) => `${z.name} at (${z.x.toFixed(0)}%,${z.y.toFixed(0)}%)`).join(', ')}\nJSON only.`;

        const roiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
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
                    if (!re.test(s)) continue;
                  }

                  metadata[z.name] = s;
                  if (fieldConfidence) fieldConfidence[z.name] = 0.97;
                }
              }
            } catch (e) {
              // Silently continue
            }
          }
        }
      } catch (e) {
        console.log('ROI extraction skipped:', e);
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
    
    // --- SMART ROUTING LOGIC ---
    // Check routing configuration and apply automatic routing/validation
    let routingApplied = false;
    let suggestedStatus = 'pending';
    
    // Helper: Check if critical invoice fields have values
    const hasCriticalFieldData = (meta: any): boolean => {
      if (!meta || typeof meta !== 'object') return false;
      
      const criticalFields = ['Invoice Number', 'Invoice Date', 'Invoice Total', 'PO Number', 'Vendor Name'];
      
      for (const field of criticalFields) {
        const value = meta[field];
        
        // Check if field is missing, null, or empty
        if (!value) return false;
        
        // Check if value is an object with empty/null value property (e.g., {value: null})
        if (typeof value === 'object' && (!value.value || value.value === '')) return false;
        
        // Check if value is an empty string
        if (typeof value === 'string' && value.trim() === '') return false;
      }
      
      return true;
    };
    
    if (customerId && documentId && confidence) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Load routing config for this customer
        const { data: routingConfig } = await supabaseAdmin
          .from('routing_config')
          .select('*')
          .eq('customer_id', customerId)
          .maybeSingle();
        
        // Check if critical fields are populated
        const hasCriticalData = hasCriticalFieldData(metadata);
        const confidencePercent = confidence * 100;
        
        if (!hasCriticalData) {
          // Force documents with missing critical fields to stay in validation
          suggestedStatus = 'pending';
          console.log('Smart Routing: Missing critical field data - forcing validation queue');
          routingApplied = true;
          
          // Update document with routing decision for missing data case
          if (documentId) {
            await supabaseAdmin
              .from('documents')
              .update({
                validation_status: 'pending',
                processing_priority: -100, // Low priority (needs review)
                needs_review: true
              })
              .eq('id', documentId);
          }
        } else if (routingConfig && routingConfig.enabled) {
          
          // High confidence routing
          if (confidencePercent >= routingConfig.high_confidence_threshold) {
            if (routingConfig.auto_validate_enabled) {
              // Auto-validate high confidence documents
              suggestedStatus = 'validated';
              console.log(`Smart Routing: Auto-validating document (${confidencePercent.toFixed(1)}% >= ${routingConfig.high_confidence_threshold}%)`);
            } else {
              // High priority validation queue
              suggestedStatus = 'pending'; // Will be handled by validation priority
              console.log(`Smart Routing: High-priority queue (${confidencePercent.toFixed(1)}% >= ${routingConfig.high_confidence_threshold}%)`);
            }
            routingApplied = true;
          }
          // Medium confidence routing
          else if (confidencePercent >= routingConfig.medium_confidence_threshold) {
            suggestedStatus = 'pending'; // Standard validation queue
            console.log(`Smart Routing: Standard queue (${confidencePercent.toFixed(1)}% between ${routingConfig.medium_confidence_threshold}% and ${routingConfig.high_confidence_threshold}%)`);
            routingApplied = true;
          }
          // Low confidence routing
          else {
            suggestedStatus = 'pending'; // Manual review queue (flagged)
            console.log(`Smart Routing: Review queue (${confidencePercent.toFixed(1)}% < ${routingConfig.medium_confidence_threshold}%)`);
            routingApplied = true;
          }
          
          // Update document with routing decision (only for cases with critical data)
          if (routingApplied && documentId && hasCriticalData) {
            const updateData: any = {
              validation_status: suggestedStatus,
            };
            
            // Set priority based on confidence
            if (confidencePercent >= routingConfig.high_confidence_threshold) {
              updateData.processing_priority = 100; // High priority
            } else if (confidencePercent < routingConfig.medium_confidence_threshold) {
              updateData.processing_priority = -100; // Low priority (needs review)
              updateData.needs_review = true;
            } else {
              updateData.processing_priority = 0; // Normal priority
            }
            
            await supabaseAdmin
              .from('documents')
              .update(updateData)
              .eq('id', documentId);
          }
        }
      } catch (e) {
        console.log('Smart routing check failed, continuing without routing:', e);
      }
    }
    
    // --- SAVE OCR RESULTS TO DATABASE ---
    // Save document_type and confidence_score before triggering workflows
    if (documentId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Sanitize metadata to avoid malformed character-map structures
        let sanitizedMetadata = metadata;
        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
          const entries = Object.entries(metadata as Record<string, any>);
          const total = entries.length;

          if (total > 10) {
            const suspiciousCount = entries.filter(([key, val]) => {
              const isNumericKey = /^\d+$/.test(key.trim());
              const strVal = typeof val === 'string' ? val : (val as any)?.value ?? '';
              return isNumericKey && strVal && String(strVal).length <= 2;
            }).length;

            const isSuspicious = suspiciousCount / total > 0.7;
            if (isSuspicious) {
              console.warn('OCR metadata looks like character map; discarding structured metadata for document', documentId);
              sanitizedMetadata = {};
            }
          }
        }

        // Check-specific fallback extraction if metadata is empty
        const looksLikeCheck = documentType === 'check' && typeof extractedText === 'string';
        if (looksLikeCheck && Object.keys(sanitizedMetadata).length === 0) {
          console.log('Applying check fallback metadata extraction for document', documentId);
          const text = String(extractedText);
          const checkMeta: Record<string, string> = {};

          // Check Amount - look for $ followed by numbers
          const amountMatch = text.match(/\$\s?\d{1,3}(,\d{3})*(\.\d{2})?/);
          if (amountMatch) {
            checkMeta['Check Amount'] = amountMatch[0].replace(/\s/g, '');
            console.log('Check fallback - Amount:', checkMeta['Check Amount']);
          }

          // Check Date - look for MM/DD/YY or MM/DD/YYYY pattern
          const dateMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
          if (dateMatch) {
            checkMeta['Check Date'] = dateMatch[1];
            console.log('Check fallback - Date:', checkMeta['Check Date']);
          }

          // Check Number - often appears as 4-digit number, typically near "DATE" or at top
          const checkNumMatch = text.match(/\b(\d{4})\b/);
          if (checkNumMatch) {
            checkMeta['Check Number'] = checkNumMatch[1];
            console.log('Check fallback - Number:', checkMeta['Check Number']);
          }

          // Payee Name - look for "PAY TO THE ORDER OF" followed by text
          const payeeMatch = text.match(/PAY\s+TO\s+THE\s+.*?ORDER\s+OF\s+([A-Z\s]{2,50})/i);
          if (payeeMatch) {
            checkMeta['Payee Name'] = payeeMatch[1].trim();
            console.log('Check fallback - Payee:', checkMeta['Payee Name']);
          }

          if (Object.keys(checkMeta).length > 0) {
            sanitizedMetadata = checkMeta;
            // Set field confidence for fallback extracted fields
            Object.keys(checkMeta).forEach(key => {
              if (fieldConfidence) fieldConfidence[key] = 0.92;
            });
          }
        }

        // Mortgage application fallback extraction: if metadata is empty or discarded
        // but the text clearly matches a Uniform Residential Loan Application,
        // derive key fields directly from the OCR text.
        const looksLikeMortgageApp =
          typeof extractedText === 'string' &&
          (extractedText.includes('Uniform Residential Loan Application') ||
           extractedText.includes('Freddie Mac Form') ||
           extractedText.includes('Fannie Mae Form'));

        if (looksLikeMortgageApp && Object.keys(sanitizedMetadata).length === 0) {
          const text = String(extractedText);
          const fallbackMeta: Record<string, string> = {};

          // Borrower Name - look after "Borrower Name"
          const borrowerMatch = text.match(/Borrower\s+Name[\s\S]{0,80}?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
          if (borrowerMatch?.[1]) {
            fallbackMeta['Borrower Name'] = borrowerMatch[1].trim();
          }

          // SSN - look for ###-##-#### pattern
          const ssnMatch = text.match(/\b(\d{3}-\d{2}-\d{4})\b/);
          if (ssnMatch?.[1]) {
            fallbackMeta['SSN'] = ssnMatch[1];
          }

          // Home Phone - (###) ###-####
          const phoneMatch = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
          if (phoneMatch?.[0]) {
            fallbackMeta['Home Phone'] = phoneMatch[0].trim();
          }

          // Date of Birth
          const dobMatch = text.match(/Date of Birth[\s\S]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
          if (dobMatch?.[1]) {
            fallbackMeta['Date of Birth'] = dobMatch[1].trim();
          }

          // Citizenship - look for U.S. Citizen marker
          if (/U\.S\.\s*Citizen/i.test(text)) {
            fallbackMeta['Citizenship'] = 'U.S. Citizen';
          }

          if (Object.keys(fallbackMeta).length > 0) {
            console.log('Applying mortgage fallback metadata extraction for document', documentId);
            sanitizedMetadata = fallbackMeta;
          }
        }

        // Invoice fallback extraction: if metadata is empty but text contains invoice keywords
        const looksLikeInvoice = documentType === 'invoice' && typeof extractedText === 'string';
        if (looksLikeInvoice && Object.keys(sanitizedMetadata).length === 0) {
          console.log('Applying invoice fallback metadata extraction for document', documentId);
          const text = String(extractedText);
          const invoiceMeta: Record<string, string> = {};

          // Invoice Number - look for "Invoice #:" or "Invoice Number:" followed by alphanumeric
          const invoiceNumMatch = text.match(/Invoice\s*(?:#|Number|No\.?)\s*:?\s*([A-Z0-9\-]+)/i);
          if (invoiceNumMatch?.[1]) {
            invoiceMeta['Invoice Number'] = invoiceNumMatch[1].trim();
            console.log('Invoice fallback - Number:', invoiceMeta['Invoice Number']);
          }

          // Invoice Date - look for "Invoice Date:" followed by date pattern
          const invoiceDateMatch = text.match(/Invoice\s*Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
          if (invoiceDateMatch?.[1]) {
            invoiceMeta['Invoice Date'] = invoiceDateMatch[1].trim();
            console.log('Invoice fallback - Date:', invoiceMeta['Invoice Date']);
          }

          // Invoice Total - look for "Invoice Total" or "Total" with USD amount
          const totalMatch = text.match(/(?:Invoice\s+)?Total\s*(?:\(USD\))?\s*:?\s*\$?\s?([\d,]+\.\d{2})/i);
          if (totalMatch?.[1]) {
            invoiceMeta['Invoice Total'] = '$' + totalMatch[1].trim();
            console.log('Invoice fallback - Total:', invoiceMeta['Invoice Total']);
          }

          // PO Number - look for "PO #" or "Customer PO"
          const poMatch = text.match(/(?:Customer\s+)?(?:PO|P\.O\.)\s*(?:#|Number)?\s*:?\s*([A-Z0-9\-]+)/i);
          if (poMatch?.[1]) {
            invoiceMeta['PO Number'] = poMatch[1].trim();
            console.log('Invoice fallback - PO:', invoiceMeta['PO Number']);
          }

          // Vendor Name - look for company name at start of document or in header
          const vendorMatch = text.match(/^([A-Z][A-Za-z\s]+(?:LLC|Inc|Corp|Co\.?)?)/m);
          if (vendorMatch?.[1] && vendorMatch[1].length > 3 && vendorMatch[1].length < 50) {
            invoiceMeta['Vendor Name'] = vendorMatch[1].trim();
            console.log('Invoice fallback - Vendor:', invoiceMeta['Vendor Name']);
          }

          if (Object.keys(invoiceMeta).length > 0) {
            sanitizedMetadata = invoiceMeta;
            // Set field confidence for fallback extracted fields
            Object.keys(invoiceMeta).forEach(key => {
              if (fieldConfidence) fieldConfidence[key] = 0.90;
            });
          }
        }

        // Log what we're about to save
        console.log(`Saving OCR results - line_items count: ${lineItems?.length || 0}`);
        
        const { error: updateError } = await supabaseAdmin
          .from('documents')
          .update({
            document_type: documentType,
            confidence_score: confidence,
            classification_confidence: confidence,
            extracted_metadata: sanitizedMetadata,
            extracted_text: extractedText,
            line_items: lineItems && lineItems.length > 0 ? lineItems : null,
            field_confidence: fieldConfidence || {},
            pii_detected: piiDetected,
            detected_pii_regions: detectedPiiRegions.length > 0 ? detectedPiiRegions : null,
            word_bounding_boxes: wordBoundingBoxes && wordBoundingBoxes.length > 0 ? wordBoundingBoxes : null
          })
          .eq('id', documentId);
        
        if (updateError) {
          console.error(`Failed to save OCR results for document ${documentId}:`, updateError);
        } else {
          console.log(`Saved OCR results to database for document ${documentId}`);
        }
        // Update batch counters after successful OCR
        try {
          const { data: doc } = await supabaseAdmin
            .from('documents')
            .select('batch_id, uploaded_by')
            .eq('id', documentId)
            .single();
            
          if (doc?.batch_id) {
            // Get current batch stats
            const { data: batchDocs } = await supabaseAdmin
              .from('documents')
              .select('validation_status, confidence_score')
              .eq('batch_id', doc.batch_id);
              
            if (batchDocs) {
              const processedCount = batchDocs.filter(d => d.confidence_score != null && d.confidence_score > 0).length;
              const validatedCount = batchDocs.filter(d => d.validation_status === 'validated').length;
              
              await supabaseAdmin
                .from('batches')
                .update({
                  processed_documents: processedCount,
                  validated_documents: validatedCount
                })
                .eq('id', doc.batch_id);
                
              console.log(`Updated batch ${doc.batch_id} counters: processed=${processedCount}, validated=${validatedCount}`);
            }
          }
          
          // Consume license document after successful OCR processing
          if (doc?.uploaded_by) {
            try {
              // Get user's customer and active license
              const { data: userCustomer } = await supabaseAdmin
                .from('user_customers')
                .select('customer_id')
                .eq('user_id', doc.uploaded_by)
                .single();
                
              if (userCustomer?.customer_id) {
                const { data: license } = await supabaseAdmin
                  .from('licenses')
                  .select('id, remaining_documents')
                  .eq('customer_id', userCustomer.customer_id)
                  .eq('status', 'active')
                  .order('end_date', { ascending: false })
                  .limit(1)
                  .single();
                  
                if (license && license.remaining_documents > 0) {
                  // Decrement license document count
                  await supabaseAdmin
                    .from('licenses')
                    .update({
                      remaining_documents: license.remaining_documents - 1,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', license.id);
                    
                  // Log license usage
                  await supabaseAdmin
                    .from('license_usage')
                    .insert({
                      license_id: license.id,
                      document_id: documentId,
                      documents_used: 1,
                      user_id: doc.uploaded_by
                    });
                    
                  console.log(`License consumed: 1 document for license ${license.id}, remaining: ${license.remaining_documents - 1}`);
                  
                  // Check if license exhausted
                  if (license.remaining_documents - 1 === 0) {
                    await supabaseAdmin
                      .from('licenses')
                      .update({ status: 'exhausted' })
                      .eq('id', license.id);
                    console.log(`License ${license.id} is now exhausted`);
                  }
                }
              }
            } catch (licenseError) {
              console.error('Failed to consume license document:', licenseError);
              // Non-blocking - don't fail OCR if license consumption fails
            }
          }
        } catch (counterError) {
          console.error('Failed to update batch counters:', counterError);
        }
        
        // --- AB 1466 AUTO-REDACTION (ASYNC - NON-BLOCKING) ---
        // Trigger AB 1466 compliance redaction for California county property documents
        EdgeRuntime.waitUntil(
          (async () => {
            try {
              // Check if project has AB 1466 enabled
              const { data: projectSettings } = await supabaseAdmin
                .from('projects')
                .select('enable_ab1466_redaction')
                .eq('id', projectId)
                .single();
              
              if (projectSettings?.enable_ab1466_redaction) {
                console.log(`AB 1466: Triggering auto-redaction for document ${documentId}`);
                
                const ab1466Result = await supabaseAdmin.functions.invoke('auto-redact-ab1466', {
                  body: {
                    documentId: documentId,
                    extractedText: extractedText,
                    wordBoundingBoxes: wordBoundingBoxes
                  }
                });
                
                if (ab1466Result.error) {
                  console.error('AB 1466 redaction error:', ab1466Result.error);
                } else {
                  console.log(`AB 1466: Auto-redaction complete - ${ab1466Result.data?.violationsFound || 0} violations found`);
                }
              }
            } catch (ab1466Error) {
              console.error('AB 1466 background task failed:', ab1466Error);
            }
          })()
        );
        
        // --- PETITION SIGNATURE IMAGE EXTRACTION (ASYNC - NON-BLOCKING) ---
        // Extract and store individual signature images from petition documents
        if (isPetition && lineItems && lineItems.length > 0 && documentId && imageData) {
          EdgeRuntime.waitUntil(
            (async () => {
              try {
                console.log(`Signature Extraction: Starting for ${lineItems.length} signatures in document ${documentId}`);
                
                // Filter line items that have signature bboxes
                const itemsWithBbox = lineItems.filter((item: any) => 
                  item.Signature_Bbox && 
                  typeof item.Signature_Bbox === 'object' &&
                  item.Signature_Present === 'yes'
                );
                
                if (itemsWithBbox.length === 0) {
                  console.log('Signature Extraction: No signatures with bounding boxes found');
                  return;
                }
                
                console.log(`Signature Extraction: Found ${itemsWithBbox.length} signatures with bboxes`);
                
                // Get document batch_id for storage path
                const { data: doc } = await supabaseAdmin
                  .from('documents')
                  .select('batch_id, file_name')
                  .eq('id', documentId)
                  .single();
                
                const batchId = doc?.batch_id || 'unknown';
                const docName = doc?.file_name?.replace(/\.[^/.]+$/, '') || documentId;
                
                // Use AI to crop signatures from the document image
                const extractedSignatures: Array<{rowNumber: number | string, imageUrl: string}> = [];
                
                for (let i = 0; i < itemsWithBbox.length; i++) {
                  const item = itemsWithBbox[i];
                  const bbox = item.Signature_Bbox;
                  const rowNum = item.Row_Number || (i + 1);
                  
                  try {
                    // Use Gemini to extract/crop the signature region
                    const cropPrompt = `Extract ONLY the signature region from this document.

The signature is located at these coordinates (as percentages of document dimensions):
- Left edge (x): ${bbox.x}%
- Top edge (y): ${bbox.y}%  
- Width: ${bbox.width}%
- Height: ${bbox.height}%

Return ONLY the cropped signature image - nothing else. Make the background white/clean.
This is for Row ${rowNum}, signer: ${item.Printed_Name || 'Unknown'}.`;

                    const cropResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: 'google/gemini-2.5-flash-image-preview',
                        messages: [
                          {
                            role: 'user',
                            content: [
                              { type: 'text', text: cropPrompt },
                              { type: 'image_url', image_url: { url: imageData } }
                            ]
                          }
                        ],
                        modalities: ['image', 'text']
                      })
                    });
                    
                    if (!cropResponse.ok) {
                      console.error(`Signature crop failed for row ${rowNum}:`, await cropResponse.text());
                      continue;
                    }
                    
                    const cropResult = await cropResponse.json();
                    const croppedImageUrl = cropResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                    
                    if (!croppedImageUrl) {
                      console.log(`No image generated for row ${rowNum}`);
                      continue;
                    }
                    
                    // Convert base64 to blob and upload to storage
                    const base64Data = croppedImageUrl.replace(/^data:image\/\w+;base64,/, '');
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) {
                      bytes[j] = binaryString.charCodeAt(j);
                    }
                    
                    const sigFileName = `signatures/${batchId}/${docName}_row${rowNum}_sig.png`;
                    
                    const { error: uploadError } = await supabaseAdmin.storage
                      .from('documents')
                      .upload(sigFileName, bytes, {
                        contentType: 'image/png',
                        upsert: true
                      });
                    
                    if (uploadError) {
                      console.error(`Failed to upload signature for row ${rowNum}:`, uploadError);
                      continue;
                    }
                    
                    // Get public URL
                    const { data: urlData } = supabaseAdmin.storage
                      .from('documents')
                      .getPublicUrl(sigFileName);
                    
                    extractedSignatures.push({
                      rowNumber: rowNum,
                      imageUrl: urlData?.publicUrl || sigFileName
                    });
                    
                    console.log(`Signature Extraction: Saved signature for row ${rowNum}`);
                    
                  } catch (cropError) {
                    console.error(`Failed to extract signature for row ${rowNum}:`, cropError);
                  }
                }
                
                // Update line_items in database with signature URLs
                if (extractedSignatures.length > 0) {
                  const updatedLineItems = lineItems.map((item: any) => {
                    const rowNum = item.Row_Number || 0;
                    const sigMatch = extractedSignatures.find(s => String(s.rowNumber) === String(rowNum));
                    if (sigMatch) {
                      return { ...item, Signature_Image_Url: sigMatch.imageUrl };
                    }
                    return item;
                  });
                  
                  await supabaseAdmin
                    .from('documents')
                    .update({ line_items: updatedLineItems })
                    .eq('id', documentId);
                  
                  console.log(`Signature Extraction: Updated ${extractedSignatures.length} signatures in database`);
                }
                
              } catch (sigError) {
                console.error('Signature extraction background task failed:', sigError);
              }
            })()
          );
        }
        
        // --- LINE ITEM VALIDATION LOOKUP (ASYNC - NON-BLOCKING) ---
        // Automatically validate extracted line items against configured lookup database
        if (lineItems && lineItems.length > 0 && projectId) {
          EdgeRuntime.waitUntil(
            (async () => {
              try {
                // Check if project has validation lookup enabled
                const { data: projectSettings } = await supabaseAdmin
                  .from('projects')
                  .select('metadata, name')
                  .eq('id', projectId)
                  .single();
                
                const projectName = (projectSettings?.name || '').toLowerCase();
                const isPetitionProject = projectName.includes('petition');
                const lookupConfig = (projectSettings?.metadata as any)?.validation_lookup_config;
                
                // For petition projects, always run validation if lookup is enabled OR if voter_registry has data
                if (isPetitionProject || (lookupConfig?.enabled && lookupConfig.excelFileUrl)) {
                  console.log(`Line Item Validation: Triggering validation for document ${documentId} with ${lineItems.length} items`);
                  
                  const validationResult = await supabaseAdmin.functions.invoke('validate-line-items', {
                    body: {
                      documentId: documentId,
                      projectId: projectId,
                      lineItems: lineItems
                    }
                  });
                  
                  if (validationResult.error) {
                    console.error('Line item validation error:', validationResult.error);
                  } else {
                    console.log(`Line Item Validation: Complete - ${validationResult.data?.validCount || 0}/${validationResult.data?.totalItems || 0} items validated`);
                  }
                }
              } catch (validationError) {
                console.error('Line item validation background task failed:', validationError);
              }
            })()
          );
        }
      } catch (dbError) {
        console.error('Failed to save OCR results to database:', dbError);
        // Continue even if save fails - we'll still return the data
      }
    }
    
    // --- TRIGGER WORKFLOW EXECUTION (ASYNC - NON-BLOCKING) ---
    // Execute workflows in background without blocking OCR response
    if (documentId) {
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            const supabaseAdmin = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );
            
            // Get document's batch_id and project_id for workflow context
            const { data: doc } = await supabaseAdmin
              .from('documents')
              .select('batch_id, project_id')
              .eq('id', documentId)
              .maybeSingle();
            
            if (doc?.project_id) {
              const workflowResult = await supabaseAdmin.functions.invoke('execute-workflow', {
                body: {
                  eventType: 'document_uploaded',
                  projectId: doc.project_id,
                  documentId: documentId,
                  batchId: doc.batch_id,
                  metadata: {
                    documentType: documentType,
                    confidence: confidence,
                    ...metadata
                  }
                }
              });
              
              if (workflowResult.error) {
                console.error('Workflow execution error:', workflowResult.error);
              } else {
                console.log('Workflow execution completed');
              }
            }
          } catch (workflowError) {
            console.error('Background workflow execution failed:', workflowError);
          }
        })()
      );
    }
    
    // --- RETURN SUCCESS RESPONSE ---
    // Return all extracted data to the client including field-level confidence and PII detection
    // Note: wordBoundingBoxes excluded from response (already saved to DB) to prevent stack overflow on large PDFs
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
        piiDetected: piiDetected,         // Whether PII was detected in the document
        detectedPiiRegions: detectedPiiRegions, // Array of detected PII with locations
        routingApplied: routingApplied,   // Whether smart routing was applied
        suggestedStatus: suggestedStatus   // Suggested validation status based on routing rules
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // --- ERROR HANDLING ---
    // Log detailed error server-side only (for debugging)
    console.error('Error in OCR function:', error);
    
    // If we have a documentId, save minimal error state to DB so document isn't lost
    if (documentId && supabaseClient) {
      try {
        await supabaseClient
          .from('documents')
          .update({
            extracted_text: 'OCR processing failed',
            extracted_metadata: {},
            confidence_score: 0,
            validation_status: 'pending',
            needs_review: true
          })
          .eq('id', documentId);
        
        console.log('Saved error state to database for document:', documentId);
      } catch (dbError) {
        console.error('Failed to save error state to database:', dbError);
      }
    }
    
    // Return safe generic message to client (don't expose internal details)
    return new Response(
      JSON.stringify({ error: 'Failed to process document. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
