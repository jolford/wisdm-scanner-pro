import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface BatchProcessingStatusProps {
  batchId: string;
  status: string;
  totalDocuments: number;
  processedDocuments: number;
  className?: string;
}

export const BatchProcessingStatus = ({ 
  batchId, 
  status: initialStatus, 
  totalDocuments: initialTotal,
  processedDocuments: initialProcessed,
  className 
}: BatchProcessingStatusProps) => {
  const [status, setStatus] = useState(initialStatus);
  const [totalDocuments, setTotalDocuments] = useState(initialTotal);
  const [processedDocuments, setProcessedDocuments] = useState(initialProcessed);
  const [isProcessing, setIsProcessing] = useState(
    ['new', 'scanning', 'indexing'].includes(initialStatus)
  );

  useEffect(() => {
    // Subscribe to realtime updates for this batch
    const channel = supabase
      .channel(`batch-${batchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'batches',
          filter: `id=eq.${batchId}`
        },
        (payload) => {
          const newBatch = payload.new as any;
          setStatus(newBatch.status);
          setTotalDocuments(newBatch.total_documents || 0);
          setProcessedDocuments(newBatch.processed_documents || 0);
          setIsProcessing(['new', 'scanning', 'indexing'].includes(newBatch.status));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId]);

  const progress = totalDocuments > 0 
    ? Math.round((processedDocuments / totalDocuments) * 100) 
    : 0;

  const getStatusConfig = () => {
    switch (status) {
      case 'new':
        return {
          icon: Clock,
          label: 'Queued',
          color: 'bg-blue-500',
          showProgress: false
        };
      case 'scanning':
      case 'indexing':
        return {
          icon: Loader2,
          label: `Processing (${processedDocuments}/${totalDocuments})`,
          color: 'bg-purple-500',
          showProgress: true,
          animate: true
        };
      case 'error':
        return {
          icon: XCircle,
          label: 'Failed',
          color: 'bg-red-500',
          showProgress: false
        };
      case 'complete':
      case 'validated':
        return {
          icon: CheckCircle2,
          label: 'Complete',
          color: 'bg-green-500',
          showProgress: false
        };
      default:
        return {
          icon: Clock,
          label: status,
          color: 'bg-gray-500',
          showProgress: false
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={className}>
      <Badge className={`${config.color} text-white flex items-center gap-1.5`}>
        <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
        <span className="text-xs font-medium">{config.label}</span>
      </Badge>
      
      {config.showProgress && (
        <div className="mt-2 space-y-1">
          <Progress value={progress} className="h-1.5" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>OCR Progress</span>
            <span className="font-semibold">{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
};