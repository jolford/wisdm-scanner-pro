import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle, AlertCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export const DashboardMetrics = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's documents
      const { data: todayDocs, error: docsError } = await supabase
        .from('documents')
        .select('id, validation_status, created_at')
        .gte('created_at', today.toISOString());

      if (docsError) throw docsError;

      // Get today's validated documents count
      const { count: validatedCount, error: validatedError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'validated')
        .gte('validated_at', today.toISOString());

      if (validatedError) throw validatedError;

      // Get pending documents count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'pending');

      if (pendingError) throw pendingError;

      // Get documents needing review count
      const { count: reviewCount, error: reviewError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('needs_review', true)
        .eq('validation_status', 'pending');

      if (reviewError) throw reviewError;

      // Calculate stats
      const totalToday = todayDocs?.length || 0;
      const validated = validatedCount || 0;
      const pending = pendingCount || 0;
      const review = reviewCount || 0;

      // Calculate validation rate (validated vs total today)
      const validationRate = totalToday > 0 ? Math.round((validated / totalToday) * 100) : 0;

      return {
        totalToday,
        validatedCount: validated,
        pendingCount: pending,
        reviewCount: review,
        validationRate,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricCards = [
    {
      title: "Today's Documents",
      value: metrics?.totalToday || 0,
      description: "Uploaded today",
      icon: FileText,
      trend: metrics?.totalToday > 0 ? 'up' : 'neutral',
      color: "text-blue-600",
    },
    {
      title: "Validated Today",
      value: metrics?.validatedCount || 0,
      description: `${metrics?.validationRate}% completion rate`,
      icon: CheckCircle,
      trend: metrics?.validationRate >= 80 ? 'up' : metrics?.validationRate >= 50 ? 'neutral' : 'down',
      color: "text-green-600",
    },
    {
      title: "Pending Validation",
      value: metrics?.pendingCount || 0,
      description: "Awaiting review",
      icon: Clock,
      trend: metrics?.pendingCount > 10 ? 'up' : 'neutral',
      color: "text-orange-600",
    },
    {
      title: "Needs Attention",
      value: metrics?.reviewCount || 0,
      description: "Flagged for review",
      icon: AlertCircle,
      trend: metrics?.reviewCount > 5 ? 'up' : 'neutral',
      color: "text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
      {metricCards.map((metric) => (
        <Card key={metric.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{metric.value.toLocaleString()}</div>
              {metric.trend === 'up' && (
                <TrendingUp className="h-4 w-4 text-green-600" />
              )}
              {metric.trend === 'down' && (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metric.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
