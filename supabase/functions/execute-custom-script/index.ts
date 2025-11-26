import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const startTime = Date.now();
    let output: any = null;
    let status = 'success';
    let errorMessage = null;

    try {
      // Create execution context with access to Supabase and utilities
      const context = {
        supabase: supabaseClient,
        user,
        executionContext,
        console: {
          log: (...args: any[]) => console.log('[SCRIPT]', ...args),
          error: (...args: any[]) => console.error('[SCRIPT]', ...args),
        },
      };

      // Execute script based on language
      if (script.script_language === 'javascript' || script.script_language === 'typescript') {
        // Execute JavaScript/TypeScript directly in Deno
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction('context', `
          const { supabase, user, executionContext, console } = context;
          ${script.script_code}
        `);
        
        output = await Promise.race([
          scriptFunction(context),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Script timeout')), 30000))
        ]);
      } else if (script.script_language === 'python') {
        // For Python, PowerShell, VBScript - we need to execute via subprocess
        // This requires the respective runtime to be installed
        const tempFile = await Deno.makeTempFile({ suffix: '.py' });
        await Deno.writeTextFile(tempFile, script.script_code);
        
        const command = new Deno.Command('python3', {
          args: [tempFile],
          env: {
            SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
            SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            EXECUTION_CONTEXT: JSON.stringify(executionContext),
          },
        });
        
        const { code, stdout, stderr } = await command.output();
        
        await Deno.remove(tempFile);
        
        if (code !== 0) {
          throw new Error(new TextDecoder().decode(stderr));
        }
        
        output = new TextDecoder().decode(stdout);
      } else if (script.script_language === 'powershell') {
        const tempFile = await Deno.makeTempFile({ suffix: '.ps1' });
        await Deno.writeTextFile(tempFile, script.script_code);
        
        const command = new Deno.Command('powershell', {
          args: ['-File', tempFile],
          env: {
            SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
            SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            EXECUTION_CONTEXT: JSON.stringify(executionContext),
          },
        });
        
        const { code, stdout, stderr } = await command.output();
        
        await Deno.remove(tempFile);
        
        if (code !== 0) {
          throw new Error(new TextDecoder().decode(stderr));
        }
        
        output = new TextDecoder().decode(stdout);
      } else {
        throw new Error(`Unsupported script language: ${script.script_language}`);
      }

    } catch (error: any) {
      console.error('Script execution error:', error);
      status = 'failed';
      errorMessage = error.message;
      output = null;
    }

    const executionDuration = Date.now() - startTime;

    // Log execution
    await supabaseClient.from('script_execution_logs').insert({
      script_id: scriptId,
      executed_by: user.id,
      execution_context: executionContext,
      status,
      output: output ? JSON.stringify(output) : null,
      error_message: errorMessage,
      execution_duration_ms: executionDuration,
    });

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
