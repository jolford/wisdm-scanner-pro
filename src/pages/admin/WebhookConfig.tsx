import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Webhook, Plus, Trash2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const EVENT_TYPES = [
  { value: 'batch.completed', label: 'Batch Completed' },
  { value: 'batch.failed', label: 'Batch Failed' },
  { value: 'document.validated', label: 'Document Validated' },
  { value: 'document.exception', label: 'Document Exception' },
  { value: 'validation.low_confidence', label: 'Low Confidence Detection' },
  { value: 'duplicate.detected', label: 'Duplicate Detected' },
  { value: 'fraud.detected', label: 'Fraud Detected' },
];

const WebhookConfig = () => {
  const { loading } = useRequireAuth(true);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    is_active: true,
  });

  const { data: webhooks } = useQuery({
    queryKey: ['webhook-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['webhook-logs-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select(`
          *,
          webhook_config:webhook_configs(name, url)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const user = await supabase.auth.getUser();
      const { data: userCustomers } = await supabase
        .from('user_customers')
        .select('customer_id')
        .eq('user_id', user.data.user?.id)
        .single();

      if (!userCustomers?.customer_id) {
        throw new Error('No customer association found');
      }

      const webhookData = {
        ...data,
        customer_id: userCustomers.customer_id,
        created_by: user.data.user?.id,
      };

      if (editingWebhook) {
        const { error } = await supabase
          .from('webhook_configs')
          .update(webhookData)
          .eq('id', editingWebhook.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('webhook_configs')
          .insert([webhookData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success(editingWebhook ? 'Webhook updated' : 'Webhook created');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Failed to save webhook: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success('Webhook deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete webhook: ' + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('webhook_configs')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success('Webhook status updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update webhook: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      secret: '',
      events: [],
      is_active: true,
    });
    setEditingWebhook(null);
  };

  const handleEdit = (webhook: any) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events || [],
      is_active: webhook.is_active,
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout 
      title="Webhook Configuration" 
      description="Configure webhooks for real-time notifications"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Active Webhooks
                </CardTitle>
                <CardDescription>
                  Receive real-time notifications when events occur
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingWebhook ? 'Edit' : 'Add'} Webhook</DialogTitle>
                    <DialogDescription>
                      Configure a webhook endpoint to receive event notifications
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Webhook"
                      />
                    </div>

                    <div>
                      <Label htmlFor="url">URL</Label>
                      <Input
                        id="url"
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://api.example.com/webhooks"
                      />
                    </div>

                    <div>
                      <Label htmlFor="secret">Secret (Optional)</Label>
                      <Input
                        id="secret"
                        type="password"
                        value={formData.secret}
                        onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                        placeholder="Leave empty to skip signature verification"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Used to generate HMAC-SHA256 signature in X-Webhook-Signature header
                      </p>
                    </div>

                    <div>
                      <Label>Events to Subscribe</Label>
                      <div className="space-y-2 mt-2">
                        {EVENT_TYPES.map((event) => (
                          <div key={event.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={event.value}
                              checked={formData.events.includes(event.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    events: [...formData.events, event.value],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    events: formData.events.filter((e) => e !== event.value),
                                  });
                                }
                              }}
                            />
                            <label htmlFor={event.value} className="text-sm cursor-pointer">
                              {event.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate(formData)}
                      disabled={!formData.name || !formData.url || formData.events.length === 0 || saveMutation.isPending}
                    >
                      {saveMutation.isPending ? 'Saving...' : editingWebhook ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {webhooks?.map((webhook: any) => (
                <div key={webhook.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{webhook.name}</span>
                      {webhook.is_active ? (
                        <Badge variant="default" className="bg-success">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{webhook.url}</p>
                    <div className="flex flex-wrap gap-1">
                      {(webhook.events as string[]).map((event: string) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    {webhook.last_triggered_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: webhook.id, is_active: checked })
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(webhook)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Delete this webhook?')) {
                          deleteMutation.mutate(webhook.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {webhooks?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No webhooks configured yet</p>
                  <p className="text-sm">Create your first webhook to start receiving notifications</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Deliveries</CardTitle>
            <CardDescription>Latest webhook delivery attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLogs?.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded text-sm">
                  <div className="flex items-center gap-3">
                    {log.response_status && log.response_status >= 200 && log.response_status < 300 ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">{log.webhook_config?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.event_type} • Attempt {log.attempt_number}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {log.response_status && (
                      <Badge variant={log.response_status < 300 ? 'default' : 'destructive'}>
                        {log.response_status}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              {recentLogs?.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No deliveries yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default WebhookConfig;
