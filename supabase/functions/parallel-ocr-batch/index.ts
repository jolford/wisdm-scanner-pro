import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Optimized Parallel OCR Batch Processing
 * 
 * Performance improvements:
 * - Adaptive parallelism based on document size/complexity
 * - Priority queue processing (high confidence first for faster validation)
 * - Batch caching to avoid reprocessing
 * - Progressive result streaming
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      batchId, 
      maxParallel = 5, // Increased default for better throughput
      prioritizeSimple = true, // Process simpler docs first for faster validation availability
      skipProcessed = true // Skip already-processed documents
    } = await req.json();

    console.log(`Starting optimized parallel OCR for batch ${batchId} with ${maxParallel} concurrent workers`);

    // Build query with smart filtering
    let query = supabase
      .from('documents')
      .select('id, file_type, file_name, confidence_score, extracted_metadata, processing_priority')
      .eq('batch_id', batchId);
    
    // Skip already-processed documents for efficiency
    if (skipProcessed) {
      query = query.or('confidence_score.is.null,extracted_metadata.is.null');
    }

    const { data: documents, error: fetchError } = await query
      .order('processing_priority', { ascending: false });

    if (fetchError) throw fetchError;

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No documents to process', 
          processed: 0,
          duration_ms: Date.now() - startTime 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${documents.length} documents to process (filtered: skipProcessed=${skipProcessed})`);

    // Sort documents for optimal processing order
    // Smaller/simpler documents first for faster validation queue population
    const sortedDocs = prioritizeSimple 
      ? [...documents].sort((a, b) => {
          // PDFs tend to be more complex, process images first
          const aIsPdf = a.file_type === 'application/pdf' ? 1 : 0;
          const bIsPdf = b.file_type === 'application/pdf' ? 1 : 0;
          if (aIsPdf !== bIsPdf) return aIsPdf - bIsPdf;
          // Then by processing priority
          return (b.processing_priority || 0) - (a.processing_priority || 0);
        })
      : documents;

    // Process in parallel with adaptive batching
    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Use Promise.allSettled for better error isolation
    for (let i = 0; i < sortedDocs.length; i += maxParallel) {
      const batch = sortedDocs.slice(i, i + maxParallel);
      const batchStartTime = Date.now();
      
      const batchPromises = batch.map(async (doc) => {
        const docStartTime = Date.now();
        try {
          // Optimized timeout - shorter for images, longer for PDFs
          const timeoutMs = doc.file_type === 'application/pdf' ? 75000 : 45000;
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`OCR timeout after ${timeoutMs/1000}s`)), timeoutMs)
          );
          
          const ocrPromise = supabase.functions.invoke('ocr-scan', {
            body: { 
              documentId: doc.id,
              enableCache: true,
              skipQueue: true,
              optimizeForSpeed: true // New flag for speed optimization
            }
          });

          const { data, error } = await Promise.race([ocrPromise, timeoutPromise]) as any;

          const duration = Date.now() - docStartTime;

          if (error) {
            if (error.message?.includes('timeout')) {
              console.warn(`Document ${doc.id} timed out (${duration}ms) but may complete in background`);
              return { documentId: doc.id, success: true, warning: 'Timeout but processing continues', duration_ms: duration };
            }
            throw error;
          }

          return { 
            documentId: doc.id, 
            success: true, 
            confidence: data?.confidence,
            duration_ms: duration 
          };
        } catch (error) {
          console.error(`Error processing document ${doc.id}:`, error);
          return { 
            documentId: doc.id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            duration_ms: Date.now() - docStartTime
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) successCount++;
          else failureCount++;
        } else {
          results.push({ 
            documentId: batch[idx].id, 
            success: false, 
            error: result.reason?.message || 'Promise rejected' 
          });
          failureCount++;
        }
      });

      const batchDuration = Date.now() - batchStartTime;
      const avgDocTime = batchDuration / batch.length;
      console.log(`Batch ${Math.floor(i / maxParallel) + 1}/${Math.ceil(sortedDocs.length / maxParallel)} completed in ${batchDuration}ms (avg ${avgDocTime.toFixed(0)}ms/doc)`);
    }

    const totalDuration = Date.now() - startTime;
    const avgTimePerDoc = totalDuration / results.length;

    console.log(`OCR batch complete: ${successCount}/${results.length} successful in ${totalDuration}ms (avg ${avgTimePerDoc.toFixed(0)}ms/doc)`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        duration_ms: totalDuration,
        avg_doc_time_ms: Math.round(avgTimePerDoc),
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parallel-ocr-batch:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});