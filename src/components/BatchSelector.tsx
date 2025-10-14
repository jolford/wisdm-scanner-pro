import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FolderOpen, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface BatchSelectorProps {
  selectedBatchId: string | null;
  onBatchSelect: (id: string | null, batch: any) => void;
  projectId: string | null;
}

export const BatchSelector = ({ selectedBatchId, onBatchSelect, projectId }: BatchSelectorProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: batches, isLoading, refetch } = useQuery({
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

  const handleCreateBatch = async () => {
    if (!batchName.trim()) {
      toast({
        title: 'Batch Name Required',
        description: 'Please enter a name for the batch',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('batches')
        .insert([{
          batch_name: batchName,
          project_id: projectId,
          created_by: user?.id,
          priority: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Batch Created',
        description: 'New batch created successfully',
      });

      setBatchName('');
      setDialogOpen(false);
      await refetch();
      
      if (data) {
        onBatchSelect(data.id, data);
      }
    } catch (error: any) {
      console.error('Error creating batch:', error);
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create batch',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!projectId) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Select Batch
        </Label>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              New Batch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
              <DialogDescription>
                Create a new document processing batch for the selected project
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="batch-name">Batch Name</Label>
                <Input
                  id="batch-name"
                  placeholder="e.g., Invoice Batch - January 2025"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBatch();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setBatchName('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateBatch} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Batch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Select
        value={selectedBatchId || ''}
        onValueChange={(value) => {
          const batch = batches?.find(b => b.id === value);
          onBatchSelect(value, batch);
        }}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={
            isLoading ? 'Loading batches...' :
            !batches || batches.length === 0 ? 'No active batches - create one above' :
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
