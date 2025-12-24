import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, Zap, Target, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

/**
 * Real-time analytics dashboard with processing trends and error patterns
 */
export function RealTimeAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['realtime-analytics'],
    queryFn: async () => {
      const now = new Date();
      const last7Days = subDays(now, 7);

      // Get daily document counts for last 7 days
      const { data: dailyDocs, error: dailyError } = await supabase
        .from('documents')
        .select('created_at, validation_status')
        .gte('created_at', last7Days.toISOString());

      if (dailyError) throw dailyError;

      // Get error logs for pattern detection
      const { data: errors, error: errorsError } = await supabase
        .from('error_logs')
        .select('created_at, error_message, component_name, severity')
        .gte('created_at', last7Days.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (errorsError) throw errorsError;

      // Get job metrics
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('status, created_at, completed_at, job_type')
        .gte('created_at', last7Days.toISOString());

      if (jobsError) throw jobsError;

      // Process daily trends
      const dailyTrends: Record<string, { date: string; total: number; validated: number; errors: number }> = {};
      
      for (let i = 6; i >= 0; i--) {
        const day = format(subDays(now, i), 'yyyy-MM-dd');
        dailyTrends[day] = { date: format(subDays(now, i), 'MMM dd'), total: 0, validated: 0, errors: 0 };
      }

      dailyDocs?.forEach((doc) => {
        const day = format(new Date(doc.created_at), 'yyyy-MM-dd');
        if (dailyTrends[day]) {
          dailyTrends[day].total++;
          if (doc.validation_status === 'validated') {
            dailyTrends[day].validated++;
          }
        }
      });

      errors?.forEach((error) => {
        const day = format(new Date(error.created_at), 'yyyy-MM-dd');
        if (dailyTrends[day]) {
          dailyTrends[day].errors++;
        }
      });

      // Detect error patterns
      const errorPatterns: Record<string, number> = {};
      errors?.forEach((error) => {
        const key = error.component_name || 'Unknown';
        errorPatterns[key] = (errorPatterns[key] || 0) + 1;
      });

      const topErrors = Object.entries(errorPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Calculate processing stats
      const completedJobs = jobs?.filter((j) => j.status === 'completed') || [];
      const avgProcessingTime = completedJobs.length > 0
        ? completedJobs.reduce((acc, job) => {
            if (job.completed_at && job.created_at) {
              return acc + (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime());
            }
            return acc;
          }, 0) / completedJobs.length / 1000
        : 0;

      return {
        trends: Object.values(dailyTrends),
        topErrors,
        avgProcessingTime: Math.round(avgProcessingTime),
        totalDocs: dailyDocs?.length || 0,
        errorCount: errors?.length || 0,
        successRate: dailyDocs?.length 
          ? Math.round((dailyDocs.filter(d => d.validation_status === 'validated').length / dailyDocs.length) * 100)
          : 0,
      };
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="pt-6"><Skeleton className="h-48" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-48" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                <p className="text-2xl font-bold">{analytics?.avgProcessingTime || 0}s</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{analytics?.successRate || 0}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Count (7d)</p>
                <p className="text-2xl font-bold">{analytics?.errorCount || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Processing Trends (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.trends}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Total" />
                <Area type="monotone" dataKey="validated" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" name="Validated" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Error Patterns */}
      {analytics?.topErrors && analytics.topErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topErrors.map(([component, count]) => (
                <div key={component} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{component}</span>
                  <Badge variant="destructive">{count} errors</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
