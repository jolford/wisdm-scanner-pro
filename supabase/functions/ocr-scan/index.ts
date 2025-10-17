import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageData, isPdf, extractionFields, textData, tableExtractionFields } = await req.json();
    
    console.log('Processing OCR request...', isPdf ? 'PDF' : 'Image');
    console.log('Extraction fields:', extractionFields);
    console.log('Table extraction fields:', tableExtractionFields);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('Service configuration error');
    }

    // For PDFs, we require textData to be provided (extracted client-side)
    if (isPdf && !textData) {
      throw new Error('PDF text extraction required. Please ensure text is extracted before sending.');
    }

    // Build optimized single-call prompt with handwriting, barcode, classification, and table extraction support
    let systemPrompt = 'You are an advanced OCR, ICR, and document classification system. Extract all text from documents including printed text, handwritten text, cursive writing, and barcodes. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other). Be very careful to accurately recognize handwritten characters and barcode labels.';
    let userPrompt = 'Extract all text from this document, including any handwritten text. Classify the document type. Pay special attention to handwritten characters, cursive writing, and barcode labels.';
    
    // Determine if we need table extraction
    const hasTableExtraction = tableExtractionFields && Array.isArray(tableExtractionFields) && tableExtractionFields.length > 0;
    
    if (extractionFields && extractionFields.length > 0) {
      const fieldNames = extractionFields.map((f: any) => f.name);
      const hasAccessioningField = extractionFields.some((f: any) => 
        f.name.toLowerCase().includes('accessioning') || 
        f.name.toLowerCase().includes('requisition')
      );
      
      if (hasAccessioningField) {
        const baseJson = `{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": "value"`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `You are an advanced OCR, ICR, and document classification system specialized in reading barcodes, printed text, and handwritten text. Extract text and return JSON: ${baseJson.slice(0, -1)}${tableJson}}.

CRITICAL INSTRUCTIONS FOR BARCODE/ACCESSIONING NUMBER EXTRACTION:
1. Look for barcode labels or stickers, typically in the upper right corner of forms
2. Accessioning/Requisition numbers usually follow formats like: CL####-######## or EN####-########
3. Read the human-readable text below or adjacent to the barcode - this is the most accurate source
4. Double-check each digit and hyphen for accuracy
5. Common patterns: CL2021-00353877, EN2022-12345678
6. Ignore OCR noise near barcodes - focus on clear, consistently formatted numbers
7. If you see a barcode label section with "Requisition Label" or similar, that's where the accessioning number is located

Extract actual values from the document for each field with extreme precision for accessioning numbers. Classify the document type.`;

        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = `\n\nTABLE EXTRACTION: This document contains a line item table. Extract ALL rows from the table into the "lineItems" array. Each item should have: ${tableExtractionFields.map((f: any) => f.name).join(', ')}. Be thorough and include every row in the table.`;
        }

        userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'}. CRITICAL: Locate and accurately read the BARCODE LABEL or REQUISITION LABEL (usually upper right corner). The accessioning number follows a format like CL####-######## or EN####-########. Read the human-readable text carefully, verifying each digit. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other). Also extract: ${fieldNames.join(', ')}.${tableInstructions} Return as JSON with extreme accuracy for the accessioning number and document classification.`;
      } else {
        const baseJson = `{"fullText": "complete extracted text", "documentType": "invoice|receipt|purchase_order|check|form|letter|other", "confidence": 0.0-1.0, "fields": {${fieldNames.map((n: string) => `"${n}": "value"`).join(', ')}}}`;
        const tableJson = hasTableExtraction 
          ? `, "lineItems": [{${tableExtractionFields.map((f: any) => `"${f.name}": "value"`).join(', ')}}]`
          : '';
        
        systemPrompt = `You are an advanced OCR, ICR, and document classification system that can read both printed and handwritten text. Extract text and return JSON: ${baseJson.slice(0, -1)}${tableJson}}. Extract actual values from the document for each field, including handwritten values. Classify the document type based on its structure and content.`;
        
        let tableInstructions = '';
        if (hasTableExtraction) {
          tableInstructions = ` IMPORTANT: This document contains a line item table. Extract ALL rows from the table into the "lineItems" array. Each item must have: ${tableExtractionFields.map((f: any) => f.name).join(', ')}. Include every single row from the table.`;
        }
        
        userPrompt = `Extract all text from this ${isPdf ? 'PDF' : 'image'} including handwritten text. Classify the document type (invoice, receipt, purchase_order, check, form, letter, other) with confidence score. Also identify: ${fieldNames.join(', ')}.${tableInstructions} Return as JSON.`;
      }
    } else {
      // No extraction fields - just OCR, classification, and optional table extraction
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

    // Single AI call for everything
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service unavailable. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: 'Image format not supported. Please use JPG, PNG, or WEBP format.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Service error');
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    // Parse response
    let extractedText = responseText;
    let metadata: Record<string, string> = {};
    let lineItems: any[] = [];
    let documentType = 'other';
    let confidence = 0;
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedText = parsed.fullText || responseText;
        documentType = parsed.documentType || 'other';
        confidence = parsed.confidence || 0;
        
        if (extractionFields && extractionFields.length > 0) {
          metadata = parsed.fields || {};
        }
        
        if (hasTableExtraction && parsed.lineItems) {
          lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
        }
      }
    } catch (e) {
      console.error('JSON parse failed, using raw text:', e);
      extractedText = responseText;
    }

    console.log('OCR completed - Document Type:', documentType, 'Confidence:', confidence, 'Metadata:', metadata, 'Line Items:', lineItems.length);

    return new Response(
      JSON.stringify({ 
        text: extractedText,
        metadata: metadata,
        lineItems: lineItems,
        documentType: documentType,
        confidence: confidence
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Log detailed error server-side only
    console.error('Error in OCR function:', error);
    
    // Return safe generic message to client
    return new Response(
      JSON.stringify({ error: 'Failed to process document. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
