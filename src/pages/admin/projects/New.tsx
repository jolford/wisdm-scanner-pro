import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { projectSchema } from '@/lib/validation-schemas';
import { safeErrorMessage } from '@/lib/error-handler';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { ECMExportConfig } from '@/components/admin/ECMExportConfig';
import { DocumentSeparationConfig, SeparationConfig } from '@/components/admin/DocumentSeparationConfig';
import { FolderPicker } from '@/components/admin/FolderPicker';

interface ExtractionField {
  name: string;
  description: string;
}

interface Queue {
  name: string;
  enabled: boolean;
}

interface ExportConfig {
  enabled: boolean;
  destination: string;
  convertFormat?: 'none' | 'pdf' | 'jpg' | 'tiff';
  url?: string;
  username?: string;
  password?: string;
  project?: string;
  fieldMappings?: Record<string, string>;
}

const NewProject = () => {
  const { loading, user } = useRequireAuth(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [enableCheckScanning, setEnableCheckScanning] = useState(false);
  const [fields, setFields] = useState<ExtractionField[]>([
    { name: '', description: '' }
  ]);
  
  const [exportConfig, setExportConfig] = useState<Record<string, ExportConfig>>({
    csv: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    json: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    xml: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    txt: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    pdf: { enabled: true, destination: '/exports/documents/', convertFormat: 'none' },
    images: { enabled: true, destination: '/exports/images/', convertFormat: 'none' },
    filebound: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
    docmgt: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
  });

  const [queues, setQueues] = useState<Queue[]>([
    { name: 'Scan', enabled: true },
    { name: 'Validation', enabled: true },
    { name: 'Validated', enabled: true },
    { name: 'Export', enabled: true },
  ]);

  const [separationConfig, setSeparationConfig] = useState<SeparationConfig>({
    method: 'page_count',
    barcodePatterns: ['SEPARATOR', 'DIVIDER'],
    blankPageThreshold: 95,
    pagesPerDocument: 1,
  });

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
    
    // Validate form data with zod
    const validFields = fields.filter(f => f.name.trim());
    
    try {
      projectSchema.parse({
        name: projectName,
        description: projectDescription,
        enableCheckScanning,
        extractionFields: validFields,
        exportConfig,
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

    setSaving(true);
    try {
      const selectedExportTypes = Object.entries(exportConfig)
        .filter(([_, config]) => config.enabled)
        .map(([type]) => type);

      const { error } = await supabase.from('projects').insert([{
        name: projectName,
        description: projectDescription,
        enable_check_scanning: enableCheckScanning,
        extraction_fields: validFields as any,
        export_types: selectedExportTypes,
        queues: queues as any,
        created_by: user?.id,
        metadata: { 
          export_config: exportConfig,
          separation_config: separationConfig 
        } as any,
      }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project created successfully',
      });
      
      navigate('/admin/projects');
    } catch (error) {
      toast({
        title: 'Error',
        description: safeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
                <h1 className="text-xl font-bold">New Project</h1>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/admin')}>
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

            <div className="flex items-center space-x-2 p-4 border border-border rounded-lg bg-muted/30">
              <Checkbox
                id="check-scanning"
                checked={enableCheckScanning}
                onCheckedChange={(checked) => {
                  setEnableCheckScanning(checked as boolean);
                  // Pre-populate MICR fields when enabled
                  if (checked && fields.length === 1 && !fields[0].name) {
                    setFields([
                      { name: 'Routing Number', description: 'Bank routing number (9 digits)' },
                      { name: 'Account Number', description: 'Bank account number' },
                      { name: 'Check Number', description: 'Check serial number' },
                      { name: 'Amount', description: 'Check amount' },
                    ]);
                  }
                }}
              />
              <div className="flex-1">
                <Label htmlFor="check-scanning" className="cursor-pointer font-medium">
                  Enable Check/MICR Scanning Mode
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optimizes extraction for checks with MICR line reading (routing number, account number, check number, amount)
                </p>
              </div>
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
              <Label className="mb-4 block">Export Configuration</Label>
              <div className="space-y-4">
                {Object.entries(exportConfig).map(([type, config]) => {
                  const isECM = type === 'filebound' || type === 'docmgt';
                  
                  return (
                    <Card key={type} className="p-4 bg-muted/50">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`export-${type}`}
                            checked={config.enabled}
                            onCheckedChange={(checked) => 
                              setExportConfig(prev => ({ 
                                ...prev, 
                                [type]: { ...prev[type], enabled: checked === true }
                              }))
                            }
                          />
                          <Label htmlFor={`export-${type}`} className="text-sm font-medium cursor-pointer">
                            {type.toUpperCase()}
                          </Label>
                        </div>
                        
                        {isECM ? (
                          <div className="pl-6">
                            <ECMExportConfig
                              type={type as 'filebound' | 'docmgt'}
                              config={config}
                              extractionFields={fields}
                              onConfigChange={(newConfig) => 
                                setExportConfig(prev => ({ 
                                  ...prev, 
                                  [type]: newConfig 
                                }))
                              }
                              disabled={!config.enabled}
                            />
                          </div>
                        ) : (
                          <div className="pl-6 space-y-3">
                            <div>
                              <Label htmlFor={`dest-${type}`} className="text-xs mb-1">
                                Export Destination
                              </Label>
                              <FolderPicker
                                value={config.destination}
                                onChange={(path) => 
                                  setExportConfig(prev => ({ 
                                    ...prev, 
                                    [type]: { ...prev[type], destination: path }
                                  }))
                                }
                                disabled={!config.enabled}
                              />
                            </div>
            <div>
              <Label className="mb-4 block">Document Separation</Label>
              <Card className="p-4 bg-muted/50">
                <DocumentSeparationConfig
                  config={separationConfig}
                  onConfigChange={setSeparationConfig}
                />
              </Card>
              <p className="text-sm text-muted-foreground mt-2">
                Configure how multi-page PDFs are automatically split into individual documents during scanning.
              </p>
            </div>

            <div>
                              <Label htmlFor={`convert-${type}`} className="text-xs mb-1">
                                Convert Format on Export
                              </Label>
                              <Select
                                value={config.convertFormat || 'none'}
                                onValueChange={(value) => 
                                  setExportConfig(prev => ({ 
                                    ...prev, 
                                    [type]: { ...prev[type], convertFormat: value as 'none' | 'pdf' | 'jpg' | 'tiff' }
                                  }))
                                }
                                disabled={!config.enabled}
                              >
                                <SelectTrigger id={`convert-${type}`}>
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="none">No Conversion</SelectItem>
                                  <SelectItem value="pdf">Convert to PDF</SelectItem>
                                  <SelectItem value="jpg">Convert to JPG</SelectItem>
                                  <SelectItem value="tiff">Convert to TIFF</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Automatically convert documents to selected format during export
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Configure export formats, destinations, and automatic format conversion. For ECM systems (Filebound/Docmgt), test connection to fetch available projects and map fields. Documents can be automatically converted to PDF, JPG, or TIFF format during export.
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
                {saving ? 'Creating...' : 'Create Project'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/admin')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default NewProject;
