import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GitBranch, Plus, Trash2, Save, Play, Settings, ArrowRight, CheckCircle2, FolderKanban, HelpCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { ProjectSelector } from '@/components/ProjectSelector';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  value: string;
  label: string;
  config: Record<string, any>;
}

interface WorkflowTemplate {
  name: string;
  description: string;
  steps: number;
  nodes: WorkflowNode[];
}

const nodeTypes = {
  trigger: [
    { value: 'document_uploaded', label: 'Document Uploaded' },
    { value: 'batch_created', label: 'Batch Created' },
    { value: 'validation_completed', label: 'Validation Completed' },
  ],
  condition: [
    { value: 'confidence_threshold', label: 'Confidence Threshold' },
    { value: 'document_type', label: 'Document Type' },
    { value: 'field_value', label: 'Field Value Match' },
  ],
  action: [
    { value: 'auto_validate', label: 'Auto-Validate' },
    { value: 'route_to_queue', label: 'Route to Queue' },
    { value: 'send_webhook', label: 'Send Webhook' },
    { value: 'send_email', label: 'Send Email' },
    { value: 'export_batch', label: 'Export Batch' },
  ],
};

export default function WorkflowBuilder() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [existingWorkflows, setExistingWorkflows] = useState<any[]>([]);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    {
      id: '1',
      type: 'trigger',
      value: 'document_uploaded',
      label: 'Document Uploaded',
      config: {},
    },
  ]);
  const [showInstructions, setShowInstructions] = useState(true);

  // Fetch customer ID
  useEffect(() => {
    const fetchCustomerId = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('user_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .single();
      
      if (data && !error) {
        setCustomerId(data.customer_id);
      }
    };
    
    fetchCustomerId();
  }, [user]);

  // Fetch existing workflows when project changes
  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!selectedProject) {
        setExistingWorkflows([]);
        return;
      }

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: false });

      if (data && !error) {
        setExistingWorkflows(data);
      }
    };

    fetchWorkflows();
  }, [selectedProject]);

  const addNode = (type: 'condition' | 'action') => {
    const defaultOption = nodeTypes[type][0];
    const newNode: WorkflowNode = {
      id: Date.now().toString(),
      type,
      value: defaultOption.value,
      label: defaultOption.label,
      config: {},
    };
    setNodes([...nodes, newNode]);
  };

  const removeNode = (id: string) => {
    if (nodes.length === 1) {
      toast.error('Workflow must have at least one trigger node');
      return;
    }
    setNodes(nodes.filter(n => n.id !== id));
  };

  const updateNode = (id: string, updates: Partial<WorkflowNode>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const saveWorkflow = async () => {
    if (!workflowName) {
      toast.error('Please enter a workflow name');
      return;
    }
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }
    if (!customerId) {
      toast.error('Customer ID not found');
      return;
    }

    const triggerEvents = nodes
      .filter(n => n.type === 'trigger')
      .map(n => n.value);

    // Generate edges to connect nodes in sequence
    const edges = nodes.slice(0, -1).map((node, index) => ({
      id: `e${node.id}-${nodes[index + 1].id}`,
      source: node.id,
      target: nodes[index + 1].id,
    }));

    const workflowData = {
      name: workflowName,
      description: workflowDescription,
      project_id: selectedProject,
      customer_id: customerId,
      created_by: user!.id,
      workflow_nodes: nodes as any,
      workflow_edges: edges as any,
      trigger_events: triggerEvents,
      is_active: true,
    };

    if (editingWorkflowId) {
      // Update existing workflow
      const { error } = await supabase
        .from('workflows')
        .update(workflowData)
        .eq('id', editingWorkflowId);

      if (error) {
        toast.error('Failed to update workflow');
        console.error(error);
        return;
      }
      toast.success('Workflow updated successfully');
    } else {
      // Create new workflow
      const { error } = await supabase
        .from('workflows')
        .insert([workflowData]);

      if (error) {
        toast.error('Failed to save workflow');
        console.error(error);
        return;
      }
      toast.success('Workflow saved successfully');
    }

    // Refresh workflows list
    const { data } = await supabase
      .from('workflows')
      .select('*')
      .eq('project_id', selectedProject)
      .order('created_at', { ascending: false });

    if (data) {
      setExistingWorkflows(data);
    }

    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setWorkflowName('');
    setWorkflowDescription('');
    setEditingWorkflowId(null);
    setNodes([
      {
        id: '1',
        type: 'trigger',
        value: 'document_uploaded',
        label: 'Document Uploaded',
        config: {},
      },
    ]);
  };

  const loadExistingWorkflow = (workflow: any) => {
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description || '');
    setNodes(workflow.workflow_nodes);
    setEditingWorkflowId(workflow.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Loaded workflow: ${workflow.name}`);
  };

  const toggleWorkflowActive = async (workflowId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('workflows')
      .update({ is_active: !currentStatus })
      .eq('id', workflowId);

    if (error) {
      toast.error('Failed to update workflow status');
      return;
    }

    // Refresh workflows list
    const { data } = await supabase
      .from('workflows')
      .select('*')
      .eq('project_id', selectedProject)
      .order('created_at', { ascending: false });

    if (data) {
      setExistingWorkflows(data);
    }

    toast.success(`Workflow ${!currentStatus ? 'activated' : 'deactivated'}`);
  };

  const testWorkflow = () => {
    toast.info('Testing workflow...');
    // TODO: Test workflow execution
  };

  const workflowTemplates: WorkflowTemplate[] = [
    {
      name: 'High Confidence Auto-Validation',
      description: 'Automatically validate documents with >90% confidence',
      steps: 3,
      nodes: [
        { id: '1', type: 'trigger', value: 'document_uploaded', label: 'Document Uploaded', config: {} },
        { id: '2', type: 'condition', value: 'confidence_threshold', label: 'Confidence Threshold', config: { threshold: '90' } },
        { id: '3', type: 'action', value: 'auto_validate', label: 'Auto-Validate', config: {} },
      ],
    },
    {
      name: 'Invoice Fast-Track',
      description: 'Route invoices from known vendors directly to export',
      steps: 4,
      nodes: [
        { id: '1', type: 'trigger', value: 'document_uploaded', label: 'Document Uploaded', config: {} },
        { id: '2', type: 'condition', value: 'document_type', label: 'Document Type', config: { docType: 'invoice' } },
        { id: '3', type: 'condition', value: 'field_value', label: 'Field Value Match', config: { field: 'Vendor Name' } },
        { id: '4', type: 'action', value: 'route_to_queue', label: 'Route to Queue', config: { queue: 'export' } },
      ],
    },
    {
      name: 'Low Confidence Alert',
      description: 'Send webhook when documents have <70% confidence',
      steps: 3,
      nodes: [
        { id: '1', type: 'trigger', value: 'validation_completed', label: 'Validation Completed', config: {} },
        { id: '2', type: 'condition', value: 'confidence_threshold', label: 'Confidence Threshold', config: { threshold: '70', below: true } },
        { id: '3', type: 'action', value: 'send_webhook', label: 'Send Webhook', config: {} },
      ],
    },
  ];

  const loadTemplate = (template: WorkflowTemplate) => {
    setWorkflowName(template.name);
    setNodes(template.nodes);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Loaded template: ${template.name}`);
  };

  return (
    <AdminLayout title="Workflow Builder">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <CardTitle>Visual Workflow Builder</CardTitle>
            </div>
            <CardDescription>
              Design automated document processing workflows without code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Instructions */}
              <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">How to Use Workflow Builder</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {showInstructions ? 'Hide' : 'Show'}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="font-semibold mb-1">What are Workflows?</p>
                          <p className="text-muted-foreground">
                            Workflows automate document processing by executing actions when specific conditions are met.
                            For example: "When a document is uploaded AND its confidence is above 90%, automatically validate it."
                          </p>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <p className="font-semibold mb-2">Building a Workflow:</p>
                          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li><strong>Select a Project</strong> - Choose which project this workflow applies to</li>
                            <li><strong>Set Trigger</strong> - Define the event that starts the workflow (Document Uploaded, Batch Created, etc.)</li>
                            <li><strong>Add Conditions</strong> - Set rules that must be met (confidence threshold, document type, field values)</li>
                            <li><strong>Add Actions</strong> - Define what happens when conditions are met (auto-validate, route to queue, send notifications)</li>
                            <li><strong>Save & Activate</strong> - Save your workflow and toggle it active to start automation</li>
                          </ol>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <p className="font-semibold mb-2">Node Types:</p>
                          <div className="space-y-2 text-muted-foreground">
                            <div>
                              <Badge variant="default" className="mr-2">Trigger</Badge>
                              <span>The event that starts the workflow (e.g., document uploaded)</span>
                            </div>
                            <div>
                              <Badge variant="secondary" className="mr-2">Condition</Badge>
                              <span>Rules that must be true for actions to execute (e.g., confidence &gt; 90%)</span>
                            </div>
                            <div>
                              <Badge variant="outline" className="mr-2">Action</Badge>
                              <span>What happens when conditions pass (e.g., auto-validate document)</span>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <p className="font-semibold mb-1">Example Workflow:</p>
                          <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">Trigger</Badge>
                              <ArrowRight className="h-3 w-3" />
                              <span>Document Uploaded</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">Condition</Badge>
                              <ArrowRight className="h-3 w-3" />
                              <span>Document Type = Invoice</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">Condition</Badge>
                              <ArrowRight className="h-3 w-3" />
                              <span>Confidence ≥ 90%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Action</Badge>
                              <ArrowRight className="h-3 w-3" />
                              <span>Auto-Validate Document</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Project Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Select Project
                </Label>
                <ProjectSelector
                  selectedProjectId={selectedProject}
                  onProjectSelect={(projectId) => setSelectedProject(projectId)}
                />
                {!selectedProject && (
                  <p className="text-sm text-muted-foreground">
                    Select a project to associate this workflow with
                  </p>
                )}
              </div>

              <Separator />

              {/* Workflow Name */}
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="e.g., High Confidence Auto-Validation"
                />
              </div>

              {/* Workflow Description */}
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Briefly describe what this workflow does"
                />
              </div>

              <Separator />

              {/* Workflow Nodes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Workflow Steps</h4>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addNode('condition')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Condition
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addNode('action')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Action
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {nodes.map((node, index) => (
                    <div key={node.id}>
                      <Card className="border-2">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant={
                                node.type === 'trigger' ? 'default' :
                                node.type === 'condition' ? 'secondary' : 'outline'
                              }>
                                {node.type === 'trigger' ? 'Trigger' :
                                 node.type === 'condition' ? 'Condition' : 'Action'}
                              </Badge>
                              {node.type !== 'trigger' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeNode(node.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select
                                value={node.value}
                                onValueChange={(value) => {
                                  const option = nodeTypes[node.type].find(o => o.value === value);
                                  updateNode(node.id, { value, label: option?.label || value });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {nodeTypes[node.type].map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Configuration based on node type */}
                            {node.type === 'condition' && node.label.includes('Confidence') && (
                              <div className="space-y-2">
                                <Label>Minimum Confidence</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="e.g., 90"
                                  value={node.config.threshold || ''}
                                  onChange={(e) => updateNode(node.id, {
                                    config: { ...node.config, threshold: e.target.value }
                                  })}
                                />
                              </div>
                            )}

                            {node.type === 'action' && node.label.includes('Queue') && (
                              <div className="space-y-2">
                                <Label>Target Queue</Label>
                                <Select
                                  value={node.config.queue || ''}
                                  onValueChange={(value) => updateNode(node.id, {
                                    config: { ...node.config, queue: value }
                                  })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select queue" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="validation">Validation Queue</SelectItem>
                                    <SelectItem value="export">Export Queue</SelectItem>
                                    <SelectItem value="review">Review Queue</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {index < nodes.length - 1 && (
                        <div className="flex justify-center py-2">
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={saveWorkflow} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {editingWorkflowId ? 'Update Workflow' : 'Save Workflow'}
                </Button>
                {editingWorkflowId && (
                  <Button onClick={resetForm} variant="outline">
                    Cancel Edit
                  </Button>
                )}
                <Button onClick={testWorkflow} variant="outline">
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Existing Workflows for Selected Project */}
        {selectedProject && existingWorkflows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Saved Workflows</CardTitle>
              <CardDescription>Workflows for the selected project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {existingWorkflows.map((workflow) => (
                  <Card key={workflow.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{workflow.name}</div>
                            <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                              {workflow.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          {workflow.description && (
                            <div className="text-sm text-muted-foreground">{workflow.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {workflow.workflow_nodes.length} steps
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toggleWorkflowActive(workflow.id, workflow.is_active)}
                          >
                            {workflow.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => loadExistingWorkflow(workflow)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Example Workflows */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Example Workflows</CardTitle>
            <CardDescription>Common automation patterns you can use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflowTemplates.map((template) => (
                <Card key={template.name} className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground">{template.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{template.steps} steps</Badge>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => loadTemplate(template)}
                        >
                          Use Template
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
