/**
 * Batch Selector Component
 * 
 * UI component for selecting and creating document processing batches within a project.
 * Provides dropdown selection for existing batches and a dialog for creating new batches.
 * 
 * Features:
 * - Dropdown list of active batches (status: new, scanning, indexing)
 * - Real-time batch data loading via React Query
 * - "Create New Batch" dialog with name and priority inputs
 * - Priority selection (Low=0, Normal=5, High=10, Urgent=20)
 * - Automatic batch selection after creation
 * - Status and priority badges for visual identification
 * - Keyboard shortcuts (Enter to create)
 * 
 * Props:
 * @param selectedBatchId - Currently selected batch ID
 * @param onBatchSelect - Callback when batch is selected (id, batch object)
 * @param projectId - Project context for filtering batches
 * 
 * Business Logic:
 * - Only shows active batches (not completed/exported)
 * - Sorted by priority (high to low) then creation date
 * - Associated with authenticated user (created_by)
 * - Enables load balancing via priority system
 * 
 * @requires useAuth - For user ID
 * @requires useQuery - For data fetching
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FolderOpen, Plus, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

// Component props interface
interface BatchSelectorProps {
  selectedBatchId: string | null;           // Currently selected batch
  onBatchSelect: (id: string | null, batch: any) => void;  // Selection callback
  projectId: string | null;                 // Project context
}

export const BatchSelector = ({ selectedBatchId, onBatchSelect, projectId }: BatchSelectorProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [priority, setPriority] = useState(5);
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
        title: t('batch.batchNameRequired'),
        description: t('batch.enterBatchName'),
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
          priority: priority,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: t('batch.batchCreated'),
        description: t('batch.batchCreatedSuccess'),
      });

      setBatchName('');
      setPriority(5);
      setDialogOpen(false);
      await refetch();
      
      if (data) {
        onBatchSelect(data.id, data);
      }
    } catch (error: any) {
      console.error('Error creating batch:', error);
      toast({
        title: t('batch.creationFailed'),
        description: error.message || t('batch.failedToCreateBatch'),
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
          {t('batch.selectBatch')}
        </Label>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              {t('batch.newBatch')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('batch.createNew')}</DialogTitle>
              <DialogDescription>
                {t('batch.createNewBatchFor')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="batch-name">{t('batch.name')}</Label>
                <Input
                  id="batch-name"
                  placeholder={t('batch.batchNamePlaceholder')}
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBatch();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t('batch.priorityLabel')}
                </Label>
                <Select
                  value={priority.toString()}
                  onValueChange={(value) => setPriority(parseInt(value))}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('batch.low')} (0)</SelectItem>
                    <SelectItem value="5">{t('batch.normal')} (5)</SelectItem>
                    <SelectItem value="10">{t('batch.high')} (10)</SelectItem>
                    <SelectItem value="20">{t('batch.urgent')} (20)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setBatchName('');
                  setPriority(5);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreateBatch} disabled={isCreating}>
                {isCreating ? t('batch.creating') : t('batch.createBatch')}
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
            isLoading ? t('batch.loadingBatches') :
            !batches || batches.length === 0 ? t('batch.noActiveBatches') :
            t('batch.selectABatch')
          } />
        </SelectTrigger>
        <SelectContent>
          {batches?.map((batch) => (
            <SelectItem key={batch.id} value={batch.id}>
              <div className="flex items-center justify-between w-full gap-2">
                <span>{batch.batch_name}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {batch.status}
                  </Badge>
                  {batch.priority > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      P{batch.priority}
                    </Badge>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
