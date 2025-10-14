import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import wisdmLogo from '@/assets/wisdm-logo.png';

interface ExtractionField {
  name: string;
  description: string;
}

interface Queue {
  name: string;
  enabled: boolean;
}

const EditProject = () => {
  const { id } = useParams();
  const { loading: authLoading, user } = useRequireAuth(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [fields, setFields] = useState<ExtractionField[]>([
    { name: '', description: '' }
  ]);
  
  const [exportTypes, setExportTypes] = useState({
    csv: true,
    json: true,
    xml: true,
    txt: true,
    pdf: true,
    images: true,
  });

  const [queues, setQueues] = useState<Queue[]>([
    { name: 'Scan', enabled: true },
    { name: 'Validation', enabled: true },
    { name: 'Validated', enabled: true },
    { name: 'Export', enabled: true },
  ]);

  useEffect(() => {
    if (!authLoading && id) {
      loadProject();
    }
  }, [authLoading, id]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setProjectName(data.name);
        setProjectDescription(data.description || '');
        
        // Set extraction fields with proper type checking
        if (Array.isArray(data.extraction_fields)) {
          setFields(data.extraction_fields as unknown as ExtractionField[]);
        } else {
          setFields([{ name: '', description: '' }]);
        }
        
        // Set export types
        if (data.export_types && Array.isArray(data.export_types)) {
          const types = data.export_types as string[];
          setExportTypes({
            csv: types.includes('csv'),
            json: types.includes('json'),
            xml: types.includes('xml'),
            txt: types.includes('txt'),
            pdf: types.includes('pdf'),
            images: types.includes('images'),
          });
        }

        // Set queues with proper type checking
        if (data.queues && Array.isArray(data.queues)) {
          setQueues(data.queues as unknown as Queue[]);
        }
      }
    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([...fields, { name: '', description: '' }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof ExtractionField, value: string) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Project name is required',
        variant: 'destructive',
      });
      return;
    }

    const validFields = fields.filter(f => f.name.trim());
    if (validFields.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one extraction field is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const selectedExportTypes = Object.entries(exportTypes)
        .filter(([_, enabled]) => enabled)
        .map(([type]) => type);

      const { error } = await supabase
        .from('projects')
        .update({
          name: projectName,
          description: projectDescription,
          extraction_fields: validFields as any,
          export_types: selectedExportTypes,
          queues: queues as any,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project updated successfully',
      });
      
      navigate('/admin/projects');
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-xl font-bold">Edit Project</h1>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/admin/projects')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="p-8 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Invoice Processing"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe what this project is used for..."
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label>Extraction Fields *</Label>
                <Button type="button" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={index} className="p-4 bg-muted/50">
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-3">
                        <div>
                          <Label htmlFor={`field-name-${index}`} className="text-xs">
                            Field Name
                          </Label>
                          <Input
                            id={`field-name-${index}`}
                            value={field.name}
                            onChange={(e) => updateField(index, 'name', e.target.value)}
                            placeholder="e.g., Invoice Number"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`field-desc-${index}`} className="text-xs">
                            Description
                          </Label>
                          <Input
                            id={`field-desc-${index}`}
                            value={field.description}
                            onChange={(e) => updateField(index, 'description', e.target.value)}
                            placeholder="e.g., The unique invoice identifier"
                          />
                        </div>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeField(index)}
                          className="mt-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                Define the specific data fields you want to extract from documents in this project.
                For example: Invoice Number, Date, Amount, Vendor Name, etc.
              </p>
            </div>

            <div>
              <Label className="mb-4 block">Export Types</Label>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(exportTypes).map(([type, enabled]) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`export-${type}`}
                      checked={enabled}
                      onCheckedChange={(checked) => 
                        setExportTypes(prev => ({ ...prev, [type]: checked === true }))
                      }
                    />
                    <Label htmlFor={`export-${type}`} className="text-sm font-normal cursor-pointer">
                      {type.toUpperCase()}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Select which export formats will be available for this project.
              </p>
            </div>

            <div>
              <Label className="mb-4 block">Processing Queues</Label>
              <div className="space-y-3">
                {queues.map((queue, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`queue-${index}`}
                        checked={queue.enabled}
                        onCheckedChange={(checked) => {
                          const updated = [...queues];
                          updated[index].enabled = checked === true;
                          setQueues(updated);
                        }}
                      />
                      <Label htmlFor={`queue-${index}`} className="text-sm font-medium cursor-pointer">
                        {queue.name} Queue
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Configure which processing queues are active for this project's workflow.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-primary to-accent">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/admin/projects')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default EditProject;
