/**
 * Duplicate Detection Edge Function
 * 
 * Detects duplicate petition entries using:
 * - Name similarity (Jaro-Winkler distance)
 * - Address matching
 * - Signature comparison (optional)
 * 
 * Request body:
 * - documentId: UUID of document to check
 * - batchId: UUID of batch (checks within batch and optionally cross-batch)
 * - checkCrossBatch: boolean (default: false)
 * - thresholds: { name: 0.85, address: 0.90, signature: 0.85 }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DuplicateDetectionSchema = z.object({
  documentId: z.string().uuid(),
  batchId: z.string().uuid(),
  checkCrossBatch: z.boolean().optional(),
  thresholds: z.object({
    name: z.number().min(0).max(1).optional(),
    address: z.number().min(0).max(1).optional(),
    signature: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Jaro-Winkler distance implementation
function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const s1_len = s1.length;
  const s2_len = s2.length;
  
  if (s1_len === 0 || s2_len === 0) return 0;

  const match_distance = Math.floor(Math.max(s1_len, s2_len) / 2) - 1;
  const s1_matches = new Array(s1_len).fill(false);
  const s2_matches = new Array(s2_len).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1_len; i++) {
    const start = Math.max(0, i - match_distance);
    const end = Math.min(i + match_distance + 1, s2_len);

    for (let j = start; j < end; j++) {
      if (s2_matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1_matches[i] = true;
      s2_matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Find transpositions
  let k = 0;
  for (let i = 0; i < s1_len; i++) {
    if (!s1_matches[i]) continue;
    while (!s2_matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1_len + matches / s2_len + (matches - transpositions / 2) / matches) / 3;

  // Jaro-Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(s1_len, s2_len); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
    if (prefix >= 4) break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// Levenshtein distance for addresses
function levenshtein(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return 1 - (len2 / Math.max(len1, len2));
  if (len2 === 0) return 1 - (len1 / Math.max(len1, len2));

  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

// Normalize text for comparison
function normalizeText(text: string): string {
  if (!text) return '';
  return text.toUpperCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations (system function)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    const validated = DuplicateDetectionSchema.parse(body);
    const {
      documentId,
      batchId,
      checkCrossBatch = false,
      thresholds = { name: 0.85, address: 0.90, signature: 0.85 }
    } = validated;
    
    // Ensure threshold values are defined
    const finalThresholds = {
      name: thresholds.name ?? 0.85,
      address: thresholds.address ?? 0.90,
      signature: thresholds.signature ?? 0.85,
    };

    console.log('Checking for duplicates:', { documentId, batchId, checkCrossBatch });

    // Get current document data
    const { data: currentDoc, error: docError } = await supabaseClient
      .from('documents')
      .select('extracted_metadata, file_url, document_type')
      .eq('id', documentId)
      .single();

    if (docError || !currentDoc) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentMeta = currentDoc.extracted_metadata || {};
    
    // Extract fields based on document type
    let currentName = '';
    let currentAddress = '';
    let currentIdentifier = ''; // Invoice number, PO number, etc.
    
    if (currentDoc.document_type === 'invoice') {
      // Invoice duplicate detection
      currentName = normalizeText(currentMeta['Vendor Name'] || currentMeta.vendor_name || '');
      currentIdentifier = normalizeText(currentMeta['Invoice Number'] || currentMeta.invoice_number || '');
      currentAddress = normalizeText(
        [
          currentMeta['Vendor Address'] || currentMeta.vendor_address || '',
          currentMeta['Invoice Date'] || currentMeta.invoice_date || ''
        ].join(' ')
      );
    } else {
      // Petition/generic duplicate detection
      currentName = normalizeText(
        currentMeta.Printed_Name || currentMeta['Printed Name'] || currentMeta.name || ''
      );
      currentAddress = normalizeText(
        [
          currentMeta.Address || currentMeta.address || '',
          currentMeta.City || currentMeta.city || '',
          currentMeta.Zip || currentMeta.zip || ''
        ].join(' ')
      );
    }

    if (!currentName && !currentAddress && !currentIdentifier) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicates: [],
          message: 'No name or address data to compare'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query to find potential duplicates
    let query = supabaseClient
      .from('documents')
      .select('id, extracted_metadata, file_url, batch_id, document_type')
      .neq('id', documentId);

    if (!checkCrossBatch) {
      query = query.eq('batch_id', batchId);
    } else {
      // Get project ID from batch
      const { data: batch } = await supabaseClient
        .from('batches')
        .select('project_id')
        .eq('id', batchId)
        .single();
      
      if (batch) {
        // Get all batches in same project
        const { data: projectBatches } = await supabaseClient
          .from('batches')
          .select('id')
          .eq('project_id', batch.project_id);
        
        if (projectBatches) {
          const batchIds = projectBatches.map(b => b.id);
          query = query.in('batch_id', batchIds);
        }
      }
    }

    const { data: candidateDocs, error: queryError } = await query.limit(500);

    if (queryError) {
      console.error('Error querying documents:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query documents' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duplicates: any[] = [];

    // Check each candidate
    for (const candidate of candidateDocs || []) {
      const candMeta = candidate.extracted_metadata || {};
      
      let candName = '';
      let candAddress = '';
      let candIdentifier = '';
      
      if (candidate.document_type === 'invoice') {
        candName = normalizeText(candMeta['Vendor Name'] || candMeta.vendor_name || '');
        candIdentifier = normalizeText(candMeta['Invoice Number'] || candMeta.invoice_number || '');
        candAddress = normalizeText(
          [
            candMeta['Vendor Address'] || candMeta.vendor_address || '',
            candMeta['Invoice Date'] || candMeta.invoice_date || ''
          ].join(' ')
        );
      } else {
        candName = normalizeText(
          candMeta.Printed_Name || candMeta['Printed Name'] || candMeta.name || ''
        );
        candAddress = normalizeText(
          [
            candMeta.Address || candMeta.address || '',
            candMeta.City || candMeta.city || '',
            candMeta.Zip || candMeta.zip || ''
          ].join(' ')
        );
      }

      if (!candName && !candAddress && !candIdentifier) continue;

      // Calculate similarities
      const nameSim = currentName && candName 
        ? jaroWinkler(currentName, candName)
        : 0;
      const addressSim = currentAddress && candAddress
        ? levenshtein(currentAddress, candAddress)
        : 0;
      const identifierSim = currentIdentifier && candIdentifier
        ? (currentIdentifier === candIdentifier ? 1.0 : 0)
        : 0;

      // Determine if duplicate
      const isNameMatch = nameSim >= finalThresholds.name;
      const isAddressMatch = addressSim >= finalThresholds.address;
      const isIdentifierMatch = identifierSim >= 0.95;
      
      const isDuplicate = isIdentifierMatch || 
                         ((currentName && candName && isNameMatch) && 
                          (currentAddress && candAddress && isAddressMatch));

      if (isDuplicate) {
        const overallScore = Math.max(nameSim, addressSim, identifierSim);
        
        const matchingFields: any = {};
        if (isNameMatch) matchingFields.name = { current: currentName, candidate: candName, similarity: nameSim };
        if (isAddressMatch) matchingFields.address = { current: currentAddress, candidate: candAddress, similarity: addressSim };
        if (isIdentifierMatch) matchingFields.identifier = { current: currentIdentifier, candidate: candIdentifier, similarity: identifierSim };

        duplicates.push({
          duplicate_document_id: candidate.id,
          duplicate_type: isIdentifierMatch ? 'identifier' : 'combined',
          similarity_score: overallScore,
          duplicate_fields: matchingFields
        });

        // Save to database
        const { error: insertError } = await supabaseClient
          .from('duplicate_detections')
          .insert({
            document_id: documentId,
            batch_id: batchId,
            duplicate_document_id: candidate.id,
            duplicate_type: isIdentifierMatch ? 'identifier' : 'combined',
            similarity_score: overallScore,
            duplicate_fields: matchingFields,
            status: 'pending'
          });
        
        if (insertError) {
          console.error('Failed to insert duplicate detection:', insertError);
        }
      }
    }

    console.log(`Found ${duplicates.length} potential duplicates`);

    return new Response(
      JSON.stringify({
        success: true,
        duplicates: duplicates,
        total_checked: candidateDocs?.length || 0,
        total_duplicates: duplicates.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in duplicate detection:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to detect duplicates. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});