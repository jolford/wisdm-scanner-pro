import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface DocumentWithMetadata {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  confidence_score: number | null;
  extracted_metadata: Record<string, any> | null;
  validation_status: string | null;
  created_at: string;
  batch_id: string | null;
  project_id: string;
}

interface UseOptimizedDocumentsOptions {
  batchId?: string;
  projectId?: string;
  validationStatus?: string;
  pageSize?: number;
  prefetchNextPage?: boolean;
  enableRealtime?: boolean;
}

/**
 * Optimized hook for document loading with:
 * - Pagination with virtual scrolling support
 * - Prefetching next page
 * - Caching with smart invalidation
 * - Realtime updates
 * - Memoized filtering
 */
export function useOptimizedDocuments(options: UseOptimizedDocumentsOptions) {
  const {
    batchId,
    projectId,
    validationStatus,
    pageSize = 50,
    prefetchNextPage = true,
    enableRealtime = true
  } = options;

  const [documents, setDocuments] = useState<DocumentWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  const cacheRef = useRef<Map<string, DocumentWithMetadata>>(new Map());
  const queryClient = useQueryClient();

  // Build query key for caching
  const queryKey = useMemo(() => 
    ['documents', batchId, projectId, validationStatus, pageSize].filter(Boolean),
    [batchId, projectId, validationStatus, pageSize]
  );

  // Fetch documents with pagination
  const fetchDocuments = useCallback(async (page: number, append = false) => {
    if (!batchId && !projectId) return;
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('documents')
        .select('id, file_name, file_url, file_type, confidence_score, extracted_metadata, validation_status, created_at, batch_id, project_id', { count: 'exact' });

      if (batchId) {
        query = query.eq('batch_id', batchId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (validationStatus) {
        query = query.eq('validation_status', validationStatus as any);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (count !== null) {
        setTotalCount(count);
      }

      // Update cache
      data?.forEach(doc => {
        cacheRef.current.set(doc.id, doc as DocumentWithMetadata);
      });

      const typedData = (data || []) as DocumentWithMetadata[];
      
      if (append) {
        setDocuments(prev => [...prev, ...typedData]);
      } else {
        setDocuments(typedData);
      }

      setHasMore(typedData.length === pageSize);
      setCurrentPage(page);

      // Prefetch next page
      if (prefetchNextPage && typedData.length === pageSize) {
        prefetchPage(page + 1);
      }

    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, projectId, validationStatus, pageSize, prefetchNextPage]);

  // Prefetch without updating state
  const prefetchPage = useCallback(async (page: number) => {
    if (!batchId && !projectId) return;
    
    try {
      let query = supabase
        .from('documents')
        .select('id, file_name, file_url, file_type, confidence_score, extracted_metadata, validation_status, created_at, batch_id, project_id');

      if (batchId) {
        query = query.eq('batch_id', batchId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (validationStatus) {
        query = query.eq('validation_status', validationStatus as any);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      // Just cache, don't update state
      data?.forEach(doc => {
        cacheRef.current.set(doc.id, doc as DocumentWithMetadata);
      });

    } catch (error) {
      // Silently fail prefetch
    }
  }, [batchId, projectId, validationStatus, pageSize]);

  // Load more documents
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchDocuments(currentPage + 1, true);
    }
  }, [isLoading, hasMore, currentPage, fetchDocuments]);

  // Refresh all
  const refresh = useCallback(() => {
    setDocuments([]);
    setCurrentPage(0);
    fetchDocuments(0);
  }, [fetchDocuments]);

  // Get cached document by ID
  const getDocumentById = useCallback((id: string) => {
    return cacheRef.current.get(id);
  }, []);

  // Optimistically update a document
  const updateDocument = useCallback((id: string, updates: Partial<DocumentWithMetadata>) => {
    setDocuments(prev => 
      prev.map(doc => doc.id === id ? { ...doc, ...updates } : doc)
    );
    
    const cached = cacheRef.current.get(id);
    if (cached) {
      cacheRef.current.set(id, { ...cached, ...updates });
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDocuments(0);
  }, [fetchDocuments]);

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime || (!batchId && !projectId)) return;

    const channel = supabase
      .channel(`documents-${batchId || projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: batchId ? `batch_id=eq.${batchId}` : `project_id=eq.${projectId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as DocumentWithMetadata;
            cacheRef.current.set(newDoc.id, newDoc);
            setDocuments(prev => [newDoc, ...prev]);
            setTotalCount(prev => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            const updatedDoc = payload.new as DocumentWithMetadata;
            updateDocument(updatedDoc.id, updatedDoc);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            cacheRef.current.delete(deletedId);
            setDocuments(prev => prev.filter(d => d.id !== deletedId));
            setTotalCount(prev => prev - 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId, projectId, enableRealtime, updateDocument]);

  // Memoized stats
  const stats = useMemo(() => {
    const validated = documents.filter(d => d.validation_status === 'validated').length;
    const pending = documents.filter(d => d.validation_status === 'pending').length;
    const rejected = documents.filter(d => d.validation_status === 'rejected').length;
    const avgConfidence = documents.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / (documents.length || 1);
    
    return {
      total: totalCount,
      loaded: documents.length,
      validated,
      pending,
      rejected,
      avgConfidence: Math.round(avgConfidence * 100)
    };
  }, [documents, totalCount]);

  return {
    documents,
    isLoading,
    hasMore,
    totalCount,
    stats,
    loadMore,
    refresh,
    getDocumentById,
    updateDocument
  };
}
