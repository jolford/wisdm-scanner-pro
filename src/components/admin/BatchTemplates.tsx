import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Play, Settings, Trash2 } from "lucide-react";

export const BatchTemplates = () => {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['batch-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batch_templates')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch projects for dropdown
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }
  });

  // Apply template mutation
  const applyTemplate = useMutation({
    mutationFn: async ({ templateId, projectId, applyToProject, createBatch, batchName }: any) => {
      const { data, error } = await supabase.functions.invoke('apply-batch-template', {
        body: { templateId, projectId, applyToProject, createBatch, batchName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Template applied successfully');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply template: ${error.message}`);
    }
  });

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: customers } = await supabase.from('customers').select('id').limit(1).single();
      
      const { error } = await supabase
        .from('batch_templates')
        .insert({
          ...data,
          customer_id: customers?.id,
          created_by: user?.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template created');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['batch-templates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    }
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const { error } = await supabase
        .from('batch_templates')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['batch-templates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    }
  });

  // Delete template mutation
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('batch_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['batch-templates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    }
  });

  const handleApplyTemplate = (template: any) => {
    setSelectedTemplate(template);
    setOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setSelectedTemplate(template);
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Templates</h2>
          <p className="text-muted-foreground">Create reusable batch configurations</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke('seed-batch-templates');
                if (error) throw error;
                toast.success((data as any).message || 'Templates seeded');
                queryClient.invalidateQueries({ queryKey: ['batch-templates'] });
              } catch (err) {
                toast.error('Failed to seed templates');
              }
            }}
          >
            Load Presets
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <Badge variant={template.is_active ? 'default' : 'secondary'}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Project:</span>{' '}
                  {template.projects?.name || 'Any'}
                </div>
                {template.extraction_config && (
                  <div>
                    <span className="font-medium">Fields:</span>{' '}
                    {Object.keys(template.extraction_config).length}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleApplyTemplate(template)}
                >
                  Apply
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleEditTemplate(template)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => deleteTemplate.mutate(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createTemplate.mutate({
              name: formData.get('name') as string,
              description: formData.get('description') as string,
              project_id: formData.get('project') as string || null,
              is_active: true
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name *</Label>
                <Input id="name" name="name" required placeholder="e.g., Invoice Processing" />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="What is this template for?" />
              </div>

              <div>
                <Label htmlFor="project">Default Project (Optional)</Label>
                <Select name="project">
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">
                Create Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            updateTemplate.mutate({
              id: selectedTemplate?.id,
              data: {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                project_id: formData.get('project') as string || null,
                is_active: formData.get('is_active') === 'true'
              }
            });
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Template Name *</Label>
                <Input 
                  id="edit-name" 
                  name="name" 
                  required 
                  defaultValue={selectedTemplate?.name}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea 
                  id="edit-description" 
                  name="description" 
                  defaultValue={selectedTemplate?.description || ''}
                />
              </div>

              <div>
                <Label htmlFor="edit-project">Default Project</Label>
                <Select name="project" defaultValue={selectedTemplate?.project_id || undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select name="is_active" defaultValue={selectedTemplate?.is_active ? 'true' : 'false'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">
                Update Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            applyTemplate.mutate({
              templateId: selectedTemplate.id,
              projectId: formData.get('project') as string,
              applyToProject: formData.get('applyToProject') === 'on',
              createBatch: formData.get('createBatch') === 'on',
              batchName: formData.get('batchName') as string
            });
            setOpen(false);
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="project">Project *</Label>
                <Select name="project" defaultValue={selectedTemplate?.project_id || undefined} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                <Checkbox id="applyToProject" name="applyToProject" defaultChecked />
                <div className="flex-1">
                  <Label htmlFor="applyToProject" className="cursor-pointer font-medium text-sm">
                    Update Project Configuration
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Apply template's extraction fields to the selected project
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                <Checkbox id="createBatch" name="createBatch" />
                <div className="flex-1">
                  <Label htmlFor="createBatch" className="cursor-pointer font-medium text-sm">
                    Create New Batch
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Also create a new batch in the project
                  </p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="batchName">Batch Name (if creating batch)</Label>
                <Input
                  id="batchName"
                  name="batchName"
                  placeholder={`${selectedTemplate?.name} - ${new Date().toLocaleDateString()}`}
                />
              </div>

              <Button type="submit" className="w-full">
                Apply Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};