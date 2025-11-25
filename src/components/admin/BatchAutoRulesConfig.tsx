import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export const BatchAutoRulesConfig = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [triggerType, setTriggerType] = useState('document_type');
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [templateId, setTemplateId] = useState('');
  const [conditions, setConditions] = useState('{}');
  const [triggerSchedule, setTriggerSchedule] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['batch-templates', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batch_templates')
        .select('*')
        .eq('customer_id', selectedCustomerId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: autoRules } = useQuery({
    queryKey: ['batch-auto-rules', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batch_auto_rules')
        .select(`
          *,
          batch_templates (name)
        `)
        .eq('customer_id', selectedCustomerId)
        .order('priority', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('batch_auto_rules')
        .insert({
          customer_id: selectedCustomerId,
          template_id: templateId,
          name: ruleName,
          trigger_type: triggerType,
          priority,
          is_active: isActive,
          conditions: JSON.parse(conditions),
          trigger_schedule: triggerSchedule || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-auto-rules'] });
      toast.success('Auto-application rule created');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Failed to create rule: ' + error.message);
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('batch_auto_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-auto-rules'] });
      toast.success('Rule deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete rule: ' + error.message);
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('batch_auto_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-auto-rules'] });
      toast.success('Rule status updated');
    },
  });

  const resetForm = () => {
    setRuleName('');
    setTriggerType('document_type');
    setPriority(0);
    setIsActive(true);
    setTemplateId('');
    setConditions('{}');
    setTriggerSchedule('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Batch Template Auto-Application
          </CardTitle>
          <CardDescription>
            Configure rules to automatically apply batch templates based on triggers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomerId && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Auto-Application Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Auto-Application Rule</DialogTitle>
                  <DialogDescription>
                    Configure when and how to automatically apply batch templates
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Rule Name</Label>
                    <Input
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      placeholder="e.g., Auto-apply invoice template"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select value={templateId} onValueChange={setTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates?.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Trigger Type</Label>
                    <Select value={triggerType} onValueChange={setTriggerType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="document_type">Document Type Match</SelectItem>
                        <SelectItem value="project_selection">Project Selection</SelectItem>
                        <SelectItem value="file_pattern">File Name Pattern</SelectItem>
                        <SelectItem value="time_based">Time-Based Schedule</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {triggerType === 'time_based' && (
                    <div className="space-y-2">
                      <Label>Schedule (Cron Format)</Label>
                      <Input
                        value={triggerSchedule}
                        onChange={(e) => setTriggerSchedule(e.target.value)}
                        placeholder="0 9 * * 1-5 (weekdays at 9am)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use cron format: minute hour day month weekday
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Priority (higher = runs first)</Label>
                    <Input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Conditions (JSON)</Label>
                    <Textarea
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder='{"document_type": "invoice", "confidence": 0.8}'
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Define matching conditions as JSON
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <Label>Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => createRule.mutate()} disabled={!ruleName || !templateId}>
                    Create Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {selectedCustomerId && autoRules && autoRules.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Configured Rules</h3>
              {autoRules.map((rule: any) => (
                <Card key={rule.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{rule.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Template: {rule.batch_templates?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Trigger: {rule.trigger_type} | Priority: {rule.priority}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleRule.mutate({ ruleId: rule.id, isActive: checked })
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRule.mutate(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
