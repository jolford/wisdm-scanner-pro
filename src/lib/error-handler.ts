/**
 * Security-safe error handling utility
 * Maps internal errors to safe user-facing messages
 */

import { logError as logErrorToDb } from './error-logger';

export const safeErrorMessage = (error: unknown): string => {
  // Log error to database for admin review
  if (error instanceof Error) {
    logErrorToDb(error, 'ErrorHandler');
  } else if (typeof error === 'string') {
    logErrorToDb(new Error(error), 'ErrorHandler');
  }

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
  // Also log to database for admin tracking
  if (error instanceof Error) {
    logErrorToDb(error, context);
  }
};