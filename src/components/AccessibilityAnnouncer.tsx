import { useEffect, useRef } from 'react';

interface AccessibilityAnnouncerProps {
  message: string;
  priority?: 'polite' | 'assertive';
}

export function AccessibilityAnnouncer({ message, priority = 'polite' }: AccessibilityAnnouncerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && message) {
      ref.current.textContent = message;
    }
  }, [message]);

  return (
    <div
      ref={ref}
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    />
  );
}
