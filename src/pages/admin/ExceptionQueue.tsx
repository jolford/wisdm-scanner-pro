import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, Clock, FileText, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';

const ExceptionQueue = () => {
  const { loading } = useRequireAuth(true);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; exceptionId?: string }>({ open: false });
  const [resolutionNotes, setResolutionNotes] = useState('');

  const { data: exceptions } = useQuery({
    queryKey: ['document-exceptions', selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('document_exceptions')
        .select(`
          *,
          document:documents(
            id,
            file_name,
            validation_status,
            batch:batches(
              id,
              batch_name,
              project:projects(name)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('document_exceptions')
        .update({
          status: 'resolved',
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq('id', id);

      if (error) throw error;
    },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['document-exceptions'] });
    toast.success(t('exceptions.toast.resolveSuccess'));
    setResolveDialog({ open: false });
    setResolutionNotes('');
  },
  onError: (error) => {
    toast.error(t('exceptions.toast.resolveError') + ': ' + (error as any).message);
  },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('document_exceptions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['document-exceptions'] });
    toast.success(t('exceptions.toast.statusSuccess'));
  },
  onError: (error) => {
    toast.error(t('exceptions.toast.statusError') + ': ' + (error as any).message);
  },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-warning" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">{t('exceptions.severity.critical')}</Badge>;
      case 'high': return <Badge variant="destructive" className="bg-warning">{t('exceptions.severity.high')}</Badge>;
      case 'medium': return <Badge variant="secondary">{t('exceptions.severity.medium')}</Badge>;
      default: return <Badge variant="outline">{t('exceptions.severity.low')}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">{t('exceptions.status.pending')}</Badge>;
      case 'in_review': return <Badge variant="default">{t('exceptions.status.in_review')}</Badge>;
      case 'resolved': return <Badge variant="default" className="bg-success">{t('exceptions.status.resolved')}</Badge>;
      case 'ignored': return <Badge variant="outline">{t('exceptions.status.ignored')}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const stats = {
    pending: exceptions?.filter(e => e.status === 'pending').length || 0,
    in_review: exceptions?.filter(e => e.status === 'in_review').length || 0,
    resolved: exceptions?.filter(e => e.status === 'resolved').length || 0,
    critical: exceptions?.filter(e => e.severity === 'critical').length || 0,
  };

  return (
    <AdminLayout 
      title={t('exceptions.title')} 
      description={t('exceptions.description')}
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('exceptions.stats.pending')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">{t('exceptions.stats.pendingCaption')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('exceptions.stats.inReview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.in_review}</div>
              <p className="text-xs text-muted-foreground">{t('exceptions.stats.inReviewCaption')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('exceptions.stats.resolved')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">{t('exceptions.stats.resolvedCaption')}</p>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('exceptions.stats.critical')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">{t('exceptions.stats.criticalCaption')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('exceptions.listTitle')}</CardTitle>
                <CardDescription>{t('exceptions.listDescription')}</CardDescription>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('exceptions.filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('exceptions.status.all')}</SelectItem>
                  <SelectItem value="pending">{t('exceptions.status.pending')}</SelectItem>
                  <SelectItem value="in_review">{t('exceptions.status.in_review')}</SelectItem>
                  <SelectItem value="resolved">{t('exceptions.status.resolved')}</SelectItem>
                  <SelectItem value="ignored">{t('exceptions.status.ignored')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {exceptions?.map((exception: any) => (
                <div key={exception.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="mt-1">
                    {getSeverityIcon(exception.severity)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{exception.document.file_name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {exception.document.batch.project.name} • {exception.document.batch.batch_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(exception.severity)}
                        {getStatusBadge(exception.status)}
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="text-sm font-medium mb-1">{exception.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('exceptions.type')}: {exception.exception_type.replace(/_/g, ' ')}
                      </p>
                    </div>

                    {exception.resolution_notes && (
                      <div className="bg-success/10 p-3 rounded border border-success/20">
                        <p className="text-xs text-success font-medium mb-1">{t('exceptions.resolutionNotes')}:</p>
                        <p className="text-sm">{exception.resolution_notes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Link to={`/batches/${exception.batch_id}`}>
                        <Button size="sm" variant="outline">{t('exceptions.actions.viewDocument')}</Button>
                      </Link>
                      
                      {exception.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: exception.id, status: 'in_review' })}
                          >
                            {t('exceptions.actions.startReview')}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setResolveDialog({ open: true, exceptionId: exception.id })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {t('exceptions.actions.resolve')}
                          </Button>
                        </>
                      )}

                      {exception.status === 'in_review' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setResolveDialog({ open: true, exceptionId: exception.id })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {t('exceptions.actions.resolve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: exception.id, status: 'ignored' })}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {t('exceptions.actions.ignore')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {exceptions?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('exceptions.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialog.open} onOpenChange={(open) => setResolveDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exceptions.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('exceptions.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('exceptions.dialog.placeholder')}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false })}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (resolveDialog.exceptionId) {
                  resolveMutation.mutate({
                    id: resolveDialog.exceptionId,
                    notes: resolutionNotes,
                  });
                }
              }}
              disabled={!resolutionNotes.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? t('exceptions.dialog.resolving') : t('exceptions.dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ExceptionQueue;
