/**
 * Security-safe error handling utility
 * Maps internal errors to safe user-facing messages
 */

export const safeErrorMessage = (error: unknown): string => {
  // Never expose internal error details to users
  // Log detailed errors server-side only
  
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message).toLowerCase();
    
    // Map specific error types to safe messages
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'You do not have permission to perform this action.';
    }
    
    if (message.includes('not found')) {
      return 'The requested resource was not found.';
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Invalid input. Please check your data and try again.';
    }
  }
  
  // Generic fallback - never expose stack traces or internals
  return 'An error occurred. Please try again later.';
};

/**
 * Log errors safely without exposing to users
 * In production, these should go to a monitoring service
 */
export const logError = (context: string, error: unknown): void => {
  // Only log in development
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
  // In production, send to monitoring service (e.g., Sentry)
};
