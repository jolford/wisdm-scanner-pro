import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { 
  Terminal, 
  Server, 
  Plus, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  RefreshCw,
  Trash2,
  Copy,
  Eye
} from 'lucide-react';

export default function ScriptAgents() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('agents');
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Form states
  const [agentName, setAgentName] = useState('');
  const [machineName, setMachineName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('powershell');
  const [templateContent, setTemplateContent] = useState('');
  const [templateTriggers, setTemplateTriggers] = useState({
    document_upload: false,
    validation_complete: false,
    batch_export: false,
    batch_complete: false
  });

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch agents
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['script-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('script_agents')
        .select('*, customers(company_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['script-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('script_templates')
        .select('*, customers(company_name), projects(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch jobs
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['script-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('script_jobs')
        .select('*, script_agents(name), customers(company_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  // Register agent mutation
  const registerAgent = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('script-agent-api/register', {
        body: {
          customer_id: selectedCustomerId,
          name: agentName,
          machine_name: machineName
        }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setNewApiKey(data.api_key);
      queryClient.invalidateQueries({ queryKey: ['script-agents'] });
      toast.success('Agent registered successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to register agent: ${error.message}`);
    }
  });

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('script_templates')
        .insert({
          customer_id: selectedCustomerId,
          name: templateName,
          description: templateDescription,
          script_language: templateLanguage,
          script_content: templateContent,
          trigger_on_document_upload: templateTriggers.document_upload,
          trigger_on_validation_complete: templateTriggers.validation_complete,
          trigger_on_batch_export: templateTriggers.batch_export,
          trigger_on_batch_complete: templateTriggers.batch_complete,
          created_by: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setTemplateDialogOpen(false);
      resetTemplateForm();
      queryClient.invalidateQueries({ queryKey: ['script-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to create template: ${error.message}`);
    }
  });

  // Delete agent mutation
  const deleteAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('script_agents')
        .delete()
        .eq('id', agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-agents'] });
      toast.success('Agent deleted');
    }
  });

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateDescription('');
    setTemplateLanguage('powershell');
    setTemplateContent('');
    setTemplateTriggers({
      document_upload: false,
      validation_complete: false,
      batch_export: false,
      batch_complete: false
    });
  };

  const isAgentOnline = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return false;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'assigned':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Assigned</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><Play className="h-3 w-3 mr-1" />Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout title="Script Agents">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Terminal className="h-8 w-8" />
              Script Agents
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage Windows agents that execute PowerShell, VBScript, Python, and Batch scripts
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/downloads/windows-agent/README.md" download>
              <Download className="h-4 w-4 mr-2" />
              Download Agent
            </a>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="agents">
              <Server className="h-4 w-4 mr-2" />
              Agents ({agents?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Terminal className="h-4 w-4 mr-2" />
              Templates ({templates?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Play className="h-4 w-4 mr-2" />
              Jobs ({jobs?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Windows agents poll for script jobs and execute them locally with full system access.
              </p>
              <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Register Agent
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register New Agent</DialogTitle>
                    <DialogDescription>
                      Create an API key for a new Windows agent installation.
                    </DialogDescription>
                  </DialogHeader>
                  {newApiKey ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                          Agent registered! Copy this API key:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 bg-background rounded text-xs break-all">
                            {newApiKey}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(newApiKey);
                              toast.success('Copied to clipboard');
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          ⚠️ This key is shown only once. Store it securely!
                        </p>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          setNewApiKey(null);
                          setRegisterDialogOpen(false);
                          setAgentName('');
                          setMachineName('');
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers?.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Agent Name</Label>
                        <Input 
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          placeholder="e.g., Office Server Agent"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Machine Name (optional)</Label>
                        <Input 
                          value={machineName}
                          onChange={(e) => setMachineName(e.target.value)}
                          placeholder="e.g., WORKSTATION-01"
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => registerAgent.mutate()}
                        disabled={!selectedCustomerId || !agentName || registerAgent.isPending}
                      >
                        {registerAgent.isPending ? 'Registering...' : 'Register Agent'}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents?.map(agent => (
                <Card key={agent.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        {agent.name}
                      </CardTitle>
                      {isAgentOnline(agent.last_heartbeat_at) ? (
                        <Badge className="bg-green-500">Online</Badge>
                      ) : (
                        <Badge variant="secondary">Offline</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {(agent.customers as any)?.company_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {agent.machine_name && (
                      <p className="text-muted-foreground">Machine: {agent.machine_name}</p>
                    )}
                    <p className="text-muted-foreground">
                      Languages: {agent.supported_languages?.join(', ')}
                    </p>
                    {agent.last_heartbeat_at && (
                      <p className="text-muted-foreground">
                        Last seen: {formatDistanceToNow(new Date(agent.last_heartbeat_at), { addSuffix: true })}
                      </p>
                    )}
                    {agent.last_ip_address && (
                      <p className="text-muted-foreground text-xs">
                        IP: {agent.last_ip_address}
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Delete this agent? The API key will be invalidated.')) {
                            deleteAgent.mutate(agent.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {agents?.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No agents registered yet.</p>
                    <p className="text-sm">Register an agent to start executing scripts.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Script templates define reusable scripts that can be triggered by events or run manually.
              </p>
              <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Script Template</DialogTitle>
                    <DialogDescription>
                      Define a reusable script that can be triggered by document events.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers?.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="powershell">PowerShell</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="vbscript">VBScript</SelectItem>
                            <SelectItem value="batch">Batch</SelectItem>
                            <SelectItem value="javascript">JavaScript (Node.js)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Template Name</Label>
                      <Input 
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., Export to Network Drive"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input 
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        placeholder="What does this script do?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Script Content</Label>
                      <Textarea 
                        value={templateContent}
                        onChange={(e) => setTemplateContent(e.target.value)}
                        placeholder={templateLanguage === 'powershell' 
                          ? '# PowerShell script\n$params = $env:WISDM_PARAMS | ConvertFrom-Json\nWrite-Host "Processing document: $($params.document_id)"'
                          : '# Your script here'}
                        className="font-mono text-sm min-h-[200px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Parameters are available as environment variables: WISDM_PARAMS (JSON), WISDM_DOCUMENT_ID, etc.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Automatic Triggers</Label>
                      <div className="space-y-2">
                        {[
                          { key: 'document_upload', label: 'On Document Upload' },
                          { key: 'validation_complete', label: 'On Validation Complete' },
                          { key: 'batch_export', label: 'On Batch Export' },
                          { key: 'batch_complete', label: 'On Batch Complete' }
                        ].map(trigger => (
                          <div key={trigger.key} className="flex items-center gap-2">
                            <Checkbox 
                              id={trigger.key}
                              checked={templateTriggers[trigger.key as keyof typeof templateTriggers]}
                              onCheckedChange={(checked) => 
                                setTemplateTriggers(prev => ({ ...prev, [trigger.key]: !!checked }))
                              }
                            />
                            <Label htmlFor={trigger.key} className="font-normal">{trigger.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => createTemplate.mutate()}
                      disabled={!selectedCustomerId || !templateName || !templateContent || createTemplate.isPending}
                    >
                      {createTemplate.isPending ? 'Creating...' : 'Create Template'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {templates?.map(template => (
                <Card key={template.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="outline">{template.script_language}</Badge>
                    </div>
                    <CardDescription>
                      {(template.customers as any)?.company_name}
                      {template.description && ` • ${template.description}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {template.trigger_on_document_upload && <Badge variant="secondary">Upload</Badge>}
                      {template.trigger_on_validation_complete && <Badge variant="secondary">Validation</Badge>}
                      {template.trigger_on_batch_export && <Badge variant="secondary">Export</Badge>}
                      {template.trigger_on_batch_complete && <Badge variant="secondary">Complete</Badge>}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline">
                        <Play className="h-3 w-3 mr-1" />
                        Run Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {templates?.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No script templates yet.</p>
                    <p className="text-sm">Create a template to define reusable scripts.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Script execution history and status.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['script-jobs'] })}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Script</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs?.map(job => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.script_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.script_language}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{job.trigger_type}</TableCell>
                      <TableCell>
                        {(job.script_agents as any)?.name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedJob(job)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobs?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No script jobs yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Job Details Dialog */}
        <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Job Details: {selectedJob?.script_name}</DialogTitle>
              <DialogDescription>
                {selectedJob?.id}
              </DialogDescription>
            </DialogHeader>
            {selectedJob && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p>{getStatusBadge(selectedJob.status)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Exit Code</p>
                    <p>{selectedJob.exit_code ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p>{selectedJob.started_at ? new Date(selectedJob.started_at).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p>{selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString() : '-'}</p>
                  </div>
                </div>
                {selectedJob.error_message && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Error</p>
                    <pre className="p-2 bg-destructive/10 rounded text-xs overflow-x-auto">
                      {selectedJob.error_message}
                    </pre>
                  </div>
                )}
                {selectedJob.stdout && (
                  <div>
                    <p className="text-sm font-medium mb-1">Output (stdout)</p>
                    <pre className="p-2 bg-muted rounded text-xs overflow-x-auto max-h-40">
                      {selectedJob.stdout}
                    </pre>
                  </div>
                )}
                {selectedJob.stderr && (
                  <div>
                    <p className="text-sm font-medium text-orange-500 mb-1">Errors (stderr)</p>
                    <pre className="p-2 bg-orange-500/10 rounded text-xs overflow-x-auto max-h-40">
                      {selectedJob.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* n8n Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="https://n8n.io/favicon.ico" alt="n8n" className="h-5 w-5" />
              n8n Integration
            </CardTitle>
            <CardDescription>
              Connect n8n for visual workflow automation without code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              n8n provides a visual workflow builder with 400+ integrations. 
              Connect it to receive document events via webhooks and execute complex automations.
            </p>
            <Button variant="outline" asChild>
              <a href="https://docs.n8n.io/" target="_blank" rel="noopener noreferrer">
                Learn about n8n
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
