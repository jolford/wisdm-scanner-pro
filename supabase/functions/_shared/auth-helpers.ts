/**
 * Reusable authentication and authorization helpers for Edge Functions
 * 
 * SECURITY: Always use these helpers instead of trusting client-side claims
 * 
 * Features:
 * - JWT and database-based role verification
 * - Customer/tenant access validation
 * - Permission checking
 * - Request logging and timing
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

export interface AuthResult {
  user: any;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  customerId?: string;
  supabase: SupabaseClient;
}

export interface RequestContext {
  startTime: number;
  requestId: string;
  path: string;
  method: string;
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

  return { user, isAdmin, isSystemAdmin, supabase };
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

/**
 * Check if user has access to a specific customer/tenant
 */
export async function checkCustomerAccess(
  supabase: SupabaseClient,
  userId: string,
  customerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_customers')
    .select('id')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return false;
  }
  return true;
}

/**
 * Get all customer IDs a user has access to
 */
export async function getUserCustomers(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_customers')
    .select('customer_id')
    .eq('user_id', userId);
  
  if (error || !data) {
    return [];
  }
  return data.map(d => d.customer_id);
}

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  supabase: SupabaseClient,
  userId: string,
  permission: 'can_scan' | 'can_validate' | 'can_export'
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('can_scan, can_validate, can_export')
    .eq('user_id', userId)
    .limit(1)
    .single();
  
  if (error || !data) {
    // Default to true if no permissions record exists
    return true;
  }
  const permData = data as { can_scan: boolean; can_validate: boolean; can_export: boolean };
  return permData[permission] === true;
}

/**
 * Create a request context for logging and timing
 */
export function createRequestContext(req: Request): RequestContext {
  const url = new URL(req.url);
  return {
    startTime: Date.now(),
    requestId: crypto.randomUUID(),
    path: url.pathname,
    method: req.method,
  };
}

/**
 * Log request completion with timing
 */
export function logRequestComplete(
  context: RequestContext,
  status: number,
  details?: Record<string, unknown>
): void {
  const duration = Date.now() - context.startTime;
  console.log(JSON.stringify({
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    status,
    durationMs: duration,
    ...details,
  }));
}

/**
 * Create a standardized JSON error response
 */
export function errorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({ 
      error: message, 
      ...details,
      timestamp: new Date().toISOString() 
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Create a standardized JSON success response
 */
export function successResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({ 
      success: true, 
      data,
      timestamp: new Date().toISOString() 
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Parse and validate request body with error handling
 */
export async function parseRequestBody<T>(
  req: Request,
  validator?: (body: unknown) => body is T
): Promise<T | null> {
  try {
    const body = await req.json();
    if (validator && !validator(body)) {
      return null;
    }
    return body as T;
  } catch {
    return null;
  }
}
