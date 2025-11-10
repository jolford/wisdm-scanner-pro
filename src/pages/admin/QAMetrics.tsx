import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Clock, Target, AlertTriangle, CheckCircle2, XCircle, Activity } from 'lucide-react';

interface MetricData {
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
  icon: any;
  color: string;
}

export default function QAMetrics() {
  useRequireAuth(true);
  
  const [timeRange, setTimeRange] = useState('7');
  const [metrics, setMetrics] = useState<{
    validationAccuracy: MetricData;
    avgProcessingTime: MetricData;
    errorRate: MetricData;
    throughput: MetricData;
    totalValidated: number;
    totalRejected: number;
    totalPending: number;
  } | null>(null);
  const [errorsByType, setErrorsByType] = useState<Array<{ type: string; count: number; percentage: number }>>([]);
  const [processingTrend, setProcessingTrend] = useState<Array<{ date: string; count: number; avgTime: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(timeRange));

      // Current period documents
      const { data: currentDocs } = await supabase
        .from('documents')
        .select('validation_status, validated_at, created_at')
        .not('validated_at', 'is', null)
        .gte('validated_at', startDate.toISOString());

      // Previous period documents for trend
      const { data: previousDocs } = await supabase
        .from('documents')
        .select('validation_status')
        .not('validated_at', 'is', null)
        .gte('validated_at', previousPeriodStart.toISOString())
        .lt('validated_at', startDate.toISOString());

      const totalValidated = currentDocs?.filter(d => d.validation_status === 'validated').length || 0;
      const totalRejected = currentDocs?.filter(d => d.validation_status === 'rejected').length || 0;
      const totalCurrent = totalValidated + totalRejected;

      const prevTotalValidated = previousDocs?.filter(d => d.validation_status === 'validated').length || 0;
      const prevTotal = previousDocs?.length || 0;

      const accuracy = totalCurrent > 0 ? (totalValidated / totalCurrent) * 100 : 0;
      const prevAccuracy = prevTotal > 0 ? (prevTotalValidated / prevTotal) * 100 : 0;
      const accuracyTrend = accuracy - prevAccuracy;

      const errorRate = totalCurrent > 0 ? (totalRejected / totalCurrent) * 100 : 0;
      const prevErrorRate = prevTotal > 0 ? ((prevTotal - prevTotalValidated) / prevTotal) * 100 : 0;
      const errorTrend = errorRate - prevErrorRate;

      // Processing time from jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('started_at, completed_at, created_at')
        .gte('created_at', startDate.toISOString())
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null);

      const processingTimes = jobs?.map(j => 
        (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000
      ) || [];

      const avgTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      const { data: prevJobs } = await supabase
        .from('jobs')
        .select('started_at, completed_at')
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', startDate.toISOString())
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null);

      const prevTimes = prevJobs?.map(j =>
        (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000
      ) || [];

      const prevAvgTime = prevTimes.length > 0
        ? prevTimes.reduce((a, b) => a + b, 0) / prevTimes.length
        : 0;

      const timeTrend = prevAvgTime > 0 ? ((avgTime - prevAvgTime) / prevAvgTime) * 100 : 0;

      // Throughput
      const throughput = totalCurrent;
      const throughputTrend = prevTotal > 0 ? ((throughput - prevTotal) / prevTotal) * 100 : 0;

      // Pending documents
      const { count: pendingCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'pending');

      setMetrics({
        validationAccuracy: {
          label: 'Validation Accuracy',
          value: `${accuracy.toFixed(1)}%`,
          trend: accuracyTrend,
          trendLabel: `${Math.abs(accuracyTrend).toFixed(1)}% vs previous period`,
          icon: Target,
          color: 'text-green-600',
        },
        avgProcessingTime: {
          label: 'Avg Processing Time',
          value: `${avgTime.toFixed(1)}s`,
          trend: timeTrend,
          trendLabel: `${Math.abs(timeTrend).toFixed(1)}% vs previous period`,
          icon: Clock,
          color: 'text-blue-600',
        },
        errorRate: {
          label: 'Error Rate',
          value: `${errorRate.toFixed(1)}%`,
          trend: errorTrend,
          trendLabel: `${Math.abs(errorTrend).toFixed(1)}% vs previous period`,
          icon: AlertTriangle,
          color: 'text-red-600',
        },
        throughput: {
          label: 'Documents Processed',
          value: throughput,
          trend: throughputTrend,
          trendLabel: `${Math.abs(throughputTrend).toFixed(1)}% vs previous period`,
          icon: Activity,
          color: 'text-purple-600',
        },
        totalValidated,
        totalRejected,
        totalPending: pendingCount || 0,
      });

      // Errors by document type
      const errorMap: Record<string, number> = {};
      const { data: errorDocs } = await supabase
        .from('documents')
        .select('document_type')
        .eq('validation_status', 'rejected')
        .gte('validated_at', startDate.toISOString());

      errorDocs?.forEach(doc => {
        const type = doc.document_type || 'Unknown';
        errorMap[type] = (errorMap[type] || 0) + 1;
      });

      const errors = Object.entries(errorMap)
        .map(([type, count]) => ({
          type,
          count,
          percentage: (count / totalRejected) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      setErrorsByType(errors);

      // Processing trend by day
      const trendMap: Record<string, { count: number; totalTime: number; times: number[] }> = {};
      currentDocs?.forEach(doc => {
        const day = new Date(doc.validated_at!).toISOString().split('T')[0];
        if (!trendMap[day]) {
          trendMap[day] = { count: 0, totalTime: 0, times: [] };
        }
        trendMap[day].count++;
      });

      jobs?.forEach(job => {
        const day = new Date(job.created_at).toISOString().split('T')[0];
        if (trendMap[day]) {
          const time = (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000;
          trendMap[day].times.push(time);
        }
      });

      const trend = Object.entries(trendMap)
        .map(([date, data]) => ({
          date,
          count: data.count,
          avgTime: data.times.length > 0 ? data.times.reduce((a, b) => a + b, 0) / data.times.length : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setProcessingTrend(trend);
    } catch (error) {
      console.error('Error loading metrics:', error);
      toast.error('Failed to load QA metrics');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout 
      title="Quality Assurance Metrics"
      description="Comprehensive quality and performance tracking"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quality Assurance Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor validation accuracy, processing times, and error rates
            </p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !metrics ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                No metrics data available
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
              {[
                metrics.validationAccuracy,
                metrics.avgProcessingTime,
                metrics.errorRate,
                metrics.throughput,
              ].map((metric, idx) => {
                const Icon = metric.icon;
                const isPositiveTrend = metric.trend && metric.trend > 0;
                const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;
                
                return (
                  <Card key={idx}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {metric.label}
                        </CardTitle>
                        <Icon className={`h-4 w-4 ${metric.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${metric.color}`}>
                        {metric.value}
                      </div>
                      {metric.trend !== undefined && (
                        <div className={`flex items-center gap-1 mt-2 text-xs ${
                          isPositiveTrend ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <TrendIcon className="h-3 w-3" />
                          {metric.trendLabel}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Status Overview */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Validated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {metrics.totalValidated}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Rejected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {metrics.totalRejected}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">
                    {metrics.totalPending}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Errors by Type */}
            {errorsByType.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Errors by Document Type
                  </CardTitle>
                  <CardDescription>
                    Most problematic document types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {errorsByType.slice(0, 5).map((error, idx) => (
                      <div key={error.type} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{error.type}</span>
                          <span className="text-muted-foreground">
                            {error.count} errors ({error.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-destructive transition-all"
                            style={{ width: `${error.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Processing Trend */}
            {processingTrend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Processing Trend
                  </CardTitle>
                  <CardDescription>
                    Daily document processing and average times
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {processingTrend.map((day) => (
                      <div key={day.date} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <div className="font-medium">
                            {new Date(day.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {day.count} documents
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">
                            {day.avgTime > 0 ? `${day.avgTime.toFixed(1)}s` : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">Avg time</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
