import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface RecentBatchesWidgetProps {
  config: {
    limit?: number;
    showStatus?: boolean;
  };
}

export function RecentBatchesWidget({ config }: RecentBatchesWidgetProps) {
  const navigate = useNavigate();
  
  const { data: batches, isLoading } = useQuery({
    queryKey: ['recent-batches', config],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_name, status, total_documents, created_at')
        .order('created_at', { ascending: false })
        .limit(config.limit || 5);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Batches
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : batches && batches.length > 0 ? (
          <div className="space-y-2">
            {batches.map((batch) => (
              <Button
                key={batch.id}
                variant="ghost"
                className="w-full justify-between"
                onClick={() => navigate(`/admin/batches/${batch.id}`)}
              >
                <span className="truncate">{batch.batch_name}</span>
                {config.showStatus && (
                  <Badge variant="secondary" className="ml-2">
                    {batch.total_documents || 0}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No batches yet</p>
        )}
      </CardContent>
    </Card>
  );
}
