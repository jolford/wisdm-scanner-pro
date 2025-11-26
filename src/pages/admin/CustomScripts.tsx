import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Play, Edit, Trash2, Clock, Code, CheckCircle, XCircle } from 'lucide-react';
import { ProjectSelector } from '@/components/ProjectSelector';

export default function CustomScripts() {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<any[]>([]);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    script_language: 'javascript',
    script_code: '// Write your script here\n',
    trigger_type: 'manual',
    schedule_cron: '',
    project_id: null as string | null,
    is_active: true,
  });

  useEffect(() => {
    fetchCustomerId();
  }, []);

  useEffect(() => {
    if (customerId) {
      fetchScripts();
      fetchExecutionLogs();
    }
  }, [customerId]);

  const fetchCustomerId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userCustomer } = await supabase
      .from('user_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .single();

    if (userCustomer) {
      setCustomerId(userCustomer.customer_id);
    }
  };

  const fetchScripts = async () => {
    if (!customerId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_scripts')
      .select('*, projects(name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scripts:', error);
      toast.error('Failed to load scripts');
    } else {
      setScripts(data || []);
    }
    setLoading(false);
  };

  const fetchExecutionLogs = async () => {
    if (!customerId) return;
    
    const { data, error } = await supabase
      .from('script_execution_logs')
      .select('*, custom_scripts(name)')
      .order('executed_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setExecutionLogs(data || []);
    }
  };

  const handleSave = async () => {
    if (!customerId) return;
    if (!formData.name || !formData.script_code) {
      toast.error('Please fill in all required fields');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const scriptData = {
      ...formData,
      customer_id: customerId,
      created_by: user.id,
    };

    if (editingScript) {
      const { error } = await supabase
        .from('custom_scripts')
        .update(scriptData)
        .eq('id', editingScript.id);

      if (error) {
        console.error('Error updating script:', error);
        toast.error('Failed to update script');
      } else {
        toast.success('Script updated successfully');
        setIsDialogOpen(false);
        resetForm();
        fetchScripts();
      }
    } else {
      const { error } = await supabase
        .from('custom_scripts')
        .insert(scriptData);

      if (error) {
        console.error('Error creating script:', error);
        toast.error('Failed to create script');
      } else {
        toast.success('Script created successfully');
        setIsDialogOpen(false);
        resetForm();
        fetchScripts();
      }
    }
  };

  const handleEdit = (script: any) => {
    setEditingScript(script);
    setFormData({
      name: script.name,
      description: script.description || '',
      script_language: script.script_language,
      script_code: script.script_code,
      trigger_type: script.trigger_type,
      schedule_cron: script.schedule_cron || '',
      project_id: script.project_id,
      is_active: script.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (scriptId: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return;

    const { error } = await supabase
      .from('custom_scripts')
      .delete()
      .eq('id', scriptId);

    if (error) {
      console.error('Error deleting script:', error);
      toast.error('Failed to delete script');
    } else {
      toast.success('Script deleted successfully');
      fetchScripts();
    }
  };

  const handleExecute = async (scriptId: string) => {
    toast.info('Executing script...');
    
    const { data, error } = await supabase.functions.invoke('execute-custom-script', {
      body: { scriptId },
    });

    if (error) {
      console.error('Script execution error:', error);
      toast.error('Script execution failed');
    } else if (data?.success) {
      toast.success('Script executed successfully');
      fetchExecutionLogs();
    } else {
      toast.error(data?.error || 'Script execution failed');
    }
  };

  const resetForm = () => {
    setEditingScript(null);
    setFormData({
      name: '',
      description: '',
      script_language: 'javascript',
      script_code: '// Write your script here\n',
      trigger_type: 'manual',
      schedule_cron: '',
      project_id: null,
      is_active: true,
    });
  };

  return (
    <AdminLayout title="Custom Scripts" description="Write and execute custom automation scripts">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Custom Scripts</h2>
            <p className="text-muted-foreground">Create custom scripts in JavaScript, Python, PowerShell, and more</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingScript ? 'Edit Script' : 'Create New Script'}</DialogTitle>
                <DialogDescription>
                  Write custom code to automate tasks and extend functionality
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Script Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Custom Script"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What does this script do?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select value={formData.script_language} onValueChange={(value) => setFormData({ ...formData, script_language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="typescript">TypeScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="powershell">PowerShell</SelectItem>
                        <SelectItem value="vbscript">VBScript</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="trigger">Trigger Type</Label>
                    <Select value={formData.trigger_type} onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="workflow">Workflow</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formData.trigger_type === 'scheduled' && (
                  <div>
                    <Label htmlFor="cron">Cron Schedule</Label>
                    <Input
                      id="cron"
                      value={formData.schedule_cron}
                      onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                      placeholder="0 0 * * * (every day at midnight)"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="project">Project (Optional)</Label>
                  <ProjectSelector
                    selectedProjectId={formData.project_id}
                    onProjectSelect={(projectId) => setFormData({ ...formData, project_id: projectId })}
                  />
                </div>
                <div>
                  <Label htmlFor="code">Script Code</Label>
                  <Textarea
                    id="code"
                    value={formData.script_code}
                    onChange={(e) => setFormData({ ...formData, script_code: e.target.value })}
                    placeholder="// Write your script here"
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      {editingScript ? 'Update' : 'Create'} Script
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="scripts">
          <TabsList>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="scripts" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="p-6">Loading...</CardContent>
              </Card>
            ) : scripts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No custom scripts yet. Create your first script to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {scripts.map((script) => (
                  <Card key={script.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Code className="h-5 w-5" />
                            {script.name}
                            {!script.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </CardTitle>
                          <CardDescription>{script.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {script.trigger_type === 'manual' && (
                            <Button size="sm" variant="outline" onClick={() => handleExecute(script.id)}>
                              <Play className="h-4 w-4 mr-1" />
                              Run
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleEdit(script)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(script.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{script.script_language}</Badge>
                        <Badge variant="outline">
                          {script.trigger_type === 'manual' && 'Manual'}
                          {script.trigger_type === 'workflow' && 'Workflow'}
                          {script.trigger_type === 'scheduled' && (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              {script.schedule_cron}
                            </>
                          )}
                        </Badge>
                        {script.projects && <Badge variant="secondary">{script.projects.name}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {executionLogs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No execution logs yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {executionLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {log.status === 'success' ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">{log.custom_scripts?.name}</span>
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                              {log.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.executed_at).toLocaleString()} • {log.execution_duration_ms}ms
                          </p>
                          {log.error_message && (
                            <p className="text-sm text-destructive mt-2">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
