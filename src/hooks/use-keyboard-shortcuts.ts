import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
  handler: () => void;
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts?: KeyboardShortcut[];
}

export function useKeyboardShortcuts({ 
  enabled = true, 
  shortcuts = [] 
}: UseKeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape to unfocus
      if (event.key === 'Escape') {
        target.blur();
      }
      return;
    }

    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatches = shortcut.modifiers?.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatches = shortcut.modifiers?.shift ? event.shiftKey : !event.shiftKey;
      const altMatches = shortcut.modifiers?.alt ? event.altKey : !event.altKey;

      return keyMatches && ctrlMatches && shiftMatches && altMatches;
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.handler();
    }
  }, [enabled, shortcuts]);

  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [enabled, handleKeyPress]);

  return { navigate };
}

// Predefined global shortcuts
export const GLOBAL_SHORTCUTS = {
  HELP: { key: '?', description: 'Show keyboard shortcuts', category: 'General' },
  SEARCH: { key: '/', description: 'Focus search', category: 'General' },
  THEME: { key: 't', modifiers: { ctrl: true }, description: 'Toggle theme', category: 'General' },
  
  GO_BATCHES: { key: 'b', modifiers: { shift: true }, description: 'Go to Batches', category: 'Navigation' },
  GO_QUEUE: { key: 'q', modifiers: { shift: true }, description: 'Go to Queue', category: 'Navigation' },
  GO_ADMIN: { key: 'a', modifiers: { shift: true }, description: 'Go to Admin', category: 'Navigation' },
  GO_HOME: { key: 'h', modifiers: { shift: true }, description: 'Go to Home', category: 'Navigation' },
  
  NEW: { key: 'n', description: 'New item (context dependent)', category: 'Actions' },
  SAVE: { key: 's', modifiers: { ctrl: true }, description: 'Save (context dependent)', category: 'Actions' },
  ESCAPE: { key: 'Escape', description: 'Close dialog/unfocus', category: 'Actions' },
};
