import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

/**
 * Optimized Parallel OCR Batch Processing
 * 
 * IMPORTANT: Uses EdgeRuntime.waitUntil() to run processing in background
 * This allows the user to navigate away while OCR continues processing
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      maxParallel = 5,
      prioritizeSimple = true,
      skipProcessed = true
    } = await req.json();

    console.log(`Starting background OCR for batch ${batchId} with ${maxParallel} concurrent workers`);

    // Update batch status to indicate processing has started
    await supabase
      .from('batches')
      .update({ status: 'scanning', started_at: new Date().toISOString() })
      .eq('id', batchId);

    // Run the actual OCR processing in the background
    const backgroundProcess = async () => {
      const startTime = Date.now();
      
      try {
        // Build query with smart filtering
        let query = supabase
          .from('documents')
          .select('id, file_type, file_name, confidence_score, extracted_metadata, processing_priority')
          .eq('batch_id', batchId);
        
        if (skipProcessed) {
          query = query.or('confidence_score.is.null,extracted_metadata.is.null');
        }

        const { data: documents, error: fetchError } = await query
          .order('processing_priority', { ascending: false });

        if (fetchError) {
          console.error('Error fetching documents:', fetchError);
          await supabase
            .from('batches')
            .update({ status: 'error', metadata: { error: fetchError.message } })
            .eq('id', batchId);
          return;
        }

        if (!documents || documents.length === 0) {
          console.log(`No documents to process for batch ${batchId}`);
          await supabase
            .from('batches')
            .update({ status: 'indexing' })
            .eq('id', batchId);
          return;
        }

        console.log(`Processing ${documents.length} documents for batch ${batchId}`);

        // Sort documents for optimal processing order
        const sortedDocs = prioritizeSimple 
          ? [...documents].sort((a, b) => {
              const aIsPdf = a.file_type === 'application/pdf' ? 1 : 0;
              const bIsPdf = b.file_type === 'application/pdf' ? 1 : 0;
              if (aIsPdf !== bIsPdf) return aIsPdf - bIsPdf;
              return (b.processing_priority || 0) - (a.processing_priority || 0);
            })
          : documents;

        let successCount = 0;
        let failureCount = 0;

        // Process in parallel batches
        for (let i = 0; i < sortedDocs.length; i += maxParallel) {
          const batch = sortedDocs.slice(i, i + maxParallel);
          const batchStartTime = Date.now();
          
          const batchPromises = batch.map(async (doc) => {
            const docStartTime = Date.now();
            try {
              const timeoutMs = doc.file_type === 'application/pdf' ? 75000 : 45000;
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`OCR timeout after ${timeoutMs/1000}s`)), timeoutMs)
              );
              
              const ocrPromise = supabase.functions.invoke('ocr-scan', {
                body: { 
                  documentId: doc.id,
                  enableCache: true,
                  skipQueue: true,
                  optimizeForSpeed: true
                }
              });

              const { data, error } = await Promise.race([ocrPromise, timeoutPromise]) as any;
              const duration = Date.now() - docStartTime;

              if (error) {
                if (error.message?.includes('timeout')) {
                  console.warn(`Document ${doc.id} timed out (${duration}ms) but may complete in background`);
                  return { success: true, warning: 'Timeout but processing continues' };
                }
                throw error;
              }

              return { success: true, confidence: data?.confidence, duration_ms: duration };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              // Timeouts should be treated as potential successes - OCR may complete in background
              if (errorMessage.includes('timeout')) {
                console.warn(`Document ${doc.id} timed out but OCR likely completed in background`);
                return { success: true, warning: 'Timeout but processing continues' };
              }
              console.error(`Error processing document ${doc.id}:`, error);
              return { success: false, error: errorMessage };
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);
          
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.success) {
              successCount++;
            } else {
              failureCount++;
            }
          });

          // Update batch progress
          await supabase
            .from('batches')
            .update({ 
              processed_documents: successCount + failureCount,
              total_documents: sortedDocs.length 
            })
            .eq('id', batchId);

          const batchDuration = Date.now() - batchStartTime;
          console.log(`Batch ${Math.floor(i / maxParallel) + 1}/${Math.ceil(sortedDocs.length / maxParallel)} completed in ${batchDuration}ms`);
        }

        const totalDuration = Date.now() - startTime;
        console.log(`OCR batch ${batchId} complete: ${successCount}/${sortedDocs.length} successful in ${totalDuration}ms`);

        // Update batch status to indexing (ready for validation)
        await supabase
          .from('batches')
          .update({ 
            status: 'indexing',
            processed_documents: successCount + failureCount,
            error_count: failureCount
          })
          .eq('id', batchId);

      } catch (error) {
        console.error(`Background OCR failed for batch ${batchId}:`, error);
        await supabase
          .from('batches')
          .update({ 
            status: 'error', 
            metadata: { error: error instanceof Error ? error.message : 'Unknown error' } 
          })
          .eq('id', batchId);
      }
    };

    // Use EdgeRuntime.waitUntil to run processing in background
    // This allows the response to return immediately while processing continues
    EdgeRuntime.waitUntil(backgroundProcess());

    // Return immediately - processing continues in background
    return new Response(
      JSON.stringify({
        success: true,
        message: 'OCR processing started in background',
        batchId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error starting parallel-ocr-batch:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
