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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find batches that have been exporting for over 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: timedOutBatches, error: fetchError } = await supabase
      .from('batches')
      .select('id, batch_name, export_started_at')
      .eq('status', 'exporting')
      .not('export_started_at', 'is', null)
      .lt('export_started_at', tenMinutesAgo);

    if (fetchError) throw fetchError;

    if (!timedOutBatches || timedOutBatches.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No timed out batches found',
          timedOut: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${timedOutBatches.length} timed out batch(es)`);

    // Update batches to error state
    const batchIds = timedOutBatches.map(b => b.id);
    
    const { error: updateError } = await supabase
      .from('batches')
      .update({
        status: 'error',
        export_started_at: null,
        metadata: supabase.rpc('jsonb_set', {
          target: 'metadata',
          path: '{exportError}',
          value: JSON.stringify({
            error: 'Export timeout',
            message: 'Export operation exceeded 10 minute timeout',
            timedOutAt: new Date().toISOString()
          })
        })
      })
      .in('id', batchIds);

    if (updateError) {
      console.error('Error updating timed out batches:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Marked ${timedOutBatches.length} batch(es) as timed out`,
        timedOut: timedOutBatches.length,
        batches: timedOutBatches.map(b => ({
          id: b.id,
          name: b.batch_name,
          exportStartedAt: b.export_started_at
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error checking export timeouts:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to check export timeouts',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
