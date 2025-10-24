/**
 * Admin-only edge function to list all users with their roles
 * Shows both JWT app_metadata roles and database roles
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { verifyAuth, handleCors, corsHeaders } from '../_shared/auth-helpers.ts';

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller is admin
    const authResult = await verifyAuth(req, { requireAdmin: true });
    if (authResult instanceof Response) return authResult;

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users from auth
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      return new Response(
        JSON.stringify({ error: usersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get database roles for all users
    const { data: dbRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');

    // Get profiles for all users
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email');

    // Combine data
    const enrichedUsers = users.map(user => {
      const profile = profiles?.find(p => p.id === user.id);
      const userDbRoles = dbRoles?.filter(r => r.user_id === user.id).map(r => r.role) || [];
      
      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        jwt_role: user.app_metadata?.role || null,
        database_roles: userDbRoles,
        is_admin: user.app_metadata?.role === 'admin' || 
                  user.app_metadata?.role === 'system_admin' || 
                  userDbRoles.includes('admin') || 
                  userDbRoles.includes('system_admin'),
        is_system_admin: user.app_metadata?.role === 'system_admin' || 
                         userDbRoles.includes('system_admin')
      };
    });

    return new Response(
      JSON.stringify({
        users: enrichedUsers,
        total: enrichedUsers.length,
        admins: enrichedUsers.filter(u => u.is_admin).length,
        system_admins: enrichedUsers.filter(u => u.is_system_admin).length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-list-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
