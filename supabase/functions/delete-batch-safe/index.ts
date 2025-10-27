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
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    // Service role client for privileged deletes (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceKey);

    // Ensure the requester can access the batch
    const { data: batch, error: fetchErr } = await supabase
      .from('batches')
      .select('id, created_by, project_id')
      .eq('id', batchId)
      .maybeSingle();

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!batch) {
      return new Response(JSON.stringify({ error: 'Batch not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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
