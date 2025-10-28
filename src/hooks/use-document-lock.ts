import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DocumentLock {
  id: string;
  document_id: string;
  locked_by: string;
  locked_at: string;
  expires_at: string;
  session_id: string;
}

interface LockedByUser {
  user_id: string;
  email: string;
  full_name: string;
}

export function useDocumentLock(documentId: string | null) {
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<LockedByUser | null>(null);
  const [hasLock, setHasLock] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  const acquireLock = useCallback(async () => {
    if (!documentId) return false;

    try {
      // Clean up expired locks first
      await supabase.rpc('cleanup_expired_locks');

      // Try to acquire lock
      const { data, error } = await supabase
        .from('document_locks')
        .insert({
          document_id: documentId,
          locked_by: (await supabase.auth.getUser()).data.user?.id,
          session_id: sessionId,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('This document is currently being edited by another user');
          return false;
        }
        throw error;
      }

      setHasLock(true);
      return true;
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }, [documentId, sessionId]);

  const releaseLock = useCallback(async () => {
    if (!documentId || !hasLock) return;

    try {
      await supabase
        .from('document_locks')
        .delete()
        .eq('document_id', documentId)
        .eq('session_id', sessionId);

      setHasLock(false);
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }, [documentId, hasLock, sessionId]);

  const renewLock = useCallback(async () => {
    if (!documentId || !hasLock) return;

    try {
      await supabase
        .from('document_locks')
        .update({
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .eq('document_id', documentId)
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error renewing lock:', error);
    }
  }, [documentId, hasLock, sessionId]);

  // Check lock status
  useEffect(() => {
    if (!documentId) return;

    const checkLock = async () => {
      const { data: locks } = await supabase
        .from('document_locks')
        .select('*, locked_by')
        .eq('document_id', documentId)
        .single();

      if (locks) {
        setIsLocked(true);
        setHasLock(locks.session_id === sessionId);

        // Get user info
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', locks.locked_by)
          .single();

        if (profile) {
          setLockedBy({
            user_id: profile.id,
            email: profile.email || '',
            full_name: profile.full_name || 'Unknown User',
          });
        }
      } else {
        setIsLocked(false);
        setLockedBy(null);
      }
    };

    checkLock();

    // Subscribe to lock changes
    const channel = supabase
      .channel(`document_lock:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_locks',
          filter: `document_id=eq.${documentId}`,
        },
        () => checkLock()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, sessionId]);

  // Renew lock every 5 minutes
  useEffect(() => {
    if (!hasLock) return;

    const interval = setInterval(renewLock, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hasLock, renewLock]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (hasLock) {
        releaseLock();
      }
    };
  }, [hasLock, releaseLock]);

  return {
    isLocked,
    lockedBy,
    hasLock,
    acquireLock,
    releaseLock,
  };
}
