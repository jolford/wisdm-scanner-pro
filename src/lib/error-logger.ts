import { supabase } from '@/integrations/supabase/client';

/**
 * Sanitize error messages to remove PII and sensitive data
 */
const sanitizeErrorMessage = (message: string): string => {
  return message
    // Remove email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
    // Remove SSNs
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]')
    // Remove credit card numbers
    .replace(/\b\d{16}\b/g, '[card]')
    // Remove phone numbers
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')
    // Limit length
    .substring(0, 500);
};

/**
 * Strip query parameters from URLs to prevent token leakage
 */
const sanitizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return '[invalid-url]';
  }
};

/**
 * Sanitize metadata to prevent large payloads
 */
const sanitizeMetadata = (metadata?: Record<string, any>): Record<string, any> => {
  if (!metadata) return {};
  
  const jsonStr = JSON.stringify(metadata);
  if (jsonStr.length > 5000) {
    return { note: 'Metadata truncated - exceeded size limit' };
  }
  
  return metadata;
};

export const logError = async (
  error: Error,
  componentName?: string,
  metadata?: Record<string, any>
) => {
  // Always log to console for visibility
  console.error(`[${componentName || 'Unknown'}]`, error, metadata);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: insertError } = await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      error_message: sanitizeErrorMessage(error.message),
      error_stack: error.stack?.substring(0, 2000) || null, // Keep stack traces but limit size
      component_name: componentName,
      user_agent: navigator.userAgent,
      url: sanitizeUrl(window.location.href),
      metadata: sanitizeMetadata(metadata)
    });

    if (insertError) {
      console.error('Failed to insert error log:', insertError);
      // Show user-visible warning in dev
      if (import.meta.env.DEV) {
        console.warn('⚠️ Error logging to database failed. Check RLS policies.');
      }
    } else {
      // Confirm successful logging in dev
      if (import.meta.env.DEV) {
        console.log('✓ Error logged to database:', error.message);
      }
    }
  } catch (loggingError) {
    // More visible logging failure
    console.error('❌ Failed to log error to database:', loggingError);
    if (import.meta.env.DEV) {
      console.warn('Error logging is not working. Check database connection and RLS policies.');
    }
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