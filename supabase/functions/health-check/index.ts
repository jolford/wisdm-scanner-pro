import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTimeMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Use 'any' type for Supabase client to avoid type conflicts with different versions
async function checkDatabase(supabase: any): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.from('customers').select('id').limit(1);
    const responseTimeMs = Date.now() - start;
    
    if (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTimeMs,
        error: error.message,
      };
    }
    
    return {
      name: 'database',
      status: responseTimeMs > 5000 ? 'degraded' : 'healthy',
      responseTimeMs,
      details: { connected: true },
    };
  } catch (err) {
    return {
      name: 'database',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// Use 'any' type for Supabase client
async function checkStorage(supabase: any): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    const responseTimeMs = Date.now() - start;
    
    if (error) {
      return {
        name: 'storage',
        status: 'unhealthy',
        responseTimeMs,
        error: error.message,
      };
    }
    
    return {
      name: 'storage',
      status: responseTimeMs > 3000 ? 'degraded' : 'healthy',
      responseTimeMs,
      details: { bucketsCount: data?.length || 0 },
    };
  } catch (err) {
    return {
      name: 'storage',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// Use 'any' type for Supabase client
async function checkJobProcessing(supabase: any): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.rpc('get_system_health');
    const responseTimeMs = Date.now() - start;
    
    if (error) {
      return {
        name: 'job_processing',
        status: 'unknown',
        responseTimeMs,
        error: error.message,
      };
    }
    
    const healthData = data as { status?: string; jobs?: Record<string, unknown> } | null;
    const status = healthData?.status || 'unknown';
    return {
      name: 'job_processing',
      status: status as ServiceCheck['status'],
      responseTimeMs,
      details: healthData?.jobs || {},
    };
  } catch (err) {
    return {
      name: 'job_processing',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// Use 'any' type for Supabase client
async function checkAuth(supabase: any): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    // Check rate limit table as proxy for auth health
    const { count, error } = await supabase
      .from('auth_rate_limits')
      .select('*', { count: 'exact', head: true })
      .gt('blocked_until', new Date().toISOString());
    
    const responseTimeMs = Date.now() - start;
    
    if (error) {
      return {
        name: 'authentication',
        status: 'unknown',
        responseTimeMs,
        error: error.message,
      };
    }
    
    // Degraded if too many blocked IPs
    const blockedCount = count || 0;
    return {
      name: 'authentication',
      status: blockedCount > 50 ? 'degraded' : 'healthy',
      responseTimeMs,
      details: { activeBlocks: blockedCount },
    };
  } catch (err) {
    return {
      name: 'authentication',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
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

    // Run all health checks in parallel
    const [dbCheck, storageCheck, jobCheck, authCheck] = await Promise.all([
      checkDatabase(supabase),
      checkStorage(supabase),
      checkJobProcessing(supabase),
      checkAuth(supabase),
    ]);

    const checks = [dbCheck, storageCheck, jobCheck, authCheck];
    
    // Determine overall status
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    const hasDegraded = checks.some(c => c.status === 'degraded');
    const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    // Update service_health table
    for (const check of checks) {
      await supabase
        .from('service_health')
        .upsert({
          service_name: check.name,
          status: check.status,
          last_check_at: new Date().toISOString(),
          response_time_ms: check.responseTimeMs,
          error_message: check.error || null,
          metadata: check.details || {},
          consecutive_failures: check.status === 'unhealthy' ? 1 : 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'service_name',
        });
    }

    const totalResponseTime = Date.now() - startTime;

    console.log(`Health check completed: ${overallStatus} in ${totalResponseTime}ms`);

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTimeMs: totalResponseTime,
        services: checks.reduce((acc, check) => {
          acc[check.name] = {
            status: check.status,
            responseTimeMs: check.responseTimeMs,
            error: check.error,
            ...check.details,
          };
          return acc;
        }, {} as Record<string, unknown>),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: overallStatus === 'unhealthy' ? 503 : 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Health check error:', errorMessage);
    
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      }
    );
  }
});
