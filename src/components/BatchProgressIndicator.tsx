import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface BatchProgressIndicatorProps {
  totalDocuments: number;
  processedDocuments: number;
  validatedDocuments: number;
  errorCount: number;
  status: string;
  compact?: boolean;
}

export const BatchProgressIndicator = ({
  totalDocuments,
  processedDocuments,
  validatedDocuments,
  errorCount,
  status,
  compact = false,
}: BatchProgressIndicatorProps) => {
  const processedPercent = totalDocuments > 0 ? Math.round((processedDocuments / totalDocuments) * 100) : 0;
  const validatedPercent = totalDocuments > 0 ? Math.round((validatedDocuments / totalDocuments) * 100) : 0;
  const pendingCount = totalDocuments - processedDocuments;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{validatedPercent}%</span>
        </div>
        <Progress value={validatedPercent} className="h-2" />
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {validatedDocuments}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {pendingCount}
          </Badge>
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorCount}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Batch Progress</h3>
            <Badge variant={
              status === 'completed' ? 'default' :
              status === 'processing' ? 'secondary' :
              status === 'error' ? 'destructive' :
              'outline'
            }>
              {status}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Validation Progress</span>
              <span className="font-medium">{validatedDocuments} / {totalDocuments}</span>
            </div>
            <Progress value={validatedPercent} className="h-3" />
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2">
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-blue-600 mb-1" />
              <span className="text-2xl font-bold">{totalDocuments}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>

            <div className="flex flex-col items-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-5 w-5 text-green-600 mb-1" />
              <span className="text-2xl font-bold text-green-600">{validatedDocuments}</span>
              <span className="text-xs text-muted-foreground">Validated</span>
            </div>

            <div className="flex flex-col items-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950">
              <Clock className="h-5 w-5 text-orange-600 mb-1" />
              <span className="text-2xl font-bold text-orange-600">{pendingCount}</span>
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>

            <div className="flex flex-col items-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
              <AlertCircle className="h-5 w-5 text-red-600 mb-1" />
              <span className="text-2xl font-bold text-red-600">{errorCount}</span>
              <span className="text-xs text-muted-foreground">Errors</span>
            </div>
          </div>

          {validatedPercent === 100 && errorCount === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Batch completed successfully!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
