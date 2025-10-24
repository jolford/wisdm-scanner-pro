/**
 * Edge Function Helper - Safe edge function invocations with auth checks
 * Prevents unnecessary calls when user is not authenticated
 */

import { supabase } from '@/integrations/supabase/client';

interface EdgeFunctionOptions {
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Safely invoke an edge function with automatic auth checking
 * Returns null if user is not authenticated (instead of throwing errors)
 */
export const safeInvokeEdgeFunction = async <T = any>(
  functionName: string,
  options?: EdgeFunctionOptions
): Promise<{ data: T | null; error: any | null }> => {
  try {
    // Check if user is authenticated first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.debug(`Skipped ${functionName} - user not authenticated`);
      return { data: null, error: { message: 'Not authenticated' } };
    }

    // User is authenticated, proceed with the call
    const result = await supabase.functions.invoke<T>(functionName, options);
    return result;
  } catch (error: any) {
    console.error(`Edge function ${functionName} error:`, error);
    return { data: null, error };
  }
};

/**
 * Check if the current user is authenticated
 * Useful for conditional logic before edge function calls
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && !!user;
  } catch {
    return false;
  }
};

/**
 * Execute a callback only if user is authenticated
 * Useful for polling/interval operations
 */
export const withAuthCheck = async <T>(
  callback: () => Promise<T>
): Promise<T | null> => {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    console.debug('Skipped operation - user not authenticated');
    return null;
  }
  return callback();
};
