import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type TableName = keyof Database['public']['Tables'];

interface PendingAction {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: TableName;
  data: any;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = 'wisdm_pending_actions';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

/**
 * Background sync hook for offline-first capabilities
 * Queues actions when offline and syncs when connection is restored
 */
export function useBackgroundSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Load pending actions from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPendingActions(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load pending actions:', e);
      }
    }
  }, []);

  // Save pending actions to storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back Online',
        description: 'Syncing pending changes...',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You\'re Offline',
        description: 'Changes will sync when connection is restored.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Sync pending actions when back online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0 && !isSyncing) {
      syncPendingActions();
    }
  }, [isOnline, pendingActions.length]);

  const syncPendingActions = useCallback(async () => {
    if (isSyncing || pendingActions.length === 0) return;

    setIsSyncing(true);
    const actionsToSync = [...pendingActions];
    const failedActions: PendingAction[] = [];

    for (const action of actionsToSync) {
      try {
        let result;
        
        switch (action.type) {
          case 'insert':
            // Use type-safe insert with any to bypass strict typing for dynamic tables
            result = await (supabase.from(action.table) as any).insert(action.data);
            break;
          case 'update':
            result = await (supabase.from(action.table) as any)
              .update(action.data.updates)
              .eq('id', action.data.id);
            break;
          case 'delete':
            result = await (supabase.from(action.table) as any)
              .delete()
              .eq('id', action.data.id);
            break;
          default:
            console.warn('Unknown action type:', action.type);
            continue;
        }

        if (result.error) throw result.error;
      } catch (error) {
        console.error('Sync failed for action:', action, error);
        
        if (action.retryCount < MAX_RETRIES) {
          failedActions.push({
            ...action,
            retryCount: action.retryCount + 1,
          });
        } else {
          toast({
            title: 'Sync Failed',
            description: `Failed to sync ${action.type} after ${MAX_RETRIES} attempts.`,
            variant: 'destructive',
          });
        }
      }
    }

    setPendingActions(failedActions);
    setIsSyncing(false);

    // Retry failed actions after delay
    if (failedActions.length > 0) {
      syncTimeoutRef.current = setTimeout(syncPendingActions, RETRY_DELAY);
    } else if (actionsToSync.length > 0) {
      toast({
        title: 'Sync Complete',
        description: `Successfully synced ${actionsToSync.length} pending changes.`,
      });
    }
  }, [isSyncing, pendingActions, toast]);

  const queueAction = useCallback((
    type: 'insert' | 'update' | 'delete',
    table: TableName,
    data: any
  ) => {
    const action: PendingAction = {
      id: crypto.randomUUID(),
      type,
      table,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    setPendingActions((prev) => [...prev, action]);

    if (isOnline) {
      // Immediate sync if online
      syncPendingActions();
    }

    return action.id;
  }, [isOnline, syncPendingActions]);

  const clearPendingActions = useCallback(() => {
    setPendingActions([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingActions,
    pendingCount: pendingActions.length,
    queueAction,
    syncPendingActions,
    clearPendingActions,
  };
}
