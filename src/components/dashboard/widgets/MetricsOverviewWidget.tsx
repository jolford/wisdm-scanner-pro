import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MetricsOverviewWidgetProps {
  config: {
    period?: string;
  };
}

export function MetricsOverviewWidget({ config }: MetricsOverviewWidgetProps) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['metrics-overview', config],
    queryFn: async () => {
      const { count: totalBatches } = await supabase
        .from('batches')
        .select('*', { count: 'exact', head: true });

      const { count: totalDocuments } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      const { count: pendingValidations } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'pending');

      return {
        totalBatches: totalBatches || 0,
        totalDocuments: totalDocuments || 0,
        pendingValidations: pendingValidations || 0,
      };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Metrics Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{metrics?.totalBatches}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Batches</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{metrics?.totalDocuments}</p>
              <p className="text-sm text-muted-foreground mt-1">Documents</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-warning">{metrics?.pendingValidations}</p>
              <p className="text-sm text-muted-foreground mt-1">Pending</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
