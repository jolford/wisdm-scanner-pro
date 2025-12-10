import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { read, utils } from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV text into JSON with better handling for quoted fields
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  // Parse header - handle quoted values
  const parseRow = (line: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"(.*)"$/, '$1'));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"(.*)"$/, '$1'));
    return values;
  };
  
  const headers = parseRow(lines[0]);
  const data: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length >= headers.length - 1) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}

// Normalize string for comparison
function normalize(value: string): string {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Calculate similarity score between two strings
function similarity(str1: string, str2: string): number {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Simple word overlap check
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  const overlapScore = commonWords.length / Math.max(words1.length, words2.length);
  
  return overlapScore;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, projectId, lineItems } = await req.json();

    if (!documentId || !projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing documentId or projectId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating line items for document ${documentId}, project ${projectId}`);

    // Get project validation lookup config
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('metadata')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.log('Project not found:', projectError);
      return new Response(
        JSON.stringify({ validated: false, reason: 'Project not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lookupConfig = (project.metadata as any)?.validation_lookup_config;
    
    if (!lookupConfig?.enabled || !lookupConfig.excelFileUrl) {
      console.log('Validation lookup not enabled for project');
      return new Response(
        JSON.stringify({ validated: false, reason: 'Lookup not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lookup config:', { 
      system: lookupConfig.system, 
      fileName: lookupConfig.excelFileName,
      fieldsCount: lookupConfig.lookupFields?.length 
    });

    // Get signed URL for private bucket access
    let fileUrl = lookupConfig.excelFileUrl;
    
    // If it's a Supabase storage URL, generate a signed URL
    if (fileUrl.includes('supabase.co/storage/v1/object')) {
      // Extract bucket and path from URL
      const urlParts = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
      if (urlParts) {
        const bucket = urlParts[1];
        const path = urlParts[2];
        console.log(`Generating signed URL for bucket: ${bucket}, path: ${path}`);
        
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(path, 300); // 5 minute expiry
        
        if (signedError) {
          console.error('Failed to create signed URL:', signedError);
        } else if (signedData?.signedUrl) {
          fileUrl = signedData.signedUrl;
          console.log('Using signed URL for file access');
        }
      }
    }

    // Fetch the lookup file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      console.error('Failed to fetch lookup file:', fileResponse.statusText, fileUrl);
      return new Response(
        JSON.stringify({ validated: false, reason: 'Could not fetch lookup file' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the lookup data
    let lookupData: any[];
    const fileExtension = lookupConfig.excelFileUrl.toLowerCase();
    
    if (fileExtension.endsWith('.csv')) {
      const csvText = await fileResponse.text();
      lookupData = parseCSV(csvText);
    } else {
      const arrayBuffer = await fileResponse.arrayBuffer();
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      lookupData = utils.sheet_to_json(worksheet);
    }

    console.log(`Loaded ${lookupData.length} records from lookup file`);

    // Get line items from document if not provided
    let itemsToValidate = lineItems;
    if (!itemsToValidate) {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('line_items')
        .eq('id', documentId)
        .single();
      
      itemsToValidate = doc?.line_items || [];
    }

    if (!itemsToValidate || itemsToValidate.length === 0) {
      console.log('No line items to validate');
      return new Response(
        JSON.stringify({ validated: false, reason: 'No line items found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating ${itemsToValidate.length} line items`);

    // Get lookup field mappings
    const lookupFields = lookupConfig.lookupFields?.filter((f: any) => f.lookupEnabled) || [];
    
    // Validate each line item against the lookup data
    const validationResults: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < itemsToValidate.length; i++) {
      const lineItem = itemsToValidate[i];
      const itemResult: any = {
        lineIndex: i,
        lineItem,
        found: false,
        matchScore: 0,
        fieldResults: [],
        bestMatch: null
      };

      // Try to find a matching record in the lookup data
      let bestMatch: any = null;
      let bestScore = 0;

      for (const lookupRecord of lookupData) {
        let totalScore = 0;
        let fieldsChecked = 0;

        for (const fieldMapping of lookupFields) {
          const extractedValue = lineItem[fieldMapping.wisdmField] || '';
          const lookupValue = lookupRecord[fieldMapping.ecmField] || '';
          
          if (extractedValue) {
            const fieldScore = similarity(extractedValue, lookupValue);
            totalScore += fieldScore;
            fieldsChecked++;
          }
        }

        if (fieldsChecked > 0) {
          const avgScore = totalScore / fieldsChecked;
          if (avgScore > bestScore) {
            bestScore = avgScore;
            bestMatch = lookupRecord;
          }
        }
      }

      // If we found a good match (>70% similarity), record it
      if (bestMatch && bestScore >= 0.7) {
        itemResult.found = true;
        itemResult.matchScore = bestScore;
        itemResult.bestMatch = bestMatch;

        // Compare each field
        for (const fieldMapping of lookupFields) {
          const extractedValue = lineItem[fieldMapping.wisdmField] || '';
          const lookupValue = bestMatch[fieldMapping.ecmField] || '';
          const fieldScore = similarity(extractedValue, lookupValue);
          
          itemResult.fieldResults.push({
            field: fieldMapping.wisdmField,
            extractedValue,
            lookupValue,
            matches: fieldScore >= 0.9,
            score: fieldScore,
            suggestion: fieldScore < 0.9 ? lookupValue : null
          });
        }

        validCount++;
      } else {
        invalidCount++;
        
        // Still provide field details for review
        for (const fieldMapping of lookupFields) {
          itemResult.fieldResults.push({
            field: fieldMapping.wisdmField,
            extractedValue: lineItem[fieldMapping.wisdmField] || '',
            lookupValue: null,
            matches: false,
            score: 0,
            suggestion: null
          });
        }
      }

      // Add signature status from extracted line item (for petitions)
      const signaturePresent = lineItem.Signature_Present || lineItem.signature_present || '';
      itemResult.signatureStatus = {
        present: signaturePresent.toLowerCase() === 'yes' || signaturePresent === true,
        value: signaturePresent
      };

      validationResults.push(itemResult);
    }

    console.log(`Validation complete: ${validCount} valid, ${invalidCount} not found in registry`);

    // Store validation results in document metadata
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        validation_suggestions: {
          lookupValidation: {
            validated: true,
            validatedAt: new Date().toISOString(),
            totalItems: itemsToValidate.length,
            validCount,
            invalidCount,
            results: validationResults
          }
        },
        needs_review: invalidCount > 0
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to save validation results:', updateError);
    }

    return new Response(
      JSON.stringify({
        validated: true,
        totalItems: itemsToValidate.length,
        validCount,
        invalidCount,
        results: validationResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in line item validation:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
