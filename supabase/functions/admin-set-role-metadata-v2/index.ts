/**
 * System admin-only: set role in user's JWT app_metadata (v2)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // System admin check
    let isSystemAdmin = user.app_metadata?.role === 'system_admin';
    if (!isSystemAdmin) {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'system_admin');
      if (roles && roles.length > 0) isSystemAdmin = true;
    }
    if (!isSystemAdmin) {
      return new Response(JSON.stringify({ error: 'System admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { targetUserId, role } = await req.json();
    if (!targetUserId || !role) {
      return new Response(JSON.stringify({ error: 'Missing targetUserId or role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validRoles = ['admin', 'system_admin', 'user'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetUserId === user.id && role !== 'system_admin') {
      return new Response(JSON.stringify({ error: 'Cannot remove your own system_admin privileges' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { app_metadata: { role } }
    );
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: dbError } = await supabaseAdmin.rpc('admin_assign_role', {
      target_user_id: targetUserId,
      new_role: role,
    });
    if (dbError) console.error('DB sync warning:', dbError);

    return new Response(JSON.stringify({
      success: true,
      message: `Role "${role}" set in JWT for user ${targetUserId}`,
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        app_metadata: updatedUser.user.app_metadata,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('admin-set-role-metadata-v2 error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});