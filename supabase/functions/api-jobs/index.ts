
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const jobId = pathParts[pathParts.length - 1];

    // GET /api-jobs - List user's jobs
    if (req.method === 'GET' && !jobId) {
      const status = url.searchParams.get('status');
      const jobType = url.searchParams.get('job_type');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (jobType) query = query.eq('job_type', jobType);

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          jobs: data,
          total: count,
          limit,
          offset
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-jobs/{id} - Get specific job status
    if (req.method === 'GET' && jobId) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-jobs - Create new job (OCR document)
    if (req.method === 'POST' && !jobId) {
      const body = await req.json();
      const { job_type, priority, payload } = body;

      if (!job_type || !payload) {
        return new Response(
          JSON.stringify({ error: 'job_type and payload are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate job_type
      if (!['ocr_document', 'export_batch'].includes(job_type)) {
        return new Response(
          JSON.stringify({ error: 'Invalid job_type. Must be ocr_document or export_batch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's customer_id
      const { data: userCustomers } = await supabase
        .from('user_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .limit(1);

      const customerId = userCustomers?.[0]?.customer_id || null;

      // Check rate limits if customer exists
      if (customerId) {
        const { data: canProceed } = await supabase
          .rpc('check_tenant_rate_limit', { 
            _customer_id: customerId,
            _job_type: job_type
          });

        if (!canProceed) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          job_type,
          priority: priority || 'normal',
          payload,
          user_id: user.id,
          customer_id: customerId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-jobs/{id} - Cancel job (only if pending)
    if (req.method === 'DELETE' && jobId) {
      // Check if job is pending
      const { data: job } = await supabase
        .from('jobs')
        .select('status')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();

      if (!job) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (job.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Can only cancel pending jobs' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('jobs')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('id', jobId)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Job cancelled successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
