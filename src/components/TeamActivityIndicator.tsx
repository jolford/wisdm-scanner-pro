import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Eye, Edit, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamActivity {
  userId: string;
  userName: string;
  userAvatar?: string;
  action: 'viewing' | 'editing' | 'reviewing';
  documentId?: string;
  documentName?: string;
  startedAt: Date;
}

interface TeamActivityIndicatorProps {
  activities?: TeamActivity[];
  currentDocumentId?: string;
  maxVisible?: number;
  className?: string;
}

export function TeamActivityIndicator({
  activities: externalActivities,
  currentDocumentId,
  maxVisible = 4,
  className
}: TeamActivityIndicatorProps) {
  const [now, setNow] = useState(new Date());

  // Fetch recent activity from audit_trail if no external activities provided
  const { data: fetchedActivities = [] } = useQuery({
    queryKey: ['team-activity'],
    queryFn: async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('audit_trail')
        .select('user_id, action_type, entity_id, entity_type, created_at')
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return [];

      // Get unique user IDs
      const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
      
      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Transform to TeamActivity format
      const activities: TeamActivity[] = data
        .filter(d => d.user_id)
        .map(d => {
          const profile = profileMap.get(d.user_id!);
          return {
            userId: d.user_id!,
            userName: profile?.full_name || 'Unknown User',
            userAvatar: undefined,
            action: d.action_type.includes('update') ? 'editing' : 
                   d.action_type.includes('review') ? 'reviewing' : 'viewing',
            documentId: d.entity_type === 'document' ? d.entity_id || undefined : undefined,
            documentName: undefined,
            startedAt: new Date(d.created_at!),
          };
        });

      // Deduplicate by userId, keeping most recent
      const uniqueActivities = new Map<string, TeamActivity>();
      for (const activity of activities) {
        if (!uniqueActivities.has(activity.userId)) {
          uniqueActivities.set(activity.userId, activity);
        }
      }

      return Array.from(uniqueActivities.values());
    },
    enabled: !externalActivities,
    refetchInterval: 30000,
  });

  const activities = externalActivities || fetchedActivities;

  // Update relative times
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getActionIcon = (action: TeamActivity['action']) => {
    switch (action) {
      case 'viewing':
        return <Eye className="h-3 w-3" />;
      case 'editing':
        return <Edit className="h-3 w-3" />;
      case 'reviewing':
        return <Clock className="h-3 w-3" />;
    }
  };

  const getActionColor = (action: TeamActivity['action']) => {
    switch (action) {
      case 'viewing':
        return 'bg-blue-500';
      case 'editing':
        return 'bg-green-500';
      case 'reviewing':
        return 'bg-amber-500';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Filter activities for current document if provided
  const relevantActivities = currentDocumentId
    ? activities.filter(a => a.documentId === currentDocumentId)
    : activities;

  const visibleActivities = relevantActivities.slice(0, maxVisible);
  const remainingCount = relevantActivities.length - maxVisible;

  if (relevantActivities.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center", className)}>
        <div className="flex -space-x-2">
          {visibleActivities.map((activity, index) => (
            <HoverCard key={`${activity.userId}-${index}`}>
              <HoverCardTrigger asChild>
                <div className="relative cursor-pointer">
                  <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-background">
                    <AvatarImage src={activity.userAvatar} />
                    <AvatarFallback className="text-xs">
                      {getInitials(activity.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center",
                      getActionColor(activity.action)
                    )}
                  >
                    {getActionIcon(activity.action)}
                  </div>
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" side="bottom" align="start">
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={activity.userAvatar} />
                    <AvatarFallback>{getInitials(activity.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{activity.userName}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {getActionIcon(activity.action)}
                      <span className="capitalize">{activity.action}</span>
                      {activity.documentName && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-32">{activity.documentName}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Started {getRelativeTime(activity.startedAt)}
                    </p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
          
          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-xs font-medium">+{remainingCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{remainingCount} more team members active</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {currentDocumentId && relevantActivities.length > 0 && (
          <Badge variant="secondary" className="ml-2 text-xs">
            {relevantActivities.length} active
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}
