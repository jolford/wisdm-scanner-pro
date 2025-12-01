import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Find documents that haven't been processed or failed
    const { data: documents, error: docsError } = await supabaseClient
      .from('documents')
      .select('id, file_url, file_name')
      .eq('batch_id', batchId)
      .or('confidence_score.is.null,confidence_score.eq.0,extracted_metadata.is.null');

    if (docsError) throw docsError;

    console.log(`Found ${documents?.length || 0} documents to reprocess in batch ${batchId}`);

    // Reset batch status to scanning
    const { error: updateError } = await supabaseClient
      .from('batches')
      .update({ 
        status: 'scanning',
        error_count: 0,
        metadata: {
          ...(batch.metadata || {}),
          resumed_at: new Date().toISOString()
        }
      })
      .eq('id', batchId);

    if (updateError) throw updateError;

    // Trigger OCR reprocessing for each document
    const reprocessPromises = (documents || []).map(async (doc) => {
      try {
        const { error: reprocessError } = await supabaseClient.functions.invoke('reprocess-document', {
          body: { documentId: doc.id }
        });
        
        if (reprocessError) {
          console.error(`Failed to reprocess document ${doc.id}:`, reprocessError);
          return { success: false, documentId: doc.id, error: reprocessError.message };
        }
        
        return { success: true, documentId: doc.id };
      } catch (err) {
        console.error(`Exception reprocessing document ${doc.id}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, documentId: doc.id, error: errorMsg };
      }
    });

    const results = await Promise.all(reprocessPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        message: `Batch resume initiated. ${successCount} documents queued for reprocessing, ${failCount} failed.`,
        totalDocuments: documents?.length || 0,
        successCount,
        failCount,
        results
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