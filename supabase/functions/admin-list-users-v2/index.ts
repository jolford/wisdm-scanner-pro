/**
 * Admin-only edge function to list all users with their roles (v2)
 * Inline auth verification to avoid shared import issues
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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

    // Admin check: JWT then DB
    let isAdmin = false;
    if (user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'system_admin') {
      isAdmin = true;
    } else {
      const { data: roles } = await supabaseAdmin.from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'system_admin']);
      if (roles && roles.length > 0) isAdmin = true;
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch users
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) {
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: dbRoles } = await supabaseAdmin.from('user_roles').select('user_id, role');
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name, email');

    const enrichedUsers = users.map(u => {
      const profile = profiles?.find(p => p.id === u.id);
      const userDbRoles = dbRoles?.filter(r => r.user_id === u.id).map(r => r.role) || [];
      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        jwt_role: u.app_metadata?.role || null,
        database_roles: userDbRoles,
        is_admin: u.app_metadata?.role === 'admin' || u.app_metadata?.role === 'system_admin' || userDbRoles.includes('admin') || userDbRoles.includes('system_admin'),
        is_system_admin: u.app_metadata?.role === 'system_admin' || userDbRoles.includes('system_admin'),
      };
    });

    return new Response(JSON.stringify({
      users: enrichedUsers,
      total: enrichedUsers.length,
      admins: enrichedUsers.filter(u => u.is_admin).length,
      system_admins: enrichedUsers.filter(u => u.is_system_admin).length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('admin-list-users-v2 error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});