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
import { Plus, Play, Edit, Trash2, Clock, Code, CheckCircle, XCircle, FileCode } from 'lucide-react';
import { ProjectSelector } from '@/components/ProjectSelector';

const SCRIPT_TEMPLATES: Record<string, ScriptTemplate[]> = {
  javascript: [
    {
      name: 'Hello World',
      code: `// This is a simple JavaScript template
console.log("Hello, world!");`,
    },
    {
      name: 'Fetch Data from API',
      code: `// Fetch data from a public API
fetch('https://jsonplaceholder.typicode.com/todos/1')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`,
    },
  ],
  python: [
    {
      name: 'Hello World',
      code: `# This is a simple Python template
print("Hello, world!")`,
    },
    {
      name: 'Fetch Data from API',
      code: `# Import the 'requests' library
import requests

# Make an HTTP request to a remote service
response = requests.get('https://jsonplaceholder.typicode.com/todos/1')

# Check the HTTP response status code
if response.status_code == 200:
    # Parse the JSON response body
    data = response.json()
    print(data)
else:
    print('Request failed with status code: {}'.format(response.status_code))`,
    },
  ],
  powershell: [
    {
      name: 'Hello World',
      code: `# This is a simple PowerShell template
Write-Host "Hello, world!"`,
    },
    {
      name: 'Get System Info',
      code: `# Get system information
Get-ComputerInfo`,
    },
  ],
};

// Define the template type
type ScriptTemplate = {
  name: string;
  code: string;
};

export default function CustomScripts() {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<any[]>([]);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
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

  const loadTemplate = (templateIndex: string) => {
    if (!formData.script_language) {
      console.warn('Script language not selected.');
      return;
    }

    const templates = SCRIPT_TEMPLATES[formData.script_language as keyof typeof SCRIPT_TEMPLATES];
    if (templates && templates[parseInt(templateIndex)]) {
      const template = templates[parseInt(templateIndex)];
      setFormData({ ...formData, script_code: template.code });
    } else {
      console.warn('Template not found.');
    }
  };

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
    try {
      const { data: user, error } = await supabase.auth.getUser();
      if (error) throw error;

      const { data: user_customers, error: custError } = await supabase
        .from('user_customers')
        .select('customer_id')
        .eq('user_id', user.user?.id);

      if (custError) throw custError;

      if (user_customers && user_customers.length > 0) {
        setCustomerId(user_customers[0].customer_id);
      } else {
        console.warn('No customer ID found for user.');
      }
    } catch (error: any) {
      console.error('Error fetching customer ID:', error.message);
      toast.error(`Error fetching customer ID: ${error.message}`);
    }
  };

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_scripts')
        .select('*')
        .eq('customer_id', customerId);

      if (error) throw error;
      setScripts(data || []);
    } catch (error: any) {
      console.error('Error fetching scripts:', error.message);
      toast.error(`Error fetching scripts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutionLogs = async () => {
    // Temporarily disabled due to type inference issues
    setExecutionLogs([]);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.script_language || !formData.script_code) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUserId = authData.user?.id;
      if (!currentUserId) throw new Error('User not authenticated');

      if (editingScript) {
        // Update existing script
        const { error } = await supabase
          .from('custom_scripts')
          .update({ ...formData })
          .eq('id', editingScript.id);

        if (error) throw error;
        toast.success('Script updated successfully!');
      } else {
        // Create new script
        const { error } = await supabase
          .from('custom_scripts')
          .insert([{ ...formData, customer_id: customerId, created_by: currentUserId }]);

        if (error) throw error;
        toast.success('Script created successfully!');
      }

      fetchScripts(); // Refresh script list
      setIsDialogOpen(false); // Close dialog
      resetForm(); // Reset form
    } catch (error: any) {
      console.error('Error saving script:', error.message);
      toast.error(`Error saving script: ${error.message}`);
    } finally {
      setLoading(false);
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
      project_id: script.project_id || null,
      is_active: script.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (scriptId: string) => {
    if (window.confirm('Are you sure you want to delete this script?')) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('custom_scripts')
          .delete()
          .eq('id', scriptId);

        if (error) throw error;
        toast.success('Script deleted successfully!');
        fetchScripts(); // Refresh script list
      } catch (error: any) {
        console.error('Error deleting script:', error.message);
        toast.error(`Error deleting script: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExecute = async (scriptId: string) => {
    setLoading(true);
    try {
      // Call the Supabase function to execute the script
      const { data, error } = await supabase.functions.invoke('execute-custom-script', {
        body: { scriptId },
      });

      if (error) {
        throw error;
      }

      toast.success('Script execution started!');
      fetchExecutionLogs(); // Refresh execution logs
    } catch (error: any) {
      console.error('Error executing script:', error.message);
      toast.error(`Error executing script: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingScript(null);
    setSelectedTemplate('');
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
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Script Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Script Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="template">Template</Label>
                  <Select value={selectedTemplate} onValueChange={(value) => {
                    setSelectedTemplate(value);
                    loadTemplate(value);
                  }}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCRIPT_TEMPLATES).map(([language, templates]) => (
                        <div key={language}>
                          <SelectItem disabled value={language} className="font-bold text-gray-500">
                            {language.toUpperCase()}
                          </SelectItem>
                          {templates.map((template, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="script_language">Language *</Label>
                  <Select
                    value={formData.script_language}
                    onValueChange={(value) => setFormData({ ...formData, script_language: value })}
                  >
                    <SelectTrigger id="script_language">
                      <SelectValue placeholder="Select a Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="powershell">PowerShell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="trigger_type">Trigger Type *</Label>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
                  >
                    <SelectTrigger id="trigger_type">
                      <SelectValue placeholder="Select a Trigger Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.trigger_type === 'scheduled' && (
                  <div>
                    <Label htmlFor="schedule_cron">Schedule (Cron Expression)</Label>
                    <Input
                      id="schedule_cron"
                      placeholder="e.g., 0 9 * * *"
                      value={formData.schedule_cron}
                      onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="script_code">Script Code *</Label>
                  <Textarea
                    id="script_code"
                    placeholder="Write your script code here"
                    value={formData.script_code}
                    onChange={(e) => setFormData({ ...formData, script_code: e.target.value })}
                    className="min-h-[200px]"
                  />
                </div>
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div>
                  <Label htmlFor="project">Project (Optional)</Label>
                  <ProjectSelector
                    selectedProjectId={formData.project_id}
                    onProjectSelect={(projectId) =>
                      setFormData({ ...formData, project_id: projectId })
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Script'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Tabs defaultValue="scripts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="executionLogs">Execution Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="scripts" className="space-y-4">
            {loading ? (
              <p>Loading scripts...</p>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {scripts.map((script) => (
                  <Card key={script.id} className="bg-card text-card-foreground shadow-sm">
                    <CardHeader>
                      <CardTitle>{script.name}</CardTitle>
                      <CardDescription>{script.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <FileCode className="h-4 w-4" />
                        <span>{script.script_language}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{script.trigger_type}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Code className="h-4 w-4" />
                        <span className="truncate">{script.project_id}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {script.is_active ? (
                          <Badge variant="outline">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-4 w-4 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(script)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(script.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                        <Button size="sm" onClick={() => handleExecute(script.id)} disabled={loading}>
                          <Play className="h-4 w-4 mr-2" />
                          Execute
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="executionLogs" className="space-y-4">
            {loading ? (
              <p>Loading execution logs...</p>
            ) : (
              <div className="grid gap-4 grid-cols-1">
                {executionLogs.map((log) => (
                  <Card key={log.id} className="bg-card text-card-foreground shadow-sm">
                    <CardHeader>
                      <CardTitle>Script Execution</CardTitle>
                      <CardDescription>
                        Script ID: {log.script_id} - {new Date(log.created_at).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p>Status: {log.status}</p>
                      {log.log_output && (
                        <div>
                          <p>Output:</p>
                          <pre className="bg-muted rounded-md p-2 overflow-x-auto">
                            {log.log_output}
                          </pre>
                        </div>
                      )}
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
