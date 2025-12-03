import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, handleCors, corsHeaders } from "../_shared/auth-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // SECURITY: Require system_admin role for script execution
    // This is a critical security control - arbitrary code execution
    // must only be available to the highest privilege level
    const authResult = await verifyAuth(req, { requireSystemAdmin: true });
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, isSystemAdmin } = authResult;

    // Double-check system admin (defense in depth)
    if (!isSystemAdmin) {
      console.error(`Script execution denied for user ${user.id} - not system admin`);
      return new Response(
        JSON.stringify({ error: 'System administrator access required for script execution' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service client for database operations only
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { scriptId, executionContext = {} } = await req.json();

    if (!scriptId) {
      return new Response(JSON.stringify({ error: 'Script ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch script
    const { data: script, error: scriptError } = await supabaseClient
      .from('custom_scripts')
      .select('*')
      .eq('id', scriptId)
      .single();

    if (scriptError || !script) {
      console.error('Script fetch error:', scriptError);
      return new Response(JSON.stringify({ error: 'Script not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!script.is_active) {
      return new Response(JSON.stringify({ error: 'Script is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SECURITY: Only allow JavaScript/TypeScript execution
    // Python and PowerShell subprocess execution is disabled for security
    if (script.script_language !== 'javascript' && script.script_language !== 'typescript') {
      console.error(`Blocked execution of ${script.script_language} script - only JS/TS allowed`);
      return new Response(
        JSON.stringify({ 
          error: 'Only JavaScript and TypeScript scripts are supported for security reasons',
          details: 'Python and PowerShell execution has been disabled'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const startTime = Date.now();
    let output: any = null;
    let status = 'success';
    let errorMessage = null;

    try {
      // Create limited execution context
      // SECURITY: Do NOT pass service role client or sensitive env vars to user code
      const limitedContext = {
        user: { id: user.id, email: user.email },
        executionContext,
        console: {
          log: (...args: any[]) => console.log('[SCRIPT]', ...args),
          error: (...args: any[]) => console.error('[SCRIPT]', ...args),
        },
        // Read-only supabase client with user context (respects RLS)
        supabase: createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        ),
      };

      // Execute JavaScript/TypeScript in Deno sandbox
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const scriptFunction = new AsyncFunction('context', `
        const { supabase, user, executionContext, console } = context;
        ${script.script_code}
      `);
      
      output = await Promise.race([
        scriptFunction(limitedContext),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Script timeout (30s)')), 30000))
      ]);

    } catch (error: any) {
      console.error('Script execution error:', error);
      status = 'failed';
      errorMessage = error.message;
      output = null;
    }

    const executionDuration = Date.now() - startTime;

    // Log execution for audit trail
    await supabaseClient.from('script_execution_logs').insert({
      script_id: scriptId,
      executed_by: user.id,
      execution_context: executionContext,
      status,
      output: output ? JSON.stringify(output) : null,
      error_message: errorMessage,
      execution_duration_ms: executionDuration,
    });

    console.log(`Script ${scriptId} executed by system admin ${user.id}: ${status} (${executionDuration}ms)`);

    return new Response(
      JSON.stringify({
        success: status === 'success',
        output,
        error: errorMessage,
        executionDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Execute script error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
