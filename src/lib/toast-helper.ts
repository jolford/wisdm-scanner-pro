/**
 * Toast Helper - Context-aware toast notifications
 * Prevents unnecessary error toasts on auth/public pages
 */

import { useToast as useShadcnToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';

/**
 * Paths where error toasts should be suppressed for background operations
 */
const SUPPRESS_BACKGROUND_ERROR_PATHS = [
  '/auth',
  '/terms-of-service',
  '/privacy-policy',
  '/cookie-policy',
];

/**
 * Enhanced toast hook that's aware of current route context
 * Suppresses background operation errors on auth/public pages
 */
export const useContextualToast = () => {
  const { toast } = useShadcnToast();
  const location = useLocation();

  const contextualToast = (options: Parameters<typeof toast>[0]) => {
    // Check if we're on a page where background errors should be suppressed
    const shouldSuppress = SUPPRESS_BACKGROUND_ERROR_PATHS.some(path => 
      location.pathname.startsWith(path)
    );

    // If it's a destructive toast on a suppress path, check if it's a background error
    if (shouldSuppress && options.variant === 'destructive') {
      const description = String(options.description || '');
      const title = String(options.title || '');
      
      // List of error patterns that indicate background operations
      const backgroundErrorPatterns = [
        'Failed to send a request to the Edge Function',
        'Failed to load',
        'JWT',
        'auth',
        'unauthorized',
        'session',
      ];

      const isBackgroundError = backgroundErrorPatterns.some(pattern =>
        description.toLowerCase().includes(pattern.toLowerCase()) ||
        title.toLowerCase().includes(pattern.toLowerCase())
      );

      // Suppress background errors on auth pages
      if (isBackgroundError) {
        console.debug('Suppressed background error toast on auth page:', title, description);
        return;
      }
    }

    // Show the toast normally
    return toast(options);
  };

  return { toast: contextualToast };
};
