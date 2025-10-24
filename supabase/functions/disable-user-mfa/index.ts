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

    console.log('Disabling MFA for user:', email);

    // Get user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const user = users.find(u => u.email === email);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found user:', user.id, 'with factors:', user.factors);

    // Delete all MFA factors for the user
    const deletedFactors = [];
    if (user.factors && user.factors.length > 0) {
      for (const factor of user.factors) {
        console.log('Deleting factor:', factor.id);
        
        // Use the admin API to delete the factor
        const deleteUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users/${user.id}/factors/${factor.id}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          }
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error(`Failed to delete factor ${factor.id}:`, errorText);
          throw new Error(`Failed to delete factor: ${errorText}`);
        }

        deletedFactors.push(factor.id);
        console.log('Successfully deleted factor:', factor.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `MFA disabled for ${email}`,
        userId: user.id,
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
