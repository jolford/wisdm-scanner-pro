import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { batchId } = await req.json();

    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'batchId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get batch details
    const { data: batch, error: batchError } = await supabaseClient
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError) throw batchError;

    // Find documents that haven't been processed
    const { data: documents, error: docsError } = await supabaseClient
      .from('documents')
      .select('id')
      .eq('batch_id', batchId)
      .or('confidence_score.is.null,extracted_metadata.is.null');

    if (docsError) throw docsError;

    const unprocessedCount = documents?.length || 0;
    console.log(`Found ${unprocessedCount} unprocessed documents in batch ${batchId}`);

    if (unprocessedCount === 0) {
      // All documents processed, update batch status
      await supabaseClient
        .from('batches')
        .update({ status: 'indexing' })
        .eq('id', batchId);

      return new Response(
        JSON.stringify({ 
          message: 'All documents already processed',
          unprocessedCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset batch status to scanning
    await supabaseClient
      .from('batches')
      .update({ 
        status: 'scanning',
        started_at: new Date().toISOString(),
        metadata: {
          ...(batch.metadata || {}),
          resumed_at: new Date().toISOString()
        }
      })
      .eq('id', batchId);

    // Run parallel OCR in background
    const backgroundProcess = async () => {
      try {
        console.log(`Starting parallel OCR for ${unprocessedCount} documents in batch ${batchId}`);
        
        // Get all unprocessed documents
        const { data: docs } = await supabaseClient
          .from('documents')
          .select('id, file_type, file_name')
          .eq('batch_id', batchId)
          .or('confidence_score.is.null,extracted_metadata.is.null');

        if (!docs || docs.length === 0) {
          await supabaseClient
            .from('batches')
            .update({ status: 'indexing' })
            .eq('id', batchId);
          return;
        }

        let successCount = 0;
        let failCount = 0;
        const maxParallel = 5;

        // Process in parallel batches
        for (let i = 0; i < docs.length; i += maxParallel) {
          const batchDocs = docs.slice(i, i + maxParallel);
          
          const promises = batchDocs.map(async (doc) => {
            try {
              const { error } = await supabaseClient.functions.invoke('ocr-scan', {
                body: { documentId: doc.id }
              });
              
              if (error) {
                console.error(`OCR failed for ${doc.id}:`, error);
                return false;
              }
              return true;
            } catch (err) {
              console.error(`OCR exception for ${doc.id}:`, err);
              return false;
            }
          });

          const results = await Promise.allSettled(promises);
          results.forEach((r) => {
            if (r.status === 'fulfilled' && r.value) successCount++;
            else failCount++;
          });

          // Update batch progress
          await supabaseClient
            .from('batches')
            .update({ 
              processed_documents: successCount + failCount,
              error_count: failCount
            })
            .eq('id', batchId);

          console.log(`Batch ${batchId}: processed ${successCount + failCount}/${docs.length}`);
        }

        // Update final batch status
        await supabaseClient
          .from('batches')
          .update({ 
            status: 'indexing',
            processed_documents: successCount + failCount,
            error_count: failCount
          })
          .eq('id', batchId);

        console.log(`Batch ${batchId} resume complete: ${successCount} success, ${failCount} failed`);

      } catch (error) {
        console.error(`Background resume failed for batch ${batchId}:`, error);
        await supabaseClient
          .from('batches')
          .update({ 
            status: 'error',
            metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
          })
          .eq('id', batchId);
      }
    };

    // Run in background
    EdgeRuntime.waitUntil(backgroundProcess());

    return new Response(
      JSON.stringify({ 
        message: 'Batch resume started in background',
        batchId,
        unprocessedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Resume batch error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
