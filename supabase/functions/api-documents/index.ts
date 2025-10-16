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
    const documentId = pathParts[pathParts.length - 1];

    // GET /api-documents - List documents with filters
    if (req.method === 'GET' && !documentId) {
      const projectId = url.searchParams.get('project_id');
      const batchId = url.searchParams.get('batch_id');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('documents')
        .select('*, projects(name), batches(batch_name), document_classes(name)')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (projectId) query = query.eq('project_id', projectId);
      if (batchId) query = query.eq('batch_id', batchId);
      if (status) query = query.eq('validation_status', status);

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          documents: data,
          total: count,
          limit,
          offset
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-documents/{id} - Get specific document
    if (req.method === 'GET' && documentId) {
      const { data, error } = await supabase
        .from('documents')
        .select('*, projects(name), batches(batch_name), document_classes(name)')
        .eq('id', documentId)
        .eq('uploaded_by', user.id)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api-documents/{id} - Update document
    if (req.method === 'PUT' && documentId) {
      const body = await req.json();
      const { validation_status, validation_notes, extracted_metadata, document_class_id } = body;

      const updateData: any = {};
      if (validation_status) updateData.validation_status = validation_status;
      if (validation_notes !== undefined) updateData.validation_notes = validation_notes;
      if (extracted_metadata) updateData.extracted_metadata = extracted_metadata;
      if (document_class_id) updateData.document_class_id = document_class_id;

      if (validation_status === 'validated') {
        updateData.validated_at = new Date().toISOString();
        updateData.validated_by = user.id;
      }

      const { data, error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId)
        .eq('uploaded_by', user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-documents/{id} - Delete document
    if (req.method === 'DELETE' && documentId) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('uploaded_by', user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Document deleted successfully' }),
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
