/**
 * Reusable authentication and authorization helpers for Edge Functions
 * 
 * SECURITY: Always use these helpers instead of trusting client-side claims
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

export interface AuthResult {
  user: any;
  isAdmin: boolean;
  isSystemAdmin: boolean;
}

/**
 * Verifies the request has valid authentication and checks admin status
 * 
 * @param req - The incoming request with Authorization header
 * @param requireAdmin - If true, returns 403 if user is not admin
 * @param requireSystemAdmin - If true, returns 403 if user is not system admin
 * @returns Auth result or Response with error
 */
export async function verifyAuth(
  req: Request,
  options: {
    requireAdmin?: boolean;
    requireSystemAdmin?: boolean;
  } = {}
): Promise<AuthResult | Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Get auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create admin client for auth verification
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Verify user
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check admin status from multiple sources (JWT + database)
  let isAdmin = false;
  let isSystemAdmin = false;

  // Method 1: Check JWT app_metadata (preferred - no DB lookup)
  if (user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'system_admin') {
    isAdmin = true;
    isSystemAdmin = user.app_metadata?.role === 'system_admin';
  }

  // Method 2: Fallback to database check if JWT doesn't have role
  if (!isAdmin) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'system_admin']);

    if (roles && roles.length > 0) {
      isAdmin = true;
      isSystemAdmin = roles.some(r => r.role === 'system_admin');
    }
  }

  // Enforce requirements
  if (options.requireSystemAdmin && !isSystemAdmin) {
    return new Response(
      JSON.stringify({ error: 'System admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (options.requireAdmin && !isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { user, isAdmin, isSystemAdmin };
}

/**
 * Standard CORS headers for all edge functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
