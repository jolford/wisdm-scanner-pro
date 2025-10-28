import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Play, Settings, Trash2 } from "lucide-react";

export const BatchTemplates = () => {
  const [open, setOpen] = useState(false);
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
    mutationFn: async ({ templateId, projectId, batchName }: any) => {
      const { data, error } = await supabase.functions.invoke('apply-batch-template', {
        body: { templateId, projectId, batchName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Batch created: ${data.batch.batch_name}`);
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply template: ${error.message}`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Templates</h2>
          <p className="text-muted-foreground">Create reusable batch configurations</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
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
                  <Play className="w-4 h-4 mr-1" />
                  Apply
                </Button>
                <Button size="sm" variant="outline">
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
              batchName: formData.get('batchName') as string
            });
            setOpen(false);
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="project">Project</Label>
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
                <Label htmlFor="batchName">Batch Name</Label>
                <Input
                  id="batchName"
                  name="batchName"
                  placeholder={`${selectedTemplate?.name} - ${new Date().toLocaleDateString()}`}
                />
              </div>

              <Button type="submit" className="w-full">
                Create Batch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};