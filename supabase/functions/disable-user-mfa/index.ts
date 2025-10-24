import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email (iterate through pages if needed)
    let targetUser: any = null;
    let page = 1;
    while (!targetUser) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = data.users.find((u: any) => u.email === email);
      if (targetUser || data.users.length < 1000) break;
      page += 1;
    }

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch full user (includes factors) via Admin API
    const adminUserRes = await supabaseAdmin.auth.admin.getUserById(targetUser.id);
    if (adminUserRes.error) throw adminUserRes.error;
    let factors: any[] = (adminUserRes.data?.user as any)?.factors ?? [];

    // Fallback to direct admin HTTP call if factors missing
    if (!factors || factors.length === 0) {
      const userUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users/${targetUser.id}`;
      const userResp = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        }
      });
      if (userResp.ok) {
        const userJson = await userResp.json();
        factors = userJson?.factors ?? [];
      }
    }

    const deletedFactors: string[] = [];
    for (const factor of factors) {
      const deleteUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users/${targetUser.id}/factors/${factor.id}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        }
      });
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete factor ${factor.id}: ${errorText}`);
      }
      deletedFactors.push(factor.id);
    }

    // Best effort: revoke all refresh tokens if available via HTTP admin endpoint
    try {
      const revokeUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users/${targetUser.id}/logout`; // revokes all refresh tokens
      await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        }
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        message: `MFA disabled for ${email}`,
        userId: targetUser.id,
        deletedFactors,
        factorCount: deletedFactors.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error disabling MFA:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to disable MFA'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
