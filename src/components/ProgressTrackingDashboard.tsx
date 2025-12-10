import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Zap } from 'lucide-react';

interface ProgressMetrics {
  totalDocuments: number;
  validated: number;
  pending: number;
  rejected: number;
  avgTimePerDoc: number; // in seconds
  topVendor?: string;
  accuracy: number; // percentage
  ocrProcessed?: number; // OCR processed count
  ocrTotal?: number; // Total documents for OCR
}

interface ProgressTrackingDashboardProps {
  metrics: ProgressMetrics;
  batchName?: string;
}

export const ProgressTrackingDashboard = ({ metrics, batchName }: ProgressTrackingDashboardProps) => {
  const completionPercentage = metrics.totalDocuments > 0 
    ? Math.round((metrics.validated / metrics.totalDocuments) * 100) 
    : 0;
  
  const ocrPercentage = (metrics.ocrTotal && metrics.ocrTotal > 0)
    ? Math.round(((metrics.ocrProcessed || 0) / metrics.ocrTotal) * 100) 
    : null;
  
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">
          {batchName || 'Validation Progress'}
        </h3>
        <p className="text-sm text-muted-foreground">
          Real-time validation metrics and performance
        </p>
      </div>

      {/* Progress Bars */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* OCR Progress - Show if we have OCR metrics and processing isn't complete */}
          {ocrPercentage !== null && ocrPercentage < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  OCR Processing
                </span>
                <span className="text-muted-foreground">{ocrPercentage}%</span>
              </div>
              <Progress value={ocrPercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{metrics.ocrProcessed || 0} processed</span>
                <span>{(metrics.ocrTotal || 0) - (metrics.ocrProcessed || 0)} remaining</span>
              </div>
            </div>
          )}
          
          {/* Validation Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Validation Progress</span>
              <span className="text-muted-foreground">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{metrics.validated} validated</span>
              <span>{metrics.pending} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Validated</span>
            </div>
            <div className="text-2xl font-bold">{metrics.validated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold">{metrics.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Rejected</span>
            </div>
            <div className="text-2xl font-bold">{metrics.rejected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Avg Time</span>
            </div>
            <div className="text-2xl font-bold">{formatTime(metrics.avgTimePerDoc)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Accuracy Rate</span>
            <Badge variant={metrics.accuracy >= 95 ? "default" : "secondary"}>
              {metrics.accuracy}%
            </Badge>
          </div>
          {metrics.topVendor && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Top Vendor</span>
              <span className="font-medium">{metrics.topVendor}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Est. Completion</span>
            <span className="font-medium">
              {metrics.pending > 0 
                ? formatTime(metrics.pending * metrics.avgTimePerDoc)
                : 'Complete'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};