import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse action from request (default to full maintenance)
    const { action = 'full' } = await req.json().catch(() => ({}));

    let result: Record<string, unknown> = {};

    if (action === 'health' || action === 'full') {
      // Get system health
      const { data: healthData, error: healthError } = await supabase.rpc('get_system_health');
      if (healthError) throw healthError;
      result.health = healthData;
    }

    if (action === 'maintenance' || action === 'full') {
      // Run full maintenance
      const { data: maintenanceData, error: maintenanceError } = await supabase.rpc('run_system_maintenance');
      if (maintenanceError) throw maintenanceError;
      result.maintenance = maintenanceData;
    }

    if (action === 'retry_stuck_jobs') {
      const { data, error } = await supabase.rpc('retry_stuck_jobs');
      if (error) throw error;
      result.stuck_jobs = data;
    }

    if (action === 'cleanup_locks') {
      const { data, error } = await supabase.rpc('cleanup_expired_locks');
      if (error) throw error;
      result.locks_cleaned = true;
    }

    console.log(`System maintenance completed: ${action}`, result);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        result,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('System maintenance error:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
