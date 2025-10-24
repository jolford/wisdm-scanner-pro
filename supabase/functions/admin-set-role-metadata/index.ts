/**
 * Admin-only edge function to set admin role in user's JWT app_metadata
 * This enables JWT-based authorization checks
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { verifyAuth, handleCors, corsHeaders } from '../_shared/auth-helpers.ts';

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller is system admin
    const authResult = await verifyAuth(req, { requireSystemAdmin: true });
    if (authResult instanceof Response) return authResult;

    const { user } = authResult;

    // Parse request body
    const { targetUserId, role } = await req.json();

    if (!targetUserId || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing targetUserId or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['admin', 'system_admin', 'user'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent removing own system_admin role
    if (targetUserId === user.id && role !== 'system_admin') {
      return new Response(
        JSON.stringify({ error: 'Cannot remove your own system_admin privileges' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for user updates
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update user's app_metadata with role
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      {
        app_metadata: { role }
      }
    );

    if (updateError) {
      console.error('Error updating user metadata:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also sync to database table for backwards compatibility
    const { error: dbError } = await supabaseAdmin.rpc('admin_assign_role', {
      target_user_id: targetUserId,
      new_role: role
    });

    if (dbError) {
      console.error('Error syncing to database:', dbError);
      // Non-fatal - JWT metadata is primary, database is backup
    }

    console.log(`System admin ${user.id} set role "${role}" for user ${targetUserId} in JWT app_metadata`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Role "${role}" set in JWT for user ${targetUserId}`,
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          app_metadata: updatedUser.user.app_metadata
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-set-role-metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
