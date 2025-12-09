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
      code: `// Basic script template
// Available context: supabase, user, executionContext, console

console.log("Hello from custom script!");
console.log("Current user:", user.email);

return { success: true, message: "Script executed successfully" };`,
    },
    {
      name: 'Query Documents',
      code: `// Query documents from the database
// The supabase client respects RLS policies

const { data: documents, error } = await supabase
  .from('documents')
  .select('id, file_name, validation_status, confidence_score')
  .eq('validation_status', 'pending')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error("Query error:", error.message);
  return { success: false, error: error.message };
}

console.log(\`Found \${documents.length} pending documents\`);
return { success: true, documents };`,
    },
    {
      name: 'Batch Statistics',
      code: `// Get batch processing statistics

const { data: batches, error } = await supabase
  .from('batches')
  .select(\`
    id,
    batch_name,
    status,
    total_documents,
    processed_documents,
    validated_documents,
    error_count,
    created_at
  \`)
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.error("Query error:", error.message);
  return { success: false, error: error.message };
}

const stats = {
  total: batches.length,
  pending: batches.filter(b => b.status === 'pending').length,
  processing: batches.filter(b => b.status === 'processing').length,
  completed: batches.filter(b => b.status === 'completed').length,
  withErrors: batches.filter(b => b.error_count > 0).length,
};

console.log("Batch Statistics:", JSON.stringify(stats, null, 2));
return { success: true, stats, batches };`,
    },
    {
      name: 'Update Document Metadata',
      code: `// Update document metadata based on conditions
// IMPORTANT: Modify the document IDs and metadata as needed

const documentId = executionContext.documentId; // Pass via execution context
if (!documentId) {
  return { success: false, error: "No documentId provided in execution context" };
}

const { data: doc, error: fetchError } = await supabase
  .from('documents')
  .select('id, extracted_metadata')
  .eq('id', documentId)
  .single();

if (fetchError) {
  console.error("Fetch error:", fetchError.message);
  return { success: false, error: fetchError.message };
}

// Merge new metadata
const updatedMetadata = {
  ...doc.extracted_metadata,
  custom_processed: true,
  processed_at: new Date().toISOString(),
  processed_by_script: true
};

const { error: updateError } = await supabase
  .from('documents')
  .update({ extracted_metadata: updatedMetadata })
  .eq('id', documentId);

if (updateError) {
  console.error("Update error:", updateError.message);
  return { success: false, error: updateError.message };
}

console.log(\`Updated document \${documentId}\`);
return { success: true, documentId, metadata: updatedMetadata };`,
    },
    {
      name: 'External API Integration',
      code: `// Call an external API and process response
// Replace with your actual API endpoint

const apiUrl = "https://api.example.com/data";

try {
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Add your API key if needed
      // "Authorization": "Bearer YOUR_API_KEY"
    }
  });

  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }

  const data = await response.json();
  console.log("API Response:", JSON.stringify(data, null, 2));
  
  return { success: true, data };
} catch (error) {
  console.error("API Error:", error.message);
  return { success: false, error: error.message };
}`,
    },
    {
      name: 'Validation Report',
      code: `// Generate a validation report for a project

const projectId = executionContext.projectId;
if (!projectId) {
  return { success: false, error: "No projectId provided" };
}

const { data: documents, error } = await supabase
  .from('documents')
  .select('id, file_name, validation_status, confidence_score, validated_at')
  .eq('project_id', projectId);

if (error) {
  console.error("Query error:", error.message);
  return { success: false, error: error.message };
}

const report = {
  projectId,
  totalDocuments: documents.length,
  validated: documents.filter(d => d.validation_status === 'validated').length,
  pending: documents.filter(d => d.validation_status === 'pending').length,
  rejected: documents.filter(d => d.validation_status === 'rejected').length,
  averageConfidence: documents.length > 0 
    ? (documents.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / documents.length).toFixed(2)
    : 0,
  lowConfidenceCount: documents.filter(d => (d.confidence_score || 0) < 0.7).length,
  generatedAt: new Date().toISOString()
};

console.log("Validation Report:", JSON.stringify(report, null, 2));
return { success: true, report };`,
    },
    {
      name: 'Cleanup Old Documents',
      code: `// Find documents older than a specified number of days
// NOTE: This only queries - modify to delete if needed

const daysOld = executionContext.daysOld || 90;
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - daysOld);

const { data: oldDocs, error } = await supabase
  .from('documents')
  .select('id, file_name, created_at, validation_status')
  .lt('created_at', cutoffDate.toISOString())
  .eq('validation_status', 'validated'); // Only completed docs

if (error) {
  console.error("Query error:", error.message);
  return { success: false, error: error.message };
}

console.log(\`Found \${oldDocs.length} documents older than \${daysOld} days\`);

// To actually delete, uncomment:
// for (const doc of oldDocs) {
//   await supabase.from('documents').delete().eq('id', doc.id);
// }

return { 
  success: true, 
  daysOld,
  cutoffDate: cutoffDate.toISOString(),
  documentsFound: oldDocs.length,
  documents: oldDocs.slice(0, 10) // Return first 10 for preview
};`,
    },
    {
      name: 'Send Webhook Notification',
      code: `// Send a custom webhook notification
// Replace webhookUrl with your endpoint

const webhookUrl = executionContext.webhookUrl || "https://your-webhook.example.com/notify";
const payload = {
  event: "custom_script_executed",
  timestamp: new Date().toISOString(),
  user: user.email,
  data: executionContext.customData || {},
};

try {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(\`Webhook failed: HTTP \${response.status}\`);
  }

  console.log("Webhook sent successfully");
  return { success: true, webhookUrl, payload };
} catch (error) {
  console.error("Webhook error:", error.message);
  return { success: false, error: error.message };
}`,
    },
  ],
  typescript: [
    {
      name: 'Typed Document Query',
      code: `// TypeScript template with type annotations
// Note: Types are for documentation - runtime is JavaScript

interface Document {
  id: string;
  file_name: string;
  validation_status: string;
  confidence_score: number;
}

const { data, error } = await supabase
  .from('documents')
  .select('id, file_name, validation_status, confidence_score')
  .limit(5);

if (error) {
  return { success: false, error: error.message };
}

const documents = data as Document[];
const summary = documents.map(d => ({
  name: d.file_name,
  status: d.validation_status,
  confidence: \`\${(d.confidence_score * 100).toFixed(1)}%\`
}));

return { success: true, summary };`,
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

  const loadTemplate = (templateKey: string) => {
    // Parse the template key (format: "language-index")
    const [language, indexStr] = templateKey.split('-');
    const index = parseInt(indexStr);
    
    const templates = SCRIPT_TEMPLATES[language as keyof typeof SCRIPT_TEMPLATES];
    if (templates && templates[index]) {
      const template = templates[index];
      setFormData(prev => ({ 
        ...prev, 
        script_code: template.code,
        script_language: language 
      }));
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
            <p className="text-muted-foreground">Create JavaScript/TypeScript automation scripts with database and API access</p>
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
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                            {language}
                          </div>
                          {templates.map((template, index) => (
                            <SelectItem key={`${language}-${index}`} value={`${language}-${index}`}>
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
                      <SelectItem value="typescript">TypeScript</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scripts run in a secure sandbox with access to Supabase client and fetch API
                  </p>
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
