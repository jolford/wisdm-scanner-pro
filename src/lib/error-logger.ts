import { supabase } from '@/integrations/supabase/client';

export const logError = async (
  error: Error,
  componentName?: string,
  metadata?: Record<string, any>
) => {
  // Always log to console in development
  if (import.meta.env.DEV) {
    console.error(`[${componentName || 'Unknown'}]`, error, metadata);
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: insertError } = await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      error_message: error.message,
      error_stack: error.stack,
      component_name: componentName,
      user_agent: navigator.userAgent,
      url: window.location.href,
      metadata: metadata || {}
    });

    if (insertError) {
      console.error('Failed to insert error log:', insertError);
    }
  } catch (loggingError) {
    // Silently fail - don't want error logging to break the app
    console.error('Failed to log error to database:', loggingError);
  }
};

// Global error handler for uncaught errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logError(
      new Error(event.message),
      'GlobalErrorHandler',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      'UnhandledPromiseRejection',
      {
        promise: 'Promise rejection',
      }
    );
  });
}