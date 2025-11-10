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

const ExceptionQueue = () => {
  const { loading } = useRequireAuth(true);
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
      toast.success('Exception resolved successfully');
      setResolveDialog({ open: false });
      setResolutionNotes('');
    },
    onError: (error) => {
      toast.error('Failed to resolve exception: ' + error.message);
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
      toast.success('Status updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
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
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'high': return <Badge variant="destructive" className="bg-warning">High</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'in_review': return <Badge variant="default">In Review</Badge>;
      case 'resolved': return <Badge variant="default" className="bg-success">Resolved</Badge>;
      case 'ignored': return <Badge variant="outline">Ignored</Badge>;
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
      title="Exception Queue" 
      description="Review and resolve documents that failed validation or require attention"
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.in_review}</div>
              <p className="text-xs text-muted-foreground">Being processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">Successfully handled</p>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Critical
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">Requires immediate action</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Exceptions</CardTitle>
                <CardDescription>Filter and manage document exceptions</CardDescription>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
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
                        Type: {exception.exception_type.replace(/_/g, ' ')}
                      </p>
                    </div>

                    {exception.resolution_notes && (
                      <div className="bg-success/10 p-3 rounded border border-success/20">
                        <p className="text-xs text-success font-medium mb-1">Resolution Notes:</p>
                        <p className="text-sm">{exception.resolution_notes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Link to={`/batches/${exception.batch_id}`}>
                        <Button size="sm" variant="outline">View Document</Button>
                      </Link>
                      
                      {exception.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: exception.id, status: 'in_review' })}
                          >
                            Start Review
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setResolveDialog({ open: true, exceptionId: exception.id })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Resolve
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
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: exception.id, status: 'ignored' })}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Ignore
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
                  <p>No exceptions found</p>
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
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Add notes about how this exception was resolved
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe the resolution..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false })}>
              Cancel
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
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve Exception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ExceptionQueue;
