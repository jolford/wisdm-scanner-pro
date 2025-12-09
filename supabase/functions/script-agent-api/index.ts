import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Script Agent API
 * 
 * Endpoints for Windows Agent communication:
 * - POST /register - Register a new agent and get API key
 * - GET /poll - Get pending jobs for this agent
 * - POST /heartbeat - Send heartbeat to keep agent alive
 * - POST /claim/:jobId - Claim a job for execution
 * - POST /complete/:jobId - Mark job as completed with results
 * - POST /fail/:jobId - Mark job as failed with error
 */

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // Get API key from header
  const apiKey = req.headers.get('X-Agent-API-Key');

  try {
    // Register new agent (no auth required, uses customer admin JWT)
    if (action === 'register' && req.method === 'POST') {
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
      const { customer_id, name, machine_name, supported_languages } = body;

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

      // Generate API key
      const rawKey = crypto.randomUUID() + '-' + crypto.randomUUID();
      const keyPrefix = rawKey.substring(0, 8);
      
      // Hash the key
      const encoder = new TextEncoder();
      const data = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Create agent
      const { data: agent, error: insertError } = await supabaseAdmin
        .from('script_agents')
        .insert({
          customer_id,
          name,
          machine_name,
          api_key_hash: keyHash,
          api_key_prefix: keyPrefix,
          supported_languages: supported_languages || ['powershell', 'python', 'vbscript', 'batch'],
          created_by: user.id
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating agent:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create agent' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Agent registered: ${agent.id} for customer ${customer_id}`);

      return new Response(
        JSON.stringify({ 
          agent_id: agent.id,
          api_key: rawKey,
          message: 'Store this API key securely - it cannot be retrieved again'
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other endpoints require agent API key
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'X-Agent-API-Key header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('script_agents')
      .select('*')
      .eq('api_key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Poll for pending jobs
    if (action === 'poll' && req.method === 'GET') {
      // Update heartbeat
      await supabaseAdmin
        .from('script_agents')
        .update({ 
          last_heartbeat_at: new Date().toISOString(),
          last_ip_address: clientIp
        })
        .eq('id', agent.id);

      // Get pending jobs for this agent's customer
      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from('script_jobs')
        .select('*')
        .eq('customer_id', agent.customer_id)
        .eq('status', 'pending')
        .in('script_language', agent.supported_languages)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(10);

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch jobs' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ jobs: jobs || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Heartbeat
    if (action === 'heartbeat' && req.method === 'POST') {
      await supabaseAdmin
        .from('script_agents')
        .update({ 
          last_heartbeat_at: new Date().toISOString(),
          last_ip_address: clientIp
        })
        .eq('id', agent.id);

      return new Response(
        JSON.stringify({ status: 'ok', agent_id: agent.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Claim a job
    if (action === 'claim' && req.method === 'POST') {
      const body = await req.json();
      const { job_id } = body;

      const { data: job, error: claimError } = await supabaseAdmin
        .from('script_jobs')
        .update({ 
          status: 'assigned',
          agent_id: agent.id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', job_id)
        .eq('customer_id', agent.customer_id)
        .eq('status', 'pending')
        .select()
        .single();

      if (claimError || !job) {
        return new Response(
          JSON.stringify({ error: 'Failed to claim job - may already be claimed' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Job ${job_id} claimed by agent ${agent.id}`);

      return new Response(
        JSON.stringify({ job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start execution
    if (action === 'start' && req.method === 'POST') {
      const body = await req.json();
      const { job_id } = body;

      const { data: job, error: startError } = await supabaseAdmin
        .from('script_jobs')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', job_id)
        .eq('agent_id', agent.id)
        .eq('status', 'assigned')
        .select()
        .single();

      if (startError || !job) {
        return new Response(
          JSON.stringify({ error: 'Failed to start job' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Complete a job
    if (action === 'complete' && req.method === 'POST') {
      const body = await req.json();
      const { job_id, exit_code, stdout, stderr, result_data } = body;

      const { data: job, error: completeError } = await supabaseAdmin
        .from('script_jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          exit_code,
          stdout,
          stderr,
          result_data
        })
        .eq('id', job_id)
        .eq('agent_id', agent.id)
        .in('status', ['assigned', 'running'])
        .select()
        .single();

      if (completeError || !job) {
        return new Response(
          JSON.stringify({ error: 'Failed to complete job' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Job ${job_id} completed by agent ${agent.id} with exit code ${exit_code}`);

      return new Response(
        JSON.stringify({ job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fail a job
    if (action === 'fail' && req.method === 'POST') {
      const body = await req.json();
      const { job_id, error_message, stdout, stderr } = body;

      const { data: currentJob } = await supabaseAdmin
        .from('script_jobs')
        .select('retry_count, max_retries')
        .eq('id', job_id)
        .single();

      const retryCount = (currentJob?.retry_count || 0) + 1;
      const maxRetries = currentJob?.max_retries || 3;
      const newStatus = retryCount >= maxRetries ? 'failed' : 'pending';

      const { data: job, error: failError } = await supabaseAdmin
        .from('script_jobs')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'failed' ? new Date().toISOString() : null,
          error_message,
          stdout,
          stderr,
          retry_count: retryCount,
          agent_id: newStatus === 'pending' ? null : agent.id,
          assigned_at: newStatus === 'pending' ? null : undefined
        })
        .eq('id', job_id)
        .eq('agent_id', agent.id)
        .in('status', ['assigned', 'running'])
        .select()
        .single();

      if (failError || !job) {
        return new Response(
          JSON.stringify({ error: 'Failed to update job status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Job ${job_id} ${newStatus} (retry ${retryCount}/${maxRetries})`);

      return new Response(
        JSON.stringify({ job, will_retry: newStatus === 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Script agent API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
