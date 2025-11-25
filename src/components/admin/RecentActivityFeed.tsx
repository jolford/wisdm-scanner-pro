import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, CheckCircle, Send, User, FolderPlus, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export const RecentActivityFeed = () => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // Get recent audit trail entries
      const { data, error } = await supabase
        .from('audit_trail')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'document_upload':
      case 'document_created':
        return Upload;
      case 'document_validated':
      case 'document_approved':
        return CheckCircle;
      case 'batch_created':
        return FolderPlus;
      case 'batch_exported':
        return Send;
      case 'user_created':
      case 'user_updated':
        return User;
      default:
        return Activity;
    }
  };

  const getActivityColor = (actionType: string) => {
    switch (actionType) {
      case 'document_validated':
      case 'document_approved':
      case 'batch_exported':
        return 'text-green-600';
      case 'document_upload':
      case 'document_created':
      case 'batch_created':
        return 'text-blue-600';
      case 'user_created':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getActivityLabel = (actionType: string) => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions across all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest actions across all projects</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities && activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => {
                const Icon = getActivityIcon(activity.action_type);
                const color = getActivityColor(activity.action_type);
                
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors animate-fade-in"
                  >
                    <div className={`p-2 rounded-full bg-muted ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {getActivityLabel(activity.action_type)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {activity.entity_type && (
                        <p className="text-sm text-muted-foreground">
                          {activity.entity_type}: {activity.entity_id?.slice(0, 8)}...
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        {activity.success ? (
                          <Badge variant="outline" className="text-xs">Success</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Failed</Badge>
                        )}
                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Object.keys(activity.metadata).length} details
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
