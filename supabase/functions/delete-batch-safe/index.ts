// Secure batch deletion function
// Deletes related scanner/email import logs and documents, then the batch itself
// Uses CORS and verifies requester can access the batch before using service role for deletion

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchId } = await req.json().catch(() => ({ batchId: null }));
    if (!batchId) {
      return new Response(JSON.stringify({ error: 'batchId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticated client with end-user JWT to verify access
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    // Service role client for privileged deletes (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceKey);

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Use service role to fetch batch and verify user access
    const { data: batch, error: fetchErr } = await admin
      .from('batches')
      .select('id, created_by, project_id, customer_id')
      .eq('id', batchId)
      .maybeSingle();

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!batch) {
      return new Response(JSON.stringify({ error: 'Batch not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if user has permission (is creator or admin)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Permission check:', {
      userId: user.id,
      batchId,
      batchCreatedBy: batch.created_by,
      batchCustomerId: batch.customer_id,
      profileExists: !!profile,
      profileRole: profile?.role,
      profileCustomerId: profile?.customer_id,
      profileError: profileError?.message
    });

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    const isOwner = batch.created_by === user.id;
    const sameCustomer = profile?.customer_id && profile.customer_id === batch.customer_id;

    // Allow if user is owner, admin, or same customer
    // Also allow if no profile exists but user is the creator
    const hasPermission = isOwner || isAdmin || sameCustomer;

    if (!hasPermission) {
      console.error('Access denied:', {
        isOwner,
        isAdmin,
        sameCustomer,
        hasProfile: !!profile
      });
      return new Response(JSON.stringify({ 
        error: 'Access denied',
        debug: {
          isOwner,
          isAdmin,
          sameCustomer,
          hasProfile: !!profile
        }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('Permission granted:', { isOwner, isAdmin, sameCustomer });

    // Perform deletions in safe order using service role
    // Related scanner/email import logs and documents
    const { error: logsErr1 } = await admin
      .from('scanner_import_logs')
      .delete()
      .eq('batch_id', batchId);
    if (logsErr1) {
      return new Response(JSON.stringify({ error: logsErr1.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { error: logsErr2 } = await admin
      .from('email_import_logs')
      .delete()
      .eq('batch_id', batchId);
    if (logsErr2) {
      return new Response(JSON.stringify({ error: logsErr2.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { error: docsErr } = await admin
      .from('documents')
      .delete()
      .eq('batch_id', batchId);
    if (docsErr) {
      return new Response(JSON.stringify({ error: docsErr.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Finally delete the batch
    const { error: batchDelErr } = await admin.from('batches').delete().eq('id', batchId);
    if (batchDelErr) {
      return new Response(JSON.stringify({ error: batchDelErr.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    const err = e as any;
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
