import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const batchId = pathParts[pathParts.length - 1];

    // GET /api-batches - List batches
    if (req.method === 'GET' && !batchId) {
      const projectId = url.searchParams.get('project_id');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('batches')
        .select('*, projects(name), profiles!batches_created_by_fkey(full_name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (projectId) query = query.eq('project_id', projectId);
      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          batches: data,
          total: count,
          limit,
          offset
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-batches/{id} - Get specific batch with documents
    if (req.method === 'GET' && batchId) {
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('*, projects(name), profiles!batches_created_by_fkey(full_name)')
        .eq('id', batchId)
        .eq('created_by', user.id)
        .single();

      if (batchError) throw batchError;

      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*, document_classes(name)')
        .eq('batch_id', batchId)
        .order('page_number');

      if (docsError) throw docsError;

      return new Response(
        JSON.stringify({ ...batch, documents }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api-batches - Create new batch
    if (req.method === 'POST' && !batchId) {
      const body = await req.json();
      const { batch_name, project_id, priority, notes, metadata } = body;

      if (!batch_name || !project_id) {
        return new Response(
          JSON.stringify({ error: 'batch_name and project_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('batches')
        .insert({
          batch_name,
          project_id,
          priority: priority || 5,
          notes: notes || null,
          metadata: metadata || {},
          created_by: user.id,
          status: 'new'
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-batches/{id} - Update batch
    if (req.method === 'PUT' && batchId) {
      const body = await req.json();
      const { status, priority, notes, metadata } = body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (notes !== undefined) updateData.notes = notes;
      if (metadata) updateData.metadata = metadata;

      const { data, error } = await supabase
        .from('batches')
        .update(updateData)
        .eq('id', batchId)
        .eq('created_by', user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-batches/{id} - Delete batch
    if (req.method === 'DELETE' && batchId) {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId)
        .eq('created_by', user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Batch deleted successfully' }),
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
