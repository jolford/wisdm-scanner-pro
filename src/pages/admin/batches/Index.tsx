import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, FolderOpen, Clock, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { safeInvokeEdgeFunction } from '@/lib/edge-function-helper';
import { useTranslation } from 'react-i18next';

const BatchesIndex = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [compact, setCompact] = useState(false);
  const { t } = useTranslation();

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          projects (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-500',
      scanning: 'bg-purple-500',
      indexing: 'bg-yellow-500',
      validation: 'bg-orange-500',
      validated: 'bg-teal-500',
      complete: 'bg-green-500',
      exported: 'bg-gray-500',
      error: 'bg-red-500',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      new: FolderOpen,
      scanning: Clock,
      indexing: Clock,
      validation: AlertCircle,
      validated: CheckCircle2,
      complete: CheckCircle2,
      exported: CheckCircle2,
      error: AlertCircle,
    };
    const Icon = icons[status as keyof typeof icons] || FolderOpen;
    return <Icon className="h-4 w-4" />;
  };

  const statusToTab: Record<string, string> = {
    new: 'scan', scanning: 'scan', indexing: 'validation', validation: 'validation', validated: 'export', complete: 'export', exported: 'export'
  };

  const openBatchInQueue = (batch: any, tab?: string) => {
    const targetTab = tab || statusToTab[batch.status] || 'scan';
    sessionStorage.setItem('selectedBatchId', batch.id);
    sessionStorage.setItem('selectedProjectId', batch.project_id);
    navigate(`/?tab=${targetTab}`);
  };

  const handleDelete = async (e: React.MouseEvent, batchId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this batch? This action cannot be undone.')) return;
    const { data, error } = await safeInvokeEdgeFunction('delete-batch-safe', { body: { batchId } });
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: 'Failed to delete batch', variant: 'destructive' });
      return;
    }
    toast({ title: 'Batch Deleted', description: 'The batch was deleted.' });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('batchesAdmin.back')}
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{t('batchesAdmin.title')}</h1>
              <p className="text-muted-foreground">{t('batchesAdmin.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/admin/batches/new')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('batchesAdmin.create')}
            </Button>
            <Button variant="outline" onClick={() => setCompact((v) => !v)} aria-pressed={compact}>
              {compact ? t('batchesAdmin.expand') : t('batchesAdmin.compact')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {batches?.map((batch) => (
            <Card
              key={batch.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/batches/${batch.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{batch.batch_name}</h3>
                    <Badge className={getStatusColor(batch.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(batch.status)}
                        {batch.status}
                      </span>
                    </Badge>
                    {batch.priority && (
                      <Badge className={
                        batch.priority === 3 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        batch.priority === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }>
                        {batch.priority === 3 ? 'High' : batch.priority === 2 ? 'Medium' : 'Low'} Priority
                      </Badge>
                    )}
                  </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Project: {batch.projects?.name}
                </p>
                  {!compact && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span className="font-semibold">
                          {batch.total_documents > 0 ? Math.round((batch.validated_documents / batch.total_documents) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${batch.total_documents > 0 ? (batch.validated_documents / batch.total_documents) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {!compact && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">{t('batchesAdmin.totalDocs')}</p>
                        <p className="text-2xl font-bold">{batch.total_documents}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">{t('batchesAdmin.processed')}</p>
                        <p className="text-2xl font-bold">{batch.processed_documents}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">{t('batchesAdmin.validated')}</p>
                        <p className="text-2xl font-bold">{batch.validated_documents}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">{t('batchesAdmin.errors')}</p>
                        <p className="text-2xl font-bold text-destructive">{batch.error_count}</p>
                      </div>
                    </div>
                  )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">{t('batchesAdmin.openInQueue')}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openBatchInQueue(batch, 'scan')}>{t('batchesAdmin.tabs.scan')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBatchInQueue(batch, 'validation')}>{t('batchesAdmin.tabs.validation')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBatchInQueue(batch, 'export')}>{t('batchesAdmin.tabs.export')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="icon" variant="outline" onClick={(e) => handleDelete(e, batch.id)} title={t('batchesAdmin.delete')!}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            </Card>
          ))}
        </div>

        {(!batches || batches.length === 0) && (
          <Card className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">{t('batchesAdmin.emptyTitle')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('batchesAdmin.emptyDescription')}
            </p>
            <Button onClick={() => navigate('/admin/batches/new')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('batchesAdmin.create')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BatchesIndex;
