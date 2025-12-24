import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, AlertCircle, Loader2, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BatchProgress {
  id: string;
  batchName: string;
  status: string;
  totalDocuments: number;
  processedDocuments: number;
  errorCount: number;
  startedAt: string;
}

/**
 * Real-time batch processing notifications
 * Shows progress toasts for active batch processing
 */
export function BatchProgressNotification() {
  const [activeBatches, setActiveBatches] = useState<BatchProgress[]>([]);
  const [dismissedBatches, setDismissedBatches] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    // Load currently processing batches
    const loadActiveBatches = async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_name, status, total_documents, processed_documents, error_count, started_at')
        .in('status', ['scanning', 'indexing', 'validation'])
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Failed to load active batches:', error);
        return;
      }

      const batches: BatchProgress[] = (data || []).map((b) => ({
        id: b.id,
        batchName: b.batch_name,
        status: b.status,
        totalDocuments: b.total_documents || 0,
        processedDocuments: b.processed_documents || 0,
        errorCount: b.error_count || 0,
        startedAt: b.started_at,
      }));

      setActiveBatches(batches);
    };

    loadActiveBatches();

    // Subscribe to batch updates
    const channel = supabase
      .channel('batch-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batches',
        },
        (payload) => {
          const batch = (payload.new || payload.old) as any;
          
          if (payload.eventType === 'DELETE') {
            setActiveBatches((prev) => prev.filter((b) => b.id !== batch.id));
            return;
          }

          const progress: BatchProgress = {
            id: batch.id,
            batchName: batch.batch_name,
            status: batch.status,
            totalDocuments: batch.total_documents || 0,
            processedDocuments: batch.processed_documents || 0,
            errorCount: batch.error_count || 0,
            startedAt: batch.started_at,
          };

          if (['scanning', 'indexing', 'validation'].includes(batch.status)) {
            setActiveBatches((prev) => {
              const exists = prev.find((b) => b.id === batch.id);
              if (exists) {
                return prev.map((b) => b.id === batch.id ? progress : b);
              }
              return [...prev, progress];
            });
          } else if (['complete', 'exported', 'error'].includes(batch.status)) {
            // Keep completed batches visible for a few seconds
            setActiveBatches((prev) => 
              prev.map((b) => b.id === batch.id ? progress : b)
            );
            
            setTimeout(() => {
              setActiveBatches((prev) => prev.filter((b) => b.id !== batch.id));
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissBatch = (batchId: string) => {
    setDismissedBatches((prev) => new Set(prev).add(batchId));
  };

  const visibleBatches = activeBatches.filter((b) => !dismissedBatches.has(b.id));

  if (visibleBatches.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {visibleBatches.map((batch) => {
        const progress = batch.totalDocuments > 0 
          ? (batch.processedDocuments / batch.totalDocuments) * 100 
          : 0;
        
        const isComplete = ['complete', 'exported'].includes(batch.status);
        const isFailed = batch.status === 'error';
        const isExporting = batch.status === 'exported';

        return (
          <div
            key={batch.id}
            className={cn(
              "bg-card border rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5",
              isComplete && "border-green-500/50",
              isFailed && "border-destructive/50"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isComplete ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : isFailed ? (
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                )}
                <span className="font-medium text-sm truncate">{batch.batchName}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => dismissBatch(batch.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <Progress value={progress} className="h-2 mb-2" />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isExporting ? 'Exporting...' : 
                 isComplete ? 'Complete!' :
                 isFailed ? `Failed (${batch.errorCount} errors)` :
                 `${batch.processedDocuments}/${batch.totalDocuments} documents`}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>

            {(isComplete || isFailed) && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => navigate(`/admin/batches/${batch.id}`)}
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                View Batch
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
