/**
 * Batches API Edge Function
 * 
 * RESTful API endpoint for managing document processing batches.
 * Provides CRUD operations with user authentication and authorization.
 * 
 * Supported Operations:
 * - GET /api-batches - List all batches for authenticated user (with filtering)
 * - GET /api-batches/{id} - Get specific batch with related documents
 * - POST /api-batches - Create new batch
 * - PUT /api-batches/{id} - Update existing batch
 * - DELETE /api-batches/{id} - Delete batch
 * 
 * Query Parameters (GET list):
 * - project_id: Filter by project
 * - status: Filter by batch status
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 * 
 * Security:
 * - Requires Bearer token authentication
 * - Users can only access their own batches (created_by = user.id)
 * - RLS policies enforced at database level
 * 
 * @route POST /api-batches
 * @body {batch_name: string, project_id: string, priority?: number, notes?: string, metadata?: object}
 * 
 * @route PUT /api-batches/{id}
 * @body {status?: string, priority?: number, notes?: string, metadata?: object}
 * 
 * @returns Batch object(s) with related project and profile information
 */


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// CORS headers to allow cross-origin requests from the frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract and validate authentication token from request header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication and get user object
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse URL to extract batch ID from path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const batchId = pathParts[pathParts.length - 1];

    // ==================== GET /api-batches - List batches ====================
    if (req.method === 'GET' && !batchId) {
      // Extract query parameters for filtering and pagination
      const projectId = url.searchParams.get('project_id');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Build query with filters - users can only see their own batches
      let query = supabase
        .from('batches')
        .select('*, projects(name), profiles!batches_created_by_fkey(full_name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply optional filters
      if (projectId) query = query.eq('project_id', projectId);
      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          batches: data,
          total: count,      // Total count for pagination
          limit,
          offset
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== GET /api-batches/{id} - Get specific batch with documents ====================
    if (req.method === 'GET' && batchId) {
      // Fetch batch details with related data
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('*, projects(name), profiles!batches_created_by_fkey(full_name)')
        .eq('id', batchId)
        .eq('created_by', user.id)  // Security: only return user's own batches
        .single();

      if (batchError) throw batchError;

      // Fetch all documents associated with this batch
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*, document_classes(name)')
        .eq('batch_id', batchId)
        .order('page_number');  // Sort by page number for logical ordering

      if (docsError) throw docsError;

      // Return batch with embedded documents array
      return new Response(
        JSON.stringify({ ...batch, documents }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== POST /api-batches - Create new batch ====================
    if (req.method === 'POST' && !batchId) {
      const body = await req.json();
      const { batch_name, project_id, priority, notes, metadata } = body;

      // Validate required fields
      if (!batch_name || !project_id) {
        return new Response(
          JSON.stringify({ error: 'batch_name and project_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert new batch with default values
      const { data, error } = await supabase
        .from('batches')
        .insert({
          batch_name,
          project_id,
          priority: priority || 5,       // Default priority
          notes: notes || null,
          metadata: metadata || {},      // Default empty metadata
          created_by: user.id,           // Associate with current user
          status: 'new'                  // Initial status
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== PUT /api-batches/{id} - Update batch ====================
    if (req.method === 'PUT' && batchId) {
      const body = await req.json();
      const { status, priority, notes, metadata } = body;

      // Build update object with only provided fields
      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (notes !== undefined) updateData.notes = notes;
      if (metadata) updateData.metadata = metadata;

      // Update batch - only if user owns it (created_by check)
      const { data, error } = await supabase
        .from('batches')
        .update(updateData)
        .eq('id', batchId)
        .eq('created_by', user.id)  // Security: can only update own batches
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== DELETE /api-batches/{id} - Delete batch ====================
    if (req.method === 'DELETE' && batchId) {
      // Delete batch - only if user owns it
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId)
        .eq('created_by', user.id);  // Security check

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Batch deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unsupported method
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
