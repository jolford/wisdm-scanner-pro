import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OfflineAction {
  id: string;
  type: 'update_metadata' | 'validate_document' | 'add_comment' | 'update_status';
  documentId: string;
  payload: Record<string, any>;
  timestamp: Date;
  retryCount: number;
}

interface UseOfflineModeOptions {
  maxRetries?: number;
  syncInterval?: number;
}

export function useOfflineMode(options: UseOfflineModeOptions = {}) {
  const { maxRetries = 3, syncInterval = 30000 } = options;
  const { toast } = useToast();
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Load pending actions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('offline_pending_actions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPendingActions(parsed.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        })));
      } catch (e) {
        console.error('Failed to parse offline actions:', e);
      }
    }
  }, []);

  // Save pending actions to localStorage
  useEffect(() => {
    localStorage.setItem('offline_pending_actions', JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back Online',
        description: pendingActions.length > 0 
          ? `Syncing ${pendingActions.length} pending changes...`
          : 'Connection restored',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You\'re Offline',
        description: 'Changes will be saved locally and synced when you\'re back online.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingActions.length, toast]);

  // Queue an action for offline sync
  const queueAction = useCallback((
    type: OfflineAction['type'],
    documentId: string,
    payload: Record<string, any>
  ) => {
    const action: OfflineAction = {
      id: crypto.randomUUID(),
      type,
      documentId,
      payload,
      timestamp: new Date(),
      retryCount: 0
    };

    setPendingActions(prev => [...prev, action]);
    
    if (!isOnline) {
      toast({
        title: 'Saved Offline',
        description: 'Your change will sync when you\'re back online.',
      });
    }

    return action.id;
  }, [isOnline, toast]);

  // Process a single action
  const processAction = async (action: OfflineAction): Promise<boolean> => {
    try {
      switch (action.type) {
        case 'update_metadata': {
          const { error } = await supabase
            .from('documents')
            .update({ extracted_metadata: action.payload.metadata })
            .eq('id', action.documentId);
          if (error) throw error;
          break;
        }
        case 'validate_document': {
          const { error } = await supabase
            .from('documents')
            .update({
              validation_status: action.payload.status,
              validated_at: new Date().toISOString()
            })
            .eq('id', action.documentId);
          if (error) throw error;
          break;
        }
        case 'add_comment': {
          const { error } = await supabase
            .from('document_comments')
            .insert({
              document_id: action.documentId,
              comment: action.payload.comment,
              user_id: action.payload.userId
            });
          if (error) throw error;
          break;
        }
        case 'update_status': {
          const { error } = await supabase
            .from('documents')
            .update({ validation_status: action.payload.status })
            .eq('id', action.documentId);
          if (error) throw error;
          break;
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to process action:', action.id, error);
      return false;
    }
  };

  // Sync all pending actions
  const syncPendingActions = useCallback(async () => {
    if (!isOnline || pendingActions.length === 0 || isSyncing) return;

    setIsSyncing(true);
    let successCount = 0;
    const failedActions: OfflineAction[] = [];

    for (const action of pendingActions) {
      const success = await processAction(action);
      
      if (success) {
        successCount++;
      } else {
        if (action.retryCount < maxRetries) {
          failedActions.push({
            ...action,
            retryCount: action.retryCount + 1
          });
        }
      }
    }

    setPendingActions(failedActions);
    setLastSyncAt(new Date());
    setIsSyncing(false);

    if (successCount > 0) {
      toast({
        title: 'Sync Complete',
        description: `${successCount} changes synced successfully.`,
      });
    }

    if (failedActions.length > 0) {
      toast({
        title: 'Sync Incomplete',
        description: `${failedActions.length} changes failed to sync and will be retried.`,
        variant: 'destructive',
      });
    }
  }, [isOnline, pendingActions, isSyncing, maxRetries, toast]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      const timeout = setTimeout(syncPendingActions, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, syncPendingActions, pendingActions.length]);

  // Periodic sync
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      if (pendingActions.length > 0) {
        syncPendingActions();
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [isOnline, syncInterval, syncPendingActions, pendingActions.length]);

  // Clear all pending actions
  const clearPendingActions = useCallback(() => {
    setPendingActions([]);
    localStorage.removeItem('offline_pending_actions');
  }, []);

  // Remove a specific action
  const removeAction = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  return {
    isOnline,
    pendingActions,
    pendingCount: pendingActions.length,
    isSyncing,
    lastSyncAt,
    queueAction,
    syncPendingActions,
    clearPendingActions,
    removeAction
  };
}
