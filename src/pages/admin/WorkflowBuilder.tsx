import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { GitBranch, Plus, Trash2, Save, Play, Settings, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  label: string;
  config: Record<string, any>;
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
  const [workflowName, setWorkflowName] = useState('');
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    {
      id: '1',
      type: 'trigger',
      label: 'Document Uploaded',
      config: {},
    },
  ]);

  const addNode = (type: 'condition' | 'action') => {
    const newNode: WorkflowNode = {
      id: Date.now().toString(),
      type,
      label: type === 'condition' ? 'New Condition' : 'New Action',
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

  const saveWorkflow = () => {
    if (!workflowName) {
      toast.error('Please enter a workflow name');
      return;
    }
    // TODO: Save to database
    toast.success('Workflow saved successfully');
  };

  const testWorkflow = () => {
    toast.info('Testing workflow...');
    // TODO: Test workflow execution
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
              {/* Workflow Name */}
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="e.g., High Confidence Auto-Validation"
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
                                value={node.label}
                                onValueChange={(value) => {
                                  const option = nodeTypes[node.type].find(o => o.value === value);
                                  updateNode(node.id, { label: option?.label || value });
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
                  Save Workflow
                </Button>
                <Button onClick={testWorkflow} variant="outline">
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Example Workflows */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Example Workflows</CardTitle>
            <CardDescription>Common automation patterns you can use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  name: 'High Confidence Auto-Validation',
                  description: 'Automatically validate documents with >90% confidence',
                  steps: 3,
                },
                {
                  name: 'Invoice Fast-Track',
                  description: 'Route invoices from known vendors directly to export',
                  steps: 4,
                },
                {
                  name: 'Low Confidence Alert',
                  description: 'Send webhook when documents have <70% confidence',
                  steps: 2,
                },
              ].map((workflow) => (
                <Card key={workflow.name} className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{workflow.name}</div>
                        <div className="text-sm text-muted-foreground">{workflow.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{workflow.steps} steps</Badge>
                        <Button size="sm" variant="ghost">
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
