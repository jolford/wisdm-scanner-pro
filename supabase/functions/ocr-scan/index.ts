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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    // and identify specific fields with bounding box coordinates
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
        
        systemPrompt = `You are an advanced OCR, ICR, and document classification system specialized in reading barcodes, printed text, and handwritten text. Extract text and return JSON: ${baseJson.slice(0, -1)}${tableJson}}. For each field, provide value and bbox (bounding box) as percentages of document dimensions.

CRITICAL INSTRUCTIONS FOR BARCODE/ACCESSIONING NUMBER EXTRACTION:
1. Look for barcode labels or stickers, typically in the upper right corner of forms
2. Accessioning/Requisition numbers usually follow formats like: CL####-######## or EN####-########
3. Read the human-readable text below or adjacent to the barcode - this is the most accurate source
4. Double-check each digit and hyphen for accuracy
5. Common patterns: CL2021-00353877, EN2022-12345678
6. Ignore OCR noise near barcodes - focus on clear, consistently formatted numbers
7. If you see a barcode label section with "Requisition Label" or similar, that's where the accessioning number is located

Extract actual values from the document for each field with extreme precision for accessioning numbers. Classify the document type.`;

        // Add table extraction instructions if needed
        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = `\n\nTABLE EXTRACTION: This document contains a line item table. Extract ALL rows from the table into the "lineItems" array. Each item should have: ${tableExtractionFields.map((f: any) => f.name).join(', ')}. Be thorough and include every row in the table.`;
        }

        userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'}. CRITICAL: Locate and accurately read the BARCODE LABEL or REQUISITION LABEL (usually upper right corner). The accessioning number follows a format like CL####-######## or EN####-########. Read the human-readable text carefully, verifying each digit. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other). Also extract: ${fieldNames.join(', ')}.${tableInstructions} Return as JSON with extreme accuracy for the accessioning number and document classification.`;
      } else {
        // STANDARD PROMPT FOR GENERAL FIELD EXTRACTION
        const baseJson = `{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": {"value": "extracted value", "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `You are an advanced OCR, ICR, and document classification system that can read both printed and handwritten text. Extract text and return JSON: ${baseJson.slice(0, -1)}${tableJson}}. For each field, provide value and bbox (bounding box) as percentages of document dimensions. Extract actual values from the document for each field, including handwritten values. Classify the document type based on its structure and content.`;
        
        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = ` IMPORTANT: This document contains a line item table. Extract ALL rows from the table into the "lineItems" array. Each item must have: ${tableExtractionFields.map((f: any) => f.name).join(', ')}. Include every single row from the table.`;
        }
        
        userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'} including handwritten text. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other) with confidence score. Also identify: ${fieldNames.join(', ')}.${tableInstructions} Return as JSON.`;
      }
    } else {
      // NO CUSTOM FIELDS - JUST OCR AND CLASSIFICATION
      // Extract all text and classify the document without specific field extraction
      const baseJson = '{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0}';
      const tableJson = hasTableExtraction 
        ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
        : '';
      
      systemPrompt = `You are an advanced OCR, ICR, and document classification system. Extract all text and classify the document type. Return JSON: ${baseJson.slice(0, -1)}${tableJson}}.`;
      
      let tableInstructions = '';
      if (hasTableExtraction) {
        tableInstructions = ` This document contains a line item table. Extract ALL rows into the "lineItems" array with fields: ${tableExtractionFields.map((f: any) => f.name).join(', ')}.`;
      }
      
      userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'} including handwritten text. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other) and provide a confidence score.${tableInstructions} Return as JSON.`;
    }


    // --- CALL LOVABLE AI FOR OCR PROCESSING ---
    // Single AI call that handles OCR, field extraction, classification, and table extraction
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',  // Using Gemini Pro for high accuracy OCR
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            // For PDFs with text, send the text directly
            // For images, send the image data URL
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
                      url: imageData  // Base64 data URL
                    }
                  }
                ]
          }
        ],
        temperature: 0.1,  // Low temperature for more deterministic/accurate extraction
      }),
    });


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
      // Try to extract JSON from the response (AI may include extra text around it)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
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
    } catch (e) {
      // JSON parsing failed - fall back to using raw text
      console.error('JSON parse failed, using raw text:', e);
      extractedText = responseText;
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
              _model: 'google/gemini-2.5-pro',
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

    // --- RETURN SUCCESS RESPONSE ---
    // Return all extracted data to the client
    return new Response(
      JSON.stringify({ 
        text: extractedText,              // Full document text
        metadata: metadata,               // Extracted field values
        lineItems: lineItems,             // Extracted table rows (if applicable)
        documentType: documentType,       // Classified document type
        confidence: confidence,           // OCR confidence score
        boundingBoxes: fieldBoundingBoxes // Field locations on document
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
