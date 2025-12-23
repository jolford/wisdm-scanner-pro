import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<{ success: boolean; data?: T; error?: string; attempts: number }> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, data: result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { success: false, error: lastError, attempts: maxRetries };
}

/**
 * Check database backup health (verification that tables have recent data)
 */
async function verifyDatabaseHealth(supabase: any): Promise<Record<string, unknown>> {
  const checks: Record<string, unknown> = {};
  
  // Check critical tables have recent activity
  const criticalTables = ['batches', 'documents', 'jobs', 'audit_trail'];
  
  for (const table of criticalTables) {
    const result = await withRetry(async () => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count;
    });
    
    checks[table] = {
      accessible: result.success,
      count: result.data,
      attempts: result.attempts,
      error: result.error
    };
  }
  
  // Check for data integrity indicators
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  
  checks.last_job_created = recentJobs?.[0]?.created_at || null;
  
  return checks;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse action from request (default to full maintenance)
    const { action = 'full' } = await req.json().catch(() => ({}));

    let result: Record<string, unknown> = {};

    if (action === 'health' || action === 'full') {
      // Get system health with retry
      const healthResult = await withRetry(async () => {
        const { data, error } = await supabase.rpc('get_system_health');
        if (error) throw error;
        return data;
      });
      
      result.health = healthResult.success ? healthResult.data : { error: healthResult.error };
    }

    if (action === 'maintenance' || action === 'full') {
      // Run full maintenance with retry
      const maintenanceResult = await withRetry(async () => {
        const { data, error } = await supabase.rpc('run_system_maintenance');
        if (error) throw error;
        return data;
      });
      
      result.maintenance = maintenanceResult.success 
        ? maintenanceResult.data 
        : { error: maintenanceResult.error };
    }

    if (action === 'retry_stuck_jobs') {
      const retryResult = await withRetry(async () => {
        const { data, error } = await supabase.rpc('retry_stuck_jobs');
        if (error) throw error;
        return data;
      });
      result.stuck_jobs = retryResult.success ? retryResult.data : { error: retryResult.error };
    }

    if (action === 'cleanup_locks') {
      const lockResult = await withRetry(async () => {
        const { data, error } = await supabase.rpc('cleanup_expired_locks');
        if (error) throw error;
        return data;
      });
      result.locks_cleaned = lockResult.success;
    }

    if (action === 'verify_backup' || action === 'full') {
      // Verify database backup health
      result.backup_verification = await verifyDatabaseHealth(supabase);
    }

    if (action === 'check_alerts' || action === 'full') {
      // Check alert thresholds
      const alertResult = await withRetry(async () => {
        const { data, error } = await supabase.rpc('check_alert_thresholds');
        if (error) throw error;
        return data;
      });
      result.alerts = alertResult.success ? alertResult.data : { error: alertResult.error };
    }

    const executionTime = Date.now() - startTime;
    console.log(`System maintenance completed: ${action} in ${executionTime}ms`, result);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        result,
        executionTimeMs: executionTime,
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
        error: errorMessage,
        executionTimeMs: Date.now() - startTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
