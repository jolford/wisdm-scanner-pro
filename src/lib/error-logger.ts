import { supabase } from '@/integrations/supabase/client';

export const logError = async (
  error: Error,
  componentName?: string,
  metadata?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      error_message: error.message,
      error_stack: error.stack,
      component_name: componentName,
      user_agent: navigator.userAgent,
      url: window.location.href,
      metadata: metadata || {}
    });
  } catch (loggingError) {
    // Silently fail - don't want error logging to break the app
    console.error('Failed to log error:', loggingError);
  }
};