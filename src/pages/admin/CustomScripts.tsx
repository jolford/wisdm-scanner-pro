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

const SCRIPT_TEMPLATES = {
  javascript: [
    {
      name: 'Document Export to API',
      description: 'Export validated documents to an external API endpoint',
      code: `// Export document data to external API
const documentId = context.documentId;
const apiEndpoint = 'https://api.example.com/documents';

// Fetch document data
const { data: doc } = await supabase
  .from('documents')
  .select('*, batches(*), projects(*)')
  .eq('id', documentId)
  .single();

// Send to external API
const response = await fetch(apiEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    document_id: doc.id,
    file_name: doc.file_name,
    extracted_data: doc.extracted_metadata,
    batch_name: doc.batches?.batch_name,
    project_name: doc.projects?.name
  })
});

return { success: response.ok, status: response.status };`
    },
    {
      name: 'Batch Validation Rules',
      description: 'Apply custom validation rules to batch documents',
      code: `// Apply custom validation rules
const batchId = context.batchId;

// Get all documents in batch
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('batch_id', batchId);

let validationErrors = [];

for (const doc of documents) {
  const metadata = doc.extracted_metadata || {};
  
  // Example: Check if invoice amount is present
  if (!metadata.invoice_amount) {
    validationErrors.push({
      document_id: doc.id,
      field: 'invoice_amount',
      error: 'Missing invoice amount'
    });
  }
  
  // Example: Validate date format
  if (metadata.invoice_date && !/^\d{2}\/\d{2}\/\d{4}$/.test(metadata.invoice_date)) {
    validationErrors.push({
      document_id: doc.id,
      field: 'invoice_date',
      error: 'Invalid date format'
    });
  }
}

return { 
  success: validationErrors.length === 0,
  errors: validationErrors,
  message: \`Validated \${documents.length} documents, found \${validationErrors.length} errors\`
};`
    },
    {
      name: 'Send Email Notification',
      description: 'Send email notifications when batch completes',
      code: `// Send email notification on batch completion
const batchId = context.batchId;

// Get batch details
const { data: batch } = await supabase
  .from('batches')
  .select('*, projects(name)')
  .eq('id', batchId)
  .single();

// Count documents
const { count } = await supabase
  .from('documents')
  .select('*', { count: 'exact', head: true })
  .eq('batch_id', batchId);

// Send email via your email service
const emailData = {
  to: 'team@example.com',
  subject: \`Batch "\${batch.batch_name}" Completed\`,
  body: \`
    Batch: \${batch.batch_name}
    Project: \${batch.projects?.name}
    Documents Processed: \${count}
    Status: \${batch.status}
    Completed: \${new Date(batch.completed_at).toLocaleString()}
  \`
};

// Call your email service here
console.log('Email notification:', emailData);

return { success: true, recipient: emailData.to };`
    }
  ],
  python: [
    {
      name: 'Document Classification',
      description: 'Classify documents using custom logic',
      code: `# Document classification script
import json

document_id = context.get('documentId')

# Fetch document text
response = supabase.from_('documents').select('extracted_text, file_name').eq('id', document_id).single().execute()
doc = response.data

# Simple classification logic
doc_type = 'unknown'
text = doc['extracted_text'].lower()

if 'invoice' in text or 'bill' in text:
    doc_type = 'invoice'
elif 'contract' in text or 'agreement' in text:
    doc_type = 'contract'
elif 'receipt' in text:
    doc_type = 'receipt'

# Update document type
supabase.from_('documents').update({
    'document_type': doc_type
}).eq('id', document_id).execute()

return {'success': True, 'document_type': doc_type}`
    },
    {
      name: 'Data Transform & Export',
      description: 'Transform extracted data and export to CSV',
      code: `# Transform and export batch data
import csv
import io

batch_id = context.get('batchId')

# Get documents
response = supabase.from_('documents').select('*').eq('batch_id', batch_id).execute()
documents = response.data

# Transform data
rows = []
for doc in documents:
    metadata = doc.get('extracted_metadata', {})
    rows.append({
        'Document ID': doc['id'],
        'File Name': doc['file_name'],
        'Invoice Number': metadata.get('invoice_number', ''),
        'Amount': metadata.get('invoice_amount', ''),
        'Date': metadata.get('invoice_date', ''),
        'Vendor': metadata.get('vendor_name', '')
    })

# Create CSV in memory
output = io.StringIO()
writer = csv.DictWriter(output, fieldnames=rows[0].keys())
writer.writeheader()
writer.writerows(rows)

csv_content = output.getvalue()
print(f"Generated CSV with {len(rows)} rows")

return {'success': True, 'rows': len(rows), 'csv': csv_content[:500]}`
    }
  ],
  powershell: [
    {
      name: 'File System Operations',
      description: 'Copy validated documents to network share',
      code: `# Copy documents to network share
param($context)

$batchId = $context.batchId
$destinationPath = "\\\\server\\share\\validated"

# Get batch documents (would need API integration)
Write-Host "Processing batch: $batchId"

# Example file operations
if (!(Test-Path $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath -Force
}

# Copy files to destination
# Note: Actual file paths would come from document URLs
$exportedCount = 0

Write-Host "Exported $exportedCount documents to $destinationPath"

return @{
    success = $true
    exported = $exportedCount
    destination = $destinationPath
}`
    },
    {
      name: 'Active Directory Integration',
      description: 'Assign batches based on AD groups',
      code: `# Assign batch to user based on AD group
param($context)

$batchId = $context.batchId
$documentType = $context.documentType

# Query Active Directory
Import-Module ActiveDirectory

# Determine assignment based on document type
$assignTo = switch ($documentType) {
    "invoice" { Get-ADGroupMember -Identity "AP-Team" | Select-Object -First 1 }
    "contract" { Get-ADGroupMember -Identity "Legal-Team" | Select-Object -First 1 }
    default { Get-ADGroupMember -Identity "Admin-Team" | Select-Object -First 1 }
}

Write-Host "Assigning batch $batchId to $($assignTo.Name)"

return @{
    success = $true
    assigned_to = $assignTo.SamAccountName
    assigned_name = $assignTo.Name
}`
    }
  ]
};


export default function CustomScripts() {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<any[]>([]);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  
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
    if (!templateIndex) return;
    
    const [lang, idx] = templateIndex.split('-');
    const template = SCRIPT_TEMPLATES[lang as keyof typeof SCRIPT_TEMPLATES]?.[parseInt(idx)];
    
    if (template) {
      setFormData({
        ...formData,
        name: template.name,
        description: template.description,
        script_code: template.code,
        script_language: lang,
      });
      toast.success('Template loaded');
    }
  };

  useEffect(() => {
    fetchCustomerId();
  }, []);

  useEffect(() => {
    if (customerId) {
      fetchScripts();
      fetchExecutionLogs();
      fetchProjects();
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

  const fetchProjects = async () => {
    if (!customerId) return;
    
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      setProjects(data || []);
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
                
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCode className="h-4 w-4" />
                    <Label>Load Template</Label>
                  </div>
                  <Select value={selectedTemplate} onValueChange={(value) => { setSelectedTemplate(value); loadTemplate(value); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template to get started..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>-- Select a template --</SelectItem>
                      {Object.entries(SCRIPT_TEMPLATES).map(([lang, templates]) => (
                        <div key={lang}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">{lang}</div>
                          {templates.map((template, idx) => (
                            <SelectItem key={`${lang}-${idx}`} value={`${lang}-${idx}`}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select a pre-built template to quickly get started with common automation scenarios
                  </p>
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
                  <Select
                    value={formData.project_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      <SelectItem value="none">No Project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <TabsTrigger value="templates">Templates</TabsTrigger>
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

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Script Templates</CardTitle>
                <CardDescription>
                  Pre-built templates to get started quickly with common automation scenarios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(SCRIPT_TEMPLATES).map(([lang, templates]) => (
                  <div key={lang}>
                    <h3 className="text-lg font-semibold mb-3 capitalize">{lang}</h3>
                    <div className="grid gap-4">
                      {templates.map((template, idx) => (
                        <Card key={`${lang}-${idx}`} className="border-muted">
                          <CardHeader>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <CardDescription>{template.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-muted/50 p-4 rounded-md">
                              <pre className="text-xs overflow-x-auto">
                                <code>{template.code.substring(0, 200)}...</code>
                              </pre>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  setSelectedTemplate(`${lang}-${idx}`);
                                  loadTemplate(`${lang}-${idx}`);
                                  setIsDialogOpen(true);
                                }}
                              >
                                Use Template
                              </Button>
                              <Badge variant="outline">{lang}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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
