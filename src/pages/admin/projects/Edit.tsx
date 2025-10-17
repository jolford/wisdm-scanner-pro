import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { projectSchema } from '@/lib/validation-schemas';
import { safeErrorMessage } from '@/lib/error-handler';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { ECMExportConfig } from '@/components/admin/ECMExportConfig';
import { DocumentSeparationConfig, SeparationConfig } from '@/components/admin/DocumentSeparationConfig';
import { FolderPicker } from '@/components/admin/FolderPicker';
import { ScheduledExportConfig } from '@/components/admin/ScheduledExportConfig';
import { TableExtractionConfig, TableExtractionConfig as TableConfig } from '@/components/admin/TableExtractionConfig';

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

const EditProject = () => {
  const { id } = useParams();
  const { loading: authLoading, user } = useRequireAuth(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [documentNamingPattern, setDocumentNamingPattern] = useState('');
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
    { name: 'Quality Control', enabled: true },
    { name: 'Export', enabled: true },
  ]);

  const [separationConfig, setSeparationConfig] = useState<SeparationConfig>({
    method: 'page_count',
    barcodePatterns: ['SEPARATOR', 'DIVIDER'],
    blankPageThreshold: 95,
    pagesPerDocument: 1,
  });

  const [tableExtractionConfig, setTableExtractionConfig] = useState<TableConfig>({
    enabled: false,
    fields: [],
  });

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
        
        // Set export configuration and document naming from metadata if available
        const projectData = data as any;
        if (projectData.metadata?.document_naming_pattern) {
          setDocumentNamingPattern(projectData.metadata.document_naming_pattern);
        }
        
        if (projectData.metadata?.export_config) {
          setExportConfig(projectData.metadata.export_config);
        } else if (data.export_types && Array.isArray(data.export_types)) {
          // Fallback for old projects without export_config
          const types = data.export_types as string[];
          const defaultDestinations: Record<string, string> = {
            csv: '/exports/data/',
            json: '/exports/data/',
            xml: '/exports/data/',
            txt: '/exports/data/',
            pdf: '/exports/documents/',
            images: '/exports/images/',
            filebound: '',
            docmgt: '',
          };
          
          const config: Record<string, ExportConfig> = {};
          Object.keys(defaultDestinations).forEach(type => {
            config[type] = {
              enabled: types.includes(type),
              destination: defaultDestinations[type],
            };
          });
          setExportConfig(config);
        }

        // Set queues with proper type checking and migration from "Validated" to "Quality Control"
        if (data.queues && Array.isArray(data.queues)) {
          const migratedQueues = (data.queues as unknown as Queue[]).map(queue => ({
            ...queue,
            name: queue.name === 'Validated' ? 'Quality Control' : queue.name
          }));
          setQueues(migratedQueues);
        }

        // Set separation config from metadata
        if (projectData.metadata?.separation_config) {
          setSeparationConfig(projectData.metadata.separation_config);
        }

        // Set table extraction config from metadata
        if (projectData.metadata?.table_extraction_config) {
          setTableExtractionConfig(projectData.metadata.table_extraction_config);
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

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const updated = [...fields];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setFields(updated);
  };

  const moveFieldDown = (index: number) => {
    if (index === fields.length - 1) return;
    const updated = [...fields];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
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

      const { error } = await supabase
        .from('projects')
        .update({
          name: projectName,
          description: projectDescription,
          extraction_fields: validFields as any,
          export_types: selectedExportTypes,
          queues: queues as any,
        } as any)
        .eq('id', id);
      
      // Update metadata separately if needed
      if (!error) {
        await supabase
          .from('projects')
          .update({ 
            metadata: { 
              export_config: exportConfig,
              separation_config: separationConfig,
              document_naming_pattern: documentNamingPattern,
              table_extraction_config: tableExtractionConfig
            } 
          } as any)
          .eq('id', id);
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project updated successfully',
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
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => moveFieldUp(index)}
                          disabled={index === 0}
                          className="h-8 w-8"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => moveFieldDown(index)}
                          disabled={index === fields.length - 1}
                          className="h-8 w-8"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
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

              <Button type="button" size="sm" onClick={addField} variant="outline" className="w-full mt-4">
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>

              <p className="text-sm text-muted-foreground mt-2">
                Define the specific data fields you want to extract from documents in this project.
                For example: Invoice Number, Date, Amount, Vendor Name, etc.
              </p>
            </div>

            <div>
              <Label className="mb-4 block">Line Item Table Extraction</Label>
              <Card className="p-4 bg-muted/50">
                <TableExtractionConfig
                  config={tableExtractionConfig}
                  onConfigChange={setTableExtractionConfig}
                />
              </Card>
              <p className="text-sm text-muted-foreground mt-2">
                Extract line item tables from invoices and receipts. Configure which columns to extract (e.g., Product, Quantity, Price, Total).
              </p>
            </div>

            <div>
              <Label htmlFor="naming-pattern">Document Naming Pattern</Label>
              <Input
                id="naming-pattern"
                value={documentNamingPattern}
                onChange={(e) => setDocumentNamingPattern(e.target.value)}
                placeholder="e.g., Invoice-{Invoice Number} or {Date}-{Vendor Name}"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Automatically rename documents using extracted metadata. Use {'{'}FieldName{'}'} placeholders.
                Example: "Invoice-{'{'}Invoice Number{'}'}" will rename to "Invoice-12345.pdf"
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
                        
                        {config.enabled && (
                          isECM ? (
                            <div className="pl-6 mt-3">
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
                            <div className="pl-6 space-y-3 mt-3">
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
                          )
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

            <div>
              <Label className="mb-4 block">Scheduled Exports</Label>
              <Card className="p-4 bg-muted/50">
                <ScheduledExportConfig
                  projectId={id || ''}
                  availableExportTypes={Object.keys(exportConfig).filter(
                    type => !['filebound', 'docmgt'].includes(type)
                  )}
                />
              </Card>
              <p className="text-sm text-muted-foreground mt-2">
                Configure automatic exports to run on a schedule. Batches with validated status will be exported automatically.
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
