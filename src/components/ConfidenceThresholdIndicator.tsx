import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldThreshold {
  name: string;
  threshold: number;
}

interface ConfidenceThresholdIndicatorProps {
  fieldName: string;
  confidence: number;
  threshold?: number; // Custom threshold for this field
  defaultThreshold?: number; // Default threshold (e.g., 0.75)
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Visual indicator for field confidence vs threshold
 * Helps operators quickly identify fields needing review
 */
export function ConfidenceThresholdIndicator({
  fieldName,
  confidence,
  threshold,
  defaultThreshold = 0.75,
  showLabel = true,
  size = 'md'
}: ConfidenceThresholdIndicatorProps) {
  const effectiveThreshold = threshold ?? defaultThreshold;
  const confidencePercent = Math.round(confidence * 100);
  const thresholdPercent = Math.round(effectiveThreshold * 100);
  const meetsThreshold = confidence >= effectiveThreshold;
  const isHighConfidence = confidence >= 0.9;
  const isLowConfidence = confidence < 0.5;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16
  };

  // Determine status color and icon
  let statusColor: string;
  let StatusIcon: typeof CheckCircle2;
  let statusLabel: string;

  if (isHighConfidence) {
    statusColor = 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    StatusIcon = CheckCircle2;
    statusLabel = 'High confidence';
  } else if (meetsThreshold) {
    statusColor = 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    StatusIcon = TrendingUp;
    statusLabel = 'Above threshold';
  } else if (isLowConfidence) {
    statusColor = 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    StatusIcon = XCircle;
    statusLabel = 'Low confidence - review required';
  } else {
    statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    StatusIcon = AlertTriangle;
    statusLabel = 'Below threshold - review recommended';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-medium border cursor-help',
              statusColor,
              sizeClasses[size]
            )}
          >
            <StatusIcon size={iconSize[size]} />
            {showLabel && (
              <span>{confidencePercent}%</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-medium">{statusLabel}</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Confidence: {confidencePercent}%</p>
              <p>Threshold: {thresholdPercent}%</p>
              {!meetsThreshold && (
                <p className="text-yellow-600 dark:text-yellow-400">
                  Field requires manual verification
                </p>
              )}
            </div>
            {/* Visual confidence bar */}
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mt-2">
              <div 
                className={cn(
                  'absolute left-0 top-0 h-full rounded-full transition-all',
                  isHighConfidence ? 'bg-green-500' : 
                  meetsThreshold ? 'bg-blue-500' : 
                  isLowConfidence ? 'bg-red-500' : 'bg-yellow-500'
                )}
                style={{ width: `${confidencePercent}%` }}
              />
              {/* Threshold marker */}
              <div 
                className="absolute top-0 w-0.5 h-full bg-foreground/50"
                style={{ left: `${thresholdPercent}%` }}
              />
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ConfidenceSummaryProps {
  fields: Array<{
    name: string;
    confidence: number;
    threshold?: number;
  }>;
  defaultThreshold?: number;
}

/**
 * Summary component showing overall document confidence status
 */
export function ConfidenceSummary({ fields, defaultThreshold = 0.75 }: ConfidenceSummaryProps) {
  const fieldsBelowThreshold = fields.filter(f => {
    const threshold = f.threshold ?? defaultThreshold;
    return f.confidence < threshold;
  });

  const avgConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / (fields.length || 1);
  const avgConfidencePercent = Math.round(avgConfidence * 100);
  
  const allGood = fieldsBelowThreshold.length === 0;
  const hasLowConfidence = fields.some(f => f.confidence < 0.5);

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      allGood 
        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
        : hasLowConfidence
        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
    )}>
      {allGood ? (
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
      ) : hasLowConfidence ? (
        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      )}
      
      <div className="flex-1">
        <p className={cn(
          'font-medium text-sm',
          allGood ? 'text-green-800 dark:text-green-300' : 
          hasLowConfidence ? 'text-red-800 dark:text-red-300' : 
          'text-yellow-800 dark:text-yellow-300'
        )}>
          {allGood 
            ? 'All fields meet confidence thresholds' 
            : `${fieldsBelowThreshold.length} field(s) require review`}
        </p>
        <p className="text-xs text-muted-foreground">
          Average confidence: {avgConfidencePercent}%
          {!allGood && (
            <span className="ml-2">
              • {fieldsBelowThreshold.map(f => f.name).join(', ')}
            </span>
          )}
        </p>
      </div>
      
      <Badge variant="outline" className={cn(
        'font-mono',
        allGood ? 'bg-green-100 dark:bg-green-900/30' : 
        hasLowConfidence ? 'bg-red-100 dark:bg-red-900/30' : 
        'bg-yellow-100 dark:bg-yellow-900/30'
      )}>
        {avgConfidencePercent}%
      </Badge>
    </div>
  );
}
