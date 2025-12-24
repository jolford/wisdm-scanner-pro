import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  DollarSign,
  FileWarning,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Anomaly {
  id: string;
  type: 'value_spike' | 'value_drop' | 'unusual_pattern' | 'duplicate_suspect' | 'timing_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  field: string;
  currentValue: string | number;
  expectedRange?: { min: number; max: number };
  averageValue?: number;
  deviation?: number;
  message: string;
  documentId?: string;
  detectedAt: Date;
}

interface AnomalyDetectionAlertProps {
  anomalies: Anomaly[];
  onDismiss?: (anomalyId: string) => void;
  onInvestigate?: (anomaly: Anomaly) => void;
  className?: string;
}

const severityConfig = {
  low: {
    color: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
    icon: FileWarning,
    label: 'Low'
  },
  medium: {
    color: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
    label: 'Medium'
  },
  high: {
    color: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400',
    icon: AlertTriangle,
    label: 'High'
  },
  critical: {
    color: 'bg-destructive/10 border-destructive/20 text-destructive',
    icon: AlertTriangle,
    label: 'Critical'
  }
};

const typeIcons = {
  value_spike: TrendingUp,
  value_drop: TrendingDown,
  unusual_pattern: FileWarning,
  duplicate_suspect: FileWarning,
  timing_anomaly: Clock
};

export function AnomalyDetectionAlert({
  anomalies,
  onDismiss,
  onInvestigate,
  className
}: AnomalyDetectionAlertProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleAnomalies = anomalies.filter(a => !dismissedIds.has(a.id));
  
  const criticalCount = visibleAnomalies.filter(a => a.severity === 'critical').length;
  const highCount = visibleAnomalies.filter(a => a.severity === 'high').length;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    onDismiss?.(id);
  };

  if (visibleAnomalies.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-amber-500/30", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Anomaly Detection
            <Badge variant="secondary" className="text-xs">
              {visibleAnomalies.length} detected
            </Badge>
          </div>
          <div className="flex gap-1">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="text-xs bg-orange-500">
                {highCount} high
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {visibleAnomalies.map((anomaly) => {
          const config = severityConfig[anomaly.severity];
          const TypeIcon = typeIcons[anomaly.type];
          const isExpanded = expandedIds.has(anomaly.id);

          return (
            <Alert
              key={anomaly.id}
              className={cn(
                "relative transition-all",
                config.color
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <TypeIcon className="h-4 w-4 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTitle className="text-sm font-medium mb-0">
                        {anomaly.field}
                      </AlertTitle>
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                    <AlertDescription className="text-xs mt-1">
                      {anomaly.message}
                    </AlertDescription>
                    
                    {isExpanded && (
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">Current Value:</span>
                            <span className="ml-1 font-medium">{anomaly.currentValue}</span>
                          </div>
                          {anomaly.averageValue !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Average:</span>
                              <span className="ml-1 font-medium">{anomaly.averageValue.toFixed(2)}</span>
                            </div>
                          )}
                          {anomaly.deviation !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Deviation:</span>
                              <span className="ml-1 font-medium">{anomaly.deviation.toFixed(1)}%</span>
                            </div>
                          )}
                          {anomaly.expectedRange && (
                            <div>
                              <span className="text-muted-foreground">Expected:</span>
                              <span className="ml-1 font-medium">
                                {anomaly.expectedRange.min} - {anomaly.expectedRange.max}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {onInvestigate && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => onInvestigate(anomaly)}
                          >
                            Investigate
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => toggleExpand(anomaly.id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDismiss(anomaly.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
