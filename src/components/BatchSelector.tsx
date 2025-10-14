import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FolderOpen } from 'lucide-react';

interface BatchSelectorProps {
  selectedBatchId: string | null;
  onBatchSelect: (id: string | null, batch: any) => void;
  projectId: string | null;
}

export const BatchSelector = ({ selectedBatchId, onBatchSelect, projectId }: BatchSelectorProps) => {
  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['new', 'scanning', 'indexing'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  if (!projectId) return null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4" />
        Select Batch
      </Label>
      <Select
        value={selectedBatchId || ''}
        onValueChange={(value) => {
          const batch = batches?.find(b => b.id === value);
          onBatchSelect(value, batch);
        }}
        disabled={isLoading || !batches || batches.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder={
            isLoading ? 'Loading batches...' :
            !batches || batches.length === 0 ? 'No active batches' :
            'Select a batch'
          } />
        </SelectTrigger>
        <SelectContent>
          {batches?.map((batch) => (
            <SelectItem key={batch.id} value={batch.id}>
              {batch.batch_name} ({batch.status})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
