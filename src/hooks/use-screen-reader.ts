import { useState, useEffect, useRef, useCallback } from 'react';

interface UseScreenReaderOptions {
  politeLevel?: 'polite' | 'assertive';
  debounceMs?: number;
}

export function useScreenReader(options: UseScreenReaderOptions = {}) {
  const { politeLevel = 'polite', debounceMs = 100 } = options;
  const [announcement, setAnnouncement] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Announce to screen readers
  const announce = useCallback((message: string, level?: 'polite' | 'assertive') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear first to ensure re-announcement of same message
    setAnnouncement('');

    timeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
    }, debounceMs);
  }, [debounceMs]);

  // Announce loading state
  const announceLoading = useCallback((itemDescription?: string) => {
    announce(`Loading${itemDescription ? ` ${itemDescription}` : ''}...`);
  }, [announce]);

  // Announce completion
  const announceComplete = useCallback((message?: string) => {
    announce(message || 'Action completed');
  }, [announce]);

  // Announce error
  const announceError = useCallback((error?: string) => {
    announce(error || 'An error occurred', 'assertive');
  }, [announce]);

  // Announce navigation
  const announceNavigation = useCallback((destination: string) => {
    announce(`Navigated to ${destination}`);
  }, [announce]);

  // Announce form validation
  const announceValidation = useCallback((fieldName: string, error?: string) => {
    if (error) {
      announce(`${fieldName}: ${error}`, 'assertive');
    } else {
      announce(`${fieldName} is valid`);
    }
  }, [announce]);

  // Announce list count
  const announceListCount = useCallback((count: number, itemType: string) => {
    announce(`${count} ${itemType}${count !== 1 ? 's' : ''} found`);
  }, [announce]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    announce,
    announceLoading,
    announceComplete,
    announceError,
    announceNavigation,
    announceValidation,
    announceListCount,
    announcement,
    politeLevel
  };
}

// Focus management utilities
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef]);
}

// Announce dynamic content changes
export function useAnnounceChanges<T>(
  data: T,
  getMessage: (data: T) => string | null
) {
  const { announce } = useScreenReader();
  const prevDataRef = useRef<T>();

  useEffect(() => {
    if (prevDataRef.current !== undefined && prevDataRef.current !== data) {
      const message = getMessage(data);
      if (message) {
        announce(message);
      }
    }
    prevDataRef.current = data;
  }, [data, getMessage, announce]);
}
