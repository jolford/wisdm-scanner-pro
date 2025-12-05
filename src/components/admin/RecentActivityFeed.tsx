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
      
      // Fetch additional context for batches and documents
      const enrichedData = await Promise.all(
        (data || []).map(async (activity) => {
          let contextName = null;
          let userName = null;
          
          // Get batch or document name
          if (activity.entity_type === 'batch' && activity.entity_id) {
            const { data: batch } = await supabase
              .from('batches')
              .select('batch_name')
              .eq('id', activity.entity_id)
              .maybeSingle();
            contextName = batch?.batch_name;
          } else if (activity.entity_type === 'document' && activity.entity_id) {
            const { data: doc } = await supabase
              .from('documents')
              .select('file_name')
              .eq('id', activity.entity_id)
              .maybeSingle();
            contextName = doc?.file_name;
          }
          
          // Get user name if available
          if (activity.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', activity.user_id)
              .maybeSingle();
            userName = profile?.full_name || profile?.email;
          }
          
          return { ...activity, contextName, userName };
        })
      );
      
      return enrichedData;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getActivityIcon = (entityType: string) => {
    switch (entityType) {
      case 'document':
        return FileText;
      case 'batch':
        return FolderPlus;
      case 'user':
        return User;
      case 'project':
        return Activity;
      default:
        return Activity;
    }
  };

  const getActivityColor = (actionType: string) => {
    if (actionType.includes('delete') || actionType.includes('remove')) {
      return 'text-destructive';
    }
    if (actionType.includes('create') || actionType.includes('upload') || actionType.includes('validated') || actionType.includes('approved') || actionType.includes('export')) {
      return 'text-green-600';
    }
    if (actionType.includes('update') || actionType.includes('edit')) {
      return 'text-blue-600';
    }
    return 'text-muted-foreground';
  };

  const getActivityDescription = (activity: any) => {
    const action = activity.action_type?.replace(/_/g, ' ') || 'Action';
    const entity = activity.entity_type || 'item';
    const name = activity.contextName;
    
    // Create a more readable description
    if (name) {
      return `${action} ${entity}: "${name}"`;
    }
    return `${action} ${entity}`;
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
                const Icon = getActivityIcon(activity.entity_type);
                const color = getActivityColor(activity.action_type);
                
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 pb-3 border-b border-border last:border-0 last:pb-0"
                  >
                    <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {getActivityDescription(activity)}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5">
                        {activity.userName && (
                          <span className="text-xs text-muted-foreground">
                            {activity.userName}
                          </span>
                        )}
                        {!activity.success && (
                          <Badge variant="destructive" className="text-xs">
                            Failed
                          </Badge>
                        )}
                        {activity.error_message && (
                          <span className="text-xs text-destructive truncate max-w-[180px]">
                            {activity.error_message}
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
