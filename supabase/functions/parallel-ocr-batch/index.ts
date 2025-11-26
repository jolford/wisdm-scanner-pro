import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { batchId, maxParallel = 3 } = await req.json();

    console.log(`Starting parallel OCR for batch ${batchId} with max ${maxParallel} concurrent`);

    // Get all pending documents in batch
    const { data: documents, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('batch_id', batchId)
      .order('processing_priority', { ascending: false });

    if (fetchError) throw fetchError;

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No documents to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${documents.length} documents to process`);

    // Process in parallel batches
    const results = [];
    for (let i = 0; i < documents.length; i += maxParallel) {
      const batch = documents.slice(i, i + maxParallel);
      
      const batchPromises = batch.map(async (doc) => {
        try {
          console.log(`Processing document ${doc.id}`);
          
          // Call ocr-scan function
          const { data, error } = await supabase.functions.invoke('ocr-scan', {
            body: { 
              documentId: doc.id,
              enableCache: true,
              skipQueue: true // Process immediately, not through job queue
            }
          });

          if (error) throw error;

          return { documentId: doc.id, success: true, data };
        } catch (error) {
          console.error(`Error processing document ${doc.id}:`, error);
          return { documentId: doc.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      console.log(`Completed batch ${Math.floor(i / maxParallel) + 1}/${Math.ceil(documents.length / maxParallel)}`);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parallel-ocr-batch:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});