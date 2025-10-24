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
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { projectSchema } from '@/lib/validation-schemas';
import { safeErrorMessage } from '@/lib/error-handler';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { ECMExportConfig } from '@/components/admin/ECMExportConfig';
import { DocumentSeparationConfig, SeparationConfig } from '@/components/admin/DocumentSeparationConfig';
import { FolderPicker } from '@/components/admin/FolderPicker';
import { TableExtractionConfig, TableExtractionConfig as TableConfig } from '@/components/admin/TableExtractionConfig';
import { ValidationLookupConfig, ValidationLookupConfig as VLConfig } from '@/components/admin/ValidationLookupConfig';

interface ExtractionField {
  name: string;
  description: string;
  required?: boolean;
  type?: 'text' | 'date' | 'currency' | 'number' | 'email';
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
  const [documentNamingPattern, setDocumentNamingPattern] = useState('');
  const [fields, setFields] = useState<ExtractionField[]>([
    { name: '', description: '' }
  ]);
  
  const [exportConfig, setExportConfig] = useState<Record<string, ExportConfig>>({
    csv: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    json: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    xml: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    txt: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    sql: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    access: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    oracle: { enabled: true, destination: '/exports/data/', convertFormat: 'none' },
    pdf: { enabled: true, destination: '/exports/documents/', convertFormat: 'none' },
    images: { enabled: true, destination: '/exports/images/', convertFormat: 'none' },
    filebound: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
    docmgt: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
    documentum: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
    sharepoint: { enabled: false, destination: '', url: '', password: '', project: '', convertFormat: 'none' },
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

  const [tableExtractionConfig, setTableExtractionConfig] = useState<TableConfig>({
    enabled: false,
    fields: [],
  });

  const [validationLookupConfig, setValidationLookupConfig] = useState<VLConfig>({
    enabled: false,
    system: 'none',
    url: '',
    username: '',
    password: '',
    project: '',
    lookupFields: [],
  });

  const addField = () => {
    setFields([...fields, { name: '', description: '' }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof ExtractionField, value: string | boolean) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
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
          separation_config: separationConfig,
          document_naming_pattern: documentNamingPattern,
          table_extraction_config: tableExtractionConfig,
          validation_lookup_config: validationLookupConfig
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
                        <div className="grid grid-cols-2 gap-3">
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
                            <Label htmlFor={`field-type-${index}`} className="text-xs">
                              Field Type
                            </Label>
                            <Select
                              value={field.type || 'text'}
                              onValueChange={(value) => {
                                const updated = [...fields];
                                updated[index].type = value as 'text' | 'date' | 'currency' | 'number' | 'email';
                                setFields(updated);
                              }}
                            >
                              <SelectTrigger id={`field-type-${index}`}>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="currency">Currency</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`field-required-${index}`}
                            checked={field.required || false}
                            onCheckedChange={(checked) => {
                              const updated = [...fields];
                              updated[index].required = checked === true;
                              setFields(updated);
                            }}
                          />
                          <Label htmlFor={`field-required-${index}`} className="text-xs cursor-pointer">
                            Required field
                          </Label>
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

            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Export Configuration</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure file exports and ECM connectors
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['csv', 'json', 'xml', 'txt', 'sql', 'access', 'oracle', 'pdf', 'images'].map((type) => {
                    const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                    return (
                      <div key={type} className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
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
                        <Label htmlFor={`export-${type}`} className="text-sm font-medium cursor-pointer uppercase">
                          {type}
                        </Label>
                      </div>
                    );
                  })}
                </div>

                {Object.entries(exportConfig)
                  .filter(([type]) => !['filebound', 'docmgt', 'documentum', 'sharepoint'].includes(type) && exportConfig[type].enabled)
                  .map(([type, config]) => (
                    <Card key={type} className="p-4 bg-muted/50">
                      <h4 className="text-sm font-medium mb-3 uppercase">{type} Settings</h4>
                      <div className="space-y-3">
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
                        
                        {(type === 'pdf' || type === 'images') && (
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
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">ECM Connectors</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {['filebound', 'docmgt', 'documentum', 'sharepoint'].map((type) => {
                      const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                      return (
                        <div key={type} className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
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
                          <Label htmlFor={`export-${type}`} className="text-sm font-medium cursor-pointer uppercase">
                            {type}
                          </Label>
                        </div>
                      );
                    })}
                  </div>

                  {Object.entries(exportConfig)
                    .filter(([type]) => ['filebound', 'docmgt', 'documentum', 'sharepoint'].includes(type) && exportConfig[type].enabled)
                    .map(([type, config]) => (
                      <Card key={type} className="p-4 bg-muted/50 mt-3">
                        <h4 className="text-sm font-medium mb-3 uppercase">{type} Configuration</h4>
                        <ECMExportConfig
                          type={type as 'filebound' | 'docmgt' | 'documentum' | 'sharepoint'}
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
                      </Card>
                    ))}
                </div>
              </div>
            </Card>

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
              <Label className="mb-4 block flex items-center gap-2">
                Validation Lookups
                <Badge variant="outline" className="text-xs">FileBound / DocMgt</Badge>
              </Label>
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="enable-validation-lookup"
                    checked={validationLookupConfig.enabled}
                    onCheckedChange={(checked) => 
                      setValidationLookupConfig(prev => ({ 
                        ...prev, 
                        enabled: checked === true 
                      }))
                    }
                  />
                  <Label htmlFor="enable-validation-lookup" className="text-sm font-medium cursor-pointer">
                    Enable validation lookups from ECM systems
                  </Label>
                </div>
                
                {validationLookupConfig.enabled && (
                  <ValidationLookupConfig
                    config={validationLookupConfig}
                    extractionFields={fields}
                    onConfigChange={setValidationLookupConfig}
                    disabled={!validationLookupConfig.enabled}
                  />
                )}
              </Card>
              <p className="text-sm text-muted-foreground mt-2">
                Configure ECM system lookups for validation. Users can search and retrieve values from FileBound or DocMgt during document validation.
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
