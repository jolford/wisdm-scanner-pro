import { supabase } from '@/integrations/supabase/client';

export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

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
    // Remove UUIDs (potential user IDs in error messages)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]')
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

/**
 * Determine severity based on error type and context
 */
const determineSeverity = (error: Error, componentName?: string): ErrorSeverity => {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  // Critical: security and authentication failures
  if (message.includes('unauthorized') || message.includes('forbidden') || 
      message.includes('authentication') || componentName?.includes('Auth')) {
    return 'critical';
  }
  
  // Critical: database connection issues
  if (message.includes('database') || message.includes('connection refused') ||
      message.includes('timeout') || message.includes('network')) {
    return 'critical';
  }
  
  // Error: standard application errors
  if (name === 'error' || name === 'typeerror' || name === 'referenceerror') {
    return 'error';
  }
  
  // Warning: validation and user-facing issues
  if (message.includes('validation') || message.includes('invalid')) {
    return 'warning';
  }
  
  // Default to error
  return 'error';
};

export const logError = async (
  error: Error,
  componentName?: string,
  metadata?: Record<string, any>,
  overrideSeverity?: ErrorSeverity
) => {
  const severity = overrideSeverity || determineSeverity(error, componentName);
  
  // Always log to console for visibility with severity-appropriate method
  const consoleMethod = severity === 'critical' || severity === 'error' ? 'error' 
    : severity === 'warning' ? 'warn' 
    : 'log';
  console[consoleMethod](`[${severity.toUpperCase()}] [${componentName || 'Unknown'}]`, error, metadata);

  try {
    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // User not authenticated, userId stays null
    }
    
    const { error: insertError } = await supabase.from('error_logs').insert({
      user_id: userId,
      error_message: sanitizeErrorMessage(error.message),
      error_stack: error.stack?.substring(0, 2000) || null,
      component_name: componentName || null,
      user_agent: navigator.userAgent,
      url: sanitizeUrl(window.location.href),
      metadata: sanitizeMetadata(metadata),
      severity: severity,
      alert_sent: false
    });

    if (insertError) {
      console.error('Failed to insert error log:', insertError);
      if (import.meta.env.DEV) {
        console.warn('⚠️ Error logging to database failed. Check RLS policies.');
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('✓ Error logged to database:', error.message);
      }
    }
  } catch (loggingError) {
    console.error('❌ Failed to log error to database:', loggingError);
    if (import.meta.env.DEV) {
      console.warn('Error logging is not working. Check database connection and RLS policies.');
    }
  }
};

/**
 * Log with specific severity levels - convenience wrappers
 */
export const logDebug = (message: string, componentName?: string, metadata?: Record<string, any>) => 
  logError(new Error(message), componentName, metadata, 'debug');

export const logInfo = (message: string, componentName?: string, metadata?: Record<string, any>) => 
  logError(new Error(message), componentName, metadata, 'info');

export const logWarning = (message: string, componentName?: string, metadata?: Record<string, any>) => 
  logError(new Error(message), componentName, metadata, 'warning');

export const logCritical = (error: Error, componentName?: string, metadata?: Record<string, any>) => 
  logError(error, componentName, metadata, 'critical');

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