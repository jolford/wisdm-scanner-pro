import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Queue Script Job
 * 
 * Creates a new script job for execution by a Windows Agent.
 * Can be triggered by:
 * - Manual button click
 * - Workflow action
 * - Document event
 * - Scheduled task
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      customer_id,
      project_id,
      batch_id,
      document_id,
      script_name,
      script_language,
      script_content,
      script_parameters = {},
      trigger_type,
      trigger_event,
      priority = 5,
      timeout_seconds = 300
    } = body;

    // Validate required fields
    if (!customer_id || !script_name || !script_language || !script_content || !trigger_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to customer
    const { data: hasAccess } = await supabaseAdmin.rpc('has_customer', {
      _user_id: user.id,
      _customer_id: customer_id
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to customer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there are active agents for this customer
    const { data: agents } = await supabaseAdmin
      .from('script_agents')
      .select('id, name, last_heartbeat_at, supported_languages')
      .eq('customer_id', customer_id)
      .eq('is_active', true);

    const activeAgents = (agents || []).filter(a => {
      if (!a.last_heartbeat_at) return false;
      const lastHeartbeat = new Date(a.last_heartbeat_at);
      const now = new Date();
      return (now.getTime() - lastHeartbeat.getTime()) < 5 * 60 * 1000; // 5 min
    });

    const compatibleAgents = activeAgents.filter(a => 
      a.supported_languages?.includes(script_language)
    );

    // Create the job
    const { data: job, error: insertError } = await supabaseAdmin
      .from('script_jobs')
      .insert({
        customer_id,
        project_id,
        batch_id,
        document_id,
        script_name,
        script_language,
        script_content,
        script_parameters,
        trigger_type,
        trigger_event,
        priority,
        timeout_seconds,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating script job:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create script job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Script job created: ${job.id} (${script_name}) - ${compatibleAgents.length} compatible agents online`);

    return new Response(
      JSON.stringify({ 
        job,
        agents_online: activeAgents.length,
        compatible_agents: compatibleAgents.length,
        warning: compatibleAgents.length === 0 
          ? `No active agents support ${script_language}. Install and start a Windows Agent.`
          : undefined
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Queue script job error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
