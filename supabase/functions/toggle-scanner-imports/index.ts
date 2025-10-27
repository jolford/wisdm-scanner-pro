// Toggle Scanner Imports - pause/resume all hot-folder configs
// CORS + Admin check + service-role update

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';

    // User-scoped client (for admin check via RLS)
    const supabase = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for privileged updates
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is admin
    const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin_enhanced');
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { active } = await req.json();
    if (typeof active !== 'boolean') {
      return new Response(JSON.stringify({ error: 'invalid body; expected { active: boolean }' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Pause/resume all scanner import configs
    const { error: updErr } = await admin
      .from('scanner_import_configs')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .not('id', 'is', null);

    if (updErr) {
      console.error('Update scanner_import_configs failed', updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Optionally also pause email imports to be safe (no-op if none)
    const { error: updEmailErr } = await admin
      .from('email_import_configs')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .not('id', 'is', null);
    if (updEmailErr) {
      console.error('Update email_import_configs failed', updEmailErr);
    }

    return new Response(
      JSON.stringify({ success: true, active }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('toggle-scanner-imports error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
