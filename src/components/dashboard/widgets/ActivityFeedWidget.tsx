import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedWidgetProps {
  config: {
    limit?: number;
    showBatches?: boolean;
    showValidations?: boolean;
  };
}

export function ActivityFeedWidget({ config }: ActivityFeedWidgetProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity-feed', config],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_name, status, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(config.limit || 10);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent">
                <div className="flex-1">
                  <p className="font-medium">{activity.batch_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant={activity.status === 'exported' ? 'default' : 'secondary'}>
                  {activity.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
        )}
      </CardContent>
    </Card>
  );
}
