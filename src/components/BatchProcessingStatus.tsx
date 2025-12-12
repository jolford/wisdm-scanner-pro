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
  validatedDocuments?: number;
  className?: string;
  showDetails?: boolean;
}

export const BatchProcessingStatus = ({ 
  batchId, 
  status: initialStatus, 
  totalDocuments: initialTotal,
  processedDocuments: initialProcessed,
  validatedDocuments: initialValidated = 0,
  className,
  showDetails = false
}: BatchProcessingStatusProps) => {
  const [status, setStatus] = useState(initialStatus);
  const [totalDocuments, setTotalDocuments] = useState(initialTotal);
  const [processedDocuments, setProcessedDocuments] = useState(initialProcessed);
  const [validatedDocuments, setValidatedDocuments] = useState(initialValidated);
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
          setValidatedDocuments(newBatch.validated_documents || 0);
          setIsProcessing(['new', 'scanning', 'indexing'].includes(newBatch.status));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId]);

  const ocrProgress = totalDocuments > 0 
    ? Math.round((processedDocuments / totalDocuments) * 100) 
    : 0;

  const validationProgress = totalDocuments > 0 
    ? Math.round((validatedDocuments / totalDocuments) * 100) 
    : 0;

  // Check if OCR is complete based on document counts
  const isOcrComplete = totalDocuments > 0 && processedDocuments >= totalDocuments;
  const isValidationComplete = totalDocuments > 0 && validatedDocuments >= totalDocuments;

  const getStatusConfig = () => {
    // Show different status based on actual progress
    if (status === 'error') {
      return {
        icon: XCircle,
        label: 'Failed',
        color: 'bg-red-500',
        phase: 'error'
      };
    }

    if (status === 'new') {
      return {
        icon: Clock,
        label: 'Queued',
        color: 'bg-blue-500',
        phase: 'queued'
      };
    }

    // OCR phase - scanning or indexing status, OCR not complete
    if (['scanning', 'indexing'].includes(status) && !isOcrComplete) {
      return {
        icon: Loader2,
        label: `OCR ${processedDocuments}/${totalDocuments}`,
        color: 'bg-purple-500',
        phase: 'ocr',
        animate: true
      };
    }

    // Ready for validation - OCR complete but validation not complete
    if (isOcrComplete && !isValidationComplete) {
      return {
        icon: Clock,
        label: 'Ready for Validation',
        color: 'bg-orange-500',
        phase: 'validation'
      };
    }

    // Complete
    if (['complete', 'validated', 'exported'].includes(status) || isValidationComplete) {
      return {
        icon: CheckCircle2,
        label: 'Complete',
        color: 'bg-green-500',
        phase: 'complete'
      };
    }

    // Default fallback
    return {
      icon: Clock,
      label: status,
      color: 'bg-gray-500',
      phase: 'unknown'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={className}>
      <Badge className={`${config.color} text-white flex items-center gap-1.5`}>
        <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
        <span className="text-xs font-medium">{config.label}</span>
      </Badge>
      
      {/* Show OCR progress during processing */}
      {config.phase === 'ocr' && (
        <div className="mt-2 space-y-1">
          <Progress value={ocrProgress} className="h-1.5" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>OCR Processing</span>
            <span className="font-semibold">{ocrProgress}%</span>
          </div>
        </div>
      )}

      {/* Show detailed progress when requested */}
      {showDetails && totalDocuments > 0 && (
        <div className="mt-2 space-y-2">
          {/* OCR Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>OCR</span>
              <span className="font-semibold">{processedDocuments}/{totalDocuments}</span>
            </div>
            <Progress value={ocrProgress} className="h-1" />
          </div>
          
          {/* Validation Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Validated</span>
              <span className="font-semibold">{validatedDocuments}/{totalDocuments}</span>
            </div>
            <Progress value={validationProgress} className="h-1" />
          </div>
        </div>
      )}
    </div>
  );
};