import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { History, User, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FieldChange {
  id: string;
  document_id: string;
  user_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  validation_status: string | null;
  created_at: string;
  user_profile?: {
    full_name: string;
    email: string;
  };
}

interface FieldChangeHistoryProps {
  documentId: string;
}

export const FieldChangeHistory = ({ documentId }: FieldChangeHistoryProps) => {
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChanges();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`field_changes:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'field_changes',
          filter: `document_id=eq.${documentId}`,
        },
        () => loadChanges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  const loadChanges = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('field_changes')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      if (data) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const changesWithProfiles = data.map(change => ({
          ...change,
          user_profile: profileMap.get(change.user_id) || { full_name: 'Unknown', email: '' },
        }));

        setChanges(changesWithProfiles);
      }
    } catch (error) {
      console.error('Error loading field changes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'update':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'delete':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <CardTitle>Field Change History</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : changes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No changes recorded yet
            </p>
          ) : (
            <div className="space-y-4">
              {changes.map((change, index) => (
                <div key={change.id} className="relative">
                  {index !== changes.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                  )}
                  <div className="flex gap-4">
                    <div className="relative">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <History className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <Card className="flex-1">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={getChangeTypeColor(change.change_type)}>
                            {change.change_type}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-3 w-3" />
                            <span className="font-medium">
                              {change.user_profile?.full_name || 'Unknown User'}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-primary">
                            Field: {change.field_name}
                          </div>
                        </div>

                        {change.change_type === 'update' && (
                          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">Old Value</div>
                              <div className="p-2 bg-red-500/10 rounded border border-red-500/20 text-red-600">
                                {change.old_value || '(empty)'}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">New Value</div>
                              <div className="p-2 bg-green-500/10 rounded border border-green-500/20 text-green-600">
                                {change.new_value || '(empty)'}
                              </div>
                            </div>
                          </div>
                        )}

                        {change.change_type === 'create' && (
                          <div className="text-sm">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Value</div>
                            <div className="p-2 bg-green-500/10 rounded border border-green-500/20 text-green-600">
                              {change.new_value}
                            </div>
                          </div>
                        )}

                        {change.validation_status && (
                          <Badge variant="outline" className="text-xs">
                            Status: {change.validation_status}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
