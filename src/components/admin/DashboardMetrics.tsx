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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
      {metricCards.map((metric) => (
        <Card 
          key={metric.title} 
          className="group relative overflow-hidden border-border/40 bg-gradient-to-br from-card to-card/50 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all duration-300 hover:-translate-y-0.5"
        >
          {/* Background icon decoration */}
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
            <metric.icon className="h-32 w-32" />
          </div>
          
          <CardHeader className="pb-3 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`h-10 w-10 rounded-xl ${
                metric.title === "Today's Documents" ? 'bg-info/10' :
                metric.title === "Validated Today" ? 'bg-success/10' :
                metric.title === "Pending Validation" ? 'bg-warning/10' :
                'bg-destructive/10'
              } flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="relative">
            <div className="flex items-baseline gap-3 mb-2">
              <div className="text-4xl font-bold tracking-tight">
                {metric.value.toLocaleString()}
              </div>
              {metric.trend === 'up' && (
                <div className="flex items-center gap-1 text-success">
                  <TrendingUp className="h-4 w-4" />
                </div>
              )}
              {metric.trend === 'down' && (
                <div className="flex items-center gap-1 text-destructive">
                  <TrendingDown className="h-4 w-4" />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {metric.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
