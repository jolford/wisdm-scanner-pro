import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { batchSchema } from '@/lib/validation-schemas';
import { safeErrorMessage } from '@/lib/error-handler';
import { BatchCustomFields, BatchField } from '@/components/admin/BatchCustomFields';

const NewBatch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batchName, setBatchName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [priority, setPriority] = useState('0');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<BatchField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('is_active', true)
        .order('name');
      
      if (projectsError) throw projectsError;
      
      // Use get_project_safe to fetch full project data securely
      if (!allProjects || allProjects.length === 0) return [];
      
      const projectPromises = allProjects.map(p => 
        supabase.rpc('get_project_safe', { project_id: p.id }).single()
      );
      const results = await Promise.all(projectPromises);
      return results
        .filter(r => !r.error && r.data)
        .map(r => r.data as any);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data with zod
    try {
      batchSchema.parse({
        batchName,
        projectId: selectedProjectId,
        priority: parseInt(priority),
        notes,
      });
    } catch (error: any) {
      const firstError = error.errors?.[0];
      toast({
        title: 'Validation Error',
        description: firstError?.message || 'Please check your input',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build custom fields object
      const customFieldsObj = customFields
        .filter(f => f.name.trim() && f.value.trim())
        .reduce((acc, field) => {
          acc[field.name] = field.value;
          return acc;
        }, {} as Record<string, string>);

      const { data, error } = await supabase.from('batches').insert([{
        batch_name: batchName,
        project_id: selectedProjectId,
        priority: parseInt(priority),
        notes,
        created_by: user?.id,
        metadata: {
          custom_fields: customFieldsObj,
        },
      } as any]).select().single();

      if (error) throw error;

      toast({
        title: 'Batch Created',
        description: 'New batch has been created successfully',
      });

      navigate(`/admin/batches/${data.id}`);
    } catch (error: any) {
      toast({
        title: 'Creation Failed',
        description: safeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/admin/batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create New Batch</h1>
            <p className="text-muted-foreground">Start a new document processing batch</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="batch-name">Batch Name *</Label>
              <Input
                id="batch-name"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g., Invoice Batch - Jan 2025"
                required
              />
            </div>

            <div>
              <Label htmlFor="project">Project *</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
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
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Normal</SelectItem>
                  <SelectItem value="1">High</SelectItem>
                  <SelectItem value="2">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this batch"
                rows={4}
              />
            </div>

            <div className="border-t pt-6">
              <BatchCustomFields
                fields={customFields}
                onChange={setCustomFields}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Batch'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/batches')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default NewBatch;
