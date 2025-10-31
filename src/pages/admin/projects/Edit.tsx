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
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScannerAutoImportConfig } from '@/components/admin/ScannerAutoImportConfig';
import { EmailImportConfig } from '@/components/admin/EmailImportConfig';
import { ValidationLookupConfig, ValidationLookupConfig as VLConfig } from '@/components/admin/ValidationLookupConfig';
import { BarcodeConfig } from '@/components/admin/BarcodeConfig';
import { HotFolderSetupWizard } from '@/components/admin/HotFolderSetupWizard';
import { SignatureReferencesManager } from '@/components/admin/SignatureReferencesManager';

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

const EditProject = () => {
  const { id } = useParams();
  const { loading: authLoading, user } = useRequireAuth(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [enableCheckScanning, setEnableCheckScanning] = useState(false);
  const [enableSignatureVerification, setEnableSignatureVerification] = useState(false);
  const [ocrModel, setOcrModel] = useState('google/gemini-2.5-flash');
  const [documentNamingPattern, setDocumentNamingPattern] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
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
    quickbooks: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
    greatplains: { enabled: false, destination: '', url: '', username: '', password: '', project: '', convertFormat: 'none' },
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

  const [classificationConfig, setClassificationConfig] = useState<{
    enabled: boolean;
    auto_classify: boolean;
  }>({
    enabled: false,
    auto_classify: false,
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

  useEffect(() => {
    if (!authLoading && id) {
      loadProject();
    }
  }, [authLoading, id]);

  const loadProject = async () => {
    try {
      // Use get_project_safe to securely fetch project data
      const { data, error } = await supabase
        .rpc('get_project_safe', { project_id: id })
        .single();

      if (error) throw error;

      if (data) {
        // Type assertion: RPC function returns all fields but types haven't regenerated yet
        const projectData = data as unknown as {
          id: string;
          name: string;
          description: string;
          customer_id: string;
          extraction_fields: any;
          queues: any;
          metadata: any;
          enable_check_scanning: boolean;
          enable_signature_verification: boolean;
          ocr_model: string;
          export_types: string[];
          created_at: string;
          updated_at: string;
        };
        
        setProjectName(projectData.name);
        setProjectDescription(projectData.description || '');
        setEnableCheckScanning(projectData.enable_check_scanning || false);
        setEnableSignatureVerification(projectData.enable_signature_verification || false);
        setOcrModel(projectData.ocr_model || 'google/gemini-2.5-flash');
        setCustomerId(projectData.customer_id || undefined);
        
        // Set extraction fields with proper type checking
        if (Array.isArray(projectData.extraction_fields)) {
          setFields(projectData.extraction_fields as unknown as ExtractionField[]);
        } else {
          setFields([{ name: '', description: '' }]);
        }
        
        // Set export configuration and document naming from metadata if available
        if (projectData.metadata?.document_naming_pattern) {
          setDocumentNamingPattern(projectData.metadata.document_naming_pattern);
        }
        
        if (projectData.metadata?.export_config) {
          setExportConfig(projectData.metadata.export_config);
        } else if (projectData.export_types && Array.isArray(projectData.export_types)) {
          // Fallback for old projects without export_config
          const types = projectData.export_types as string[];
          const defaultDestinations: Record<string, string> = {
            csv: '/exports/data/',
            json: '/exports/data/',
            xml: '/exports/data/',
            txt: '/exports/data/',
            sql: '/exports/data/',
            access: '/exports/data/',
            oracle: '/exports/data/',
            pdf: '/exports/documents/',
            images: '/exports/images/',
            filebound: '',
            docmgt: '',
            documentum: '',
            sharepoint: '',
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
        if (projectData.queues && Array.isArray(projectData.queues)) {
          const migratedQueues = (projectData.queues as unknown as Queue[]).map(queue => ({
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

        // Set validation lookup config from metadata
        if (projectData.metadata?.validation_lookup_config) {
          setValidationLookupConfig(projectData.metadata.validation_lookup_config);
        }

        // Set classification config from metadata
        if (projectData.metadata?.classification) {
          setClassificationConfig(projectData.metadata.classification);
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
          enable_check_scanning: enableCheckScanning,
          enable_signature_verification: enableSignatureVerification,
          ocr_model: ocrModel,
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
              table_extraction_config: tableExtractionConfig,
              validation_lookup_config: validationLookupConfig,
              classification: classificationConfig
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

            <div className="flex items-center space-x-2 p-4 border border-border rounded-lg bg-muted/30 mb-6">
              <Checkbox
                id="check-scanning"
                checked={enableCheckScanning}
                onCheckedChange={(checked) => setEnableCheckScanning(checked as boolean)}
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

            <div className="flex items-center space-x-2 p-4 border border-border rounded-lg bg-muted/30 mb-6">
              <Checkbox
                id="signature-verification"
                checked={enableSignatureVerification}
                onCheckedChange={(checked) => setEnableSignatureVerification(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="signature-verification" className="cursor-pointer font-medium">
                  Enable Signature Verification
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Allows users to upload and validate signatures on documents during the validation process
                </p>
              </div>
            </div>

            <div className="space-y-2 p-4 border border-border rounded-lg bg-muted/30 mb-6">
              <Label htmlFor="ocr-model" className="font-medium">
                AI Model for OCR Processing
              </Label>
              <Select value={ocrModel} onValueChange={setOcrModel}>
                <SelectTrigger id="ocr-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-2.5-flash">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Gemini Flash (Default)</span>
                      <span className="text-xs text-muted-foreground">Faster, lower cost - Good for most documents</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="google/gemini-2.5-pro">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Gemini Pro</span>
                      <span className="text-xs text-muted-foreground">Higher accuracy, 3-5x cost - Best for complex documents like casino vouchers</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the AI model for text extraction. Pro model is recommended for casino vouchers and complex handwriting.
              </p>
            </div>

            <Tabs defaultValue="basic" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 bg-muted/50">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="import">Import & Capture</TabsTrigger>
                <TabsTrigger value="processing">Processing & AI</TabsTrigger>
                <TabsTrigger value="export">Export & Integration</TabsTrigger>
                <TabsTrigger value="signatures">Signatures</TabsTrigger>
              </TabsList>

              {/* Basic Settings Tab */}
              <TabsContent value="basic" className="space-y-4">
                <Accordion type="multiple" defaultValue={[]} className="space-y-4">
              <AccordionItem value="fields" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Extraction Fields</span>
                </AccordionTrigger>
                <AccordionContent>
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
                    <Button type="button" size="sm" onClick={addField} variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Define the specific data fields you want to extract from documents in this project.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="table" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base">Table Extraction</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Card className="p-4 bg-muted/50">
                    <TableExtractionConfig
                      config={tableExtractionConfig}
                      onConfigChange={setTableExtractionConfig}
                    />
                  </Card>
                  <p className="text-sm text-muted-foreground mt-2">
                    Extract repeating rows from structured documents like petitions, invoices, or forms. Configure column names and data types for automatic table extraction.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="naming" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Document Naming Pattern</span>
                </AccordionTrigger>
                <AccordionContent>
                  <Input
                    id="naming-pattern"
                    value={documentNamingPattern}
                    onChange={(e) => setDocumentNamingPattern(e.target.value)}
                    placeholder="e.g., Invoice-{Invoice Number}"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Use {'{'}FieldName{'}'} placeholders to automatically rename documents.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="separation" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Document Separation</span>
                </AccordionTrigger>
                <AccordionContent>
              <Label className="mb-4 block">Document Separation</Label>
                  <Card className="p-4 bg-muted/50">
                    <DocumentSeparationConfig
                      config={separationConfig}
                      onConfigChange={setSeparationConfig}
                    />
                  </Card>
                  <p className="text-sm text-muted-foreground mt-2">
                    Configure how multi-page PDFs are automatically split into individual documents.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="queues" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Processing Queues</span>
                </AccordionTrigger>
                <AccordionContent>
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
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </TabsContent>

            {/* Import & Capture Tab */}
            <TabsContent value="import" className="space-y-4">
              <Accordion type="multiple" defaultValue={[]} className="space-y-4">
                <AccordionItem value="hot-folder-wizard" className="border rounded-lg px-4 bg-muted/20">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium text-base">🚀 Hot Folder Setup Wizard</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <HotFolderSetupWizard
                      projectId={id || ''}
                      customerId={customerId}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Step-by-step wizard to set up automatic document imports from scanners.
                    </p>
                  </AccordionContent>
                </AccordionItem>

              <AccordionItem value="scanner" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Scanner Auto-Import (Advanced)</span>
                </AccordionTrigger>
                <AccordionContent>
                  <ScannerAutoImportConfig
                    projectId={id || ''}
                    customerId={customerId}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Advanced configuration for automatic import from network scanners.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="email" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Email Import</span>
                </AccordionTrigger>
                <AccordionContent>
                  <EmailImportConfig
                    projectId={id || ''}
                    customerId={customerId}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Monitor an email inbox for automatic document import.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </TabsContent>

            {/* Processing & AI Tab */}
            <TabsContent value="processing" className="space-y-4">
              <Accordion type="multiple" defaultValue={[]} className="space-y-4">
                <AccordionItem value="barcode" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Barcode Recognition</span>
                </AccordionTrigger>
                <AccordionContent>
                  <BarcodeConfig projectId={id || ''} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="classification" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base">Document Classification</span>
                    {classificationConfig.enabled && (
                      <Badge variant="default" className="text-xs">Enabled</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Card className="p-4 bg-muted/50 space-y-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="classification-enabled"
                        checked={classificationConfig.enabled}
                        onCheckedChange={(checked) => 
                          setClassificationConfig(prev => ({ ...prev, enabled: checked === true }))
                        }
                      />
                      <div className="flex-1">
                        <Label htmlFor="classification-enabled" className="text-sm font-medium cursor-pointer">
                          Enable AI Document Classification
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Automatically classify documents into types like Invoice, Check, Receipt, Contract, etc.
                        </p>
                      </div>
                    </div>

                    {classificationConfig.enabled && (
                      <div className="pl-7 space-y-3 border-l-2 border-primary/20">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="auto-classify"
                            checked={classificationConfig.auto_classify}
                            onCheckedChange={(checked) =>
                              setClassificationConfig(prev => ({ ...prev, auto_classify: checked === true }))
                            }
                          />
                          <Label htmlFor="auto-classify" className="text-sm cursor-pointer">
                            Automatically classify on OCR
                          </Label>
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
                          <strong>Available Classifications:</strong>
                          <div className="grid grid-cols-2 gap-1 mt-2">
                            <span>• Check</span>
                            <span>• Invoice</span>
                            <span>• Purchase Order</span>
                            <span>• Receipt</span>
                            <span>• Contract</span>
                            <span>• Legal Document</span>
                            <span>• Form</span>
                            <span>• Letter</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                  <p className="text-sm text-muted-foreground mt-2">
                    Uses AI to automatically identify document types for better organization and routing.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </TabsContent>

            {/* Export & Integration Tab */}
            <TabsContent value="export" className="space-y-4">
              <Accordion type="multiple" defaultValue={[]} className="space-y-4">
                <AccordionItem value="scheduled" className="border rounded-lg px-4 bg-muted/20">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-medium text-base">Scheduled Exports</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Card className="p-4 bg-muted/50">
                      <ScheduledExportConfig
                        projectId={id || ''}
                        availableExportTypes={Object.keys(exportConfig).filter(
                          type => !['filebound', 'docmgt'].includes(type)
                        )}
                      />
                    </Card>
                    <p className="text-sm text-muted-foreground mt-2">
                      Configure automatic exports to run on a schedule.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="export-config" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium text-base">Export Configuration</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Data Formats Group */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Data Formats</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['csv', 'json', 'xml', 'txt', 'sql'].map((type) => {
                          const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                          return (
                            <div key={type} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
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
                              <Label htmlFor={`export-${type}`} className="text-xs cursor-pointer uppercase">
                                {type}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Documents & Images Group */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Documents & Images</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['pdf', 'images'].map((type) => {
                          const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                          return (
                            <div key={type} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
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
                              <Label htmlFor={`export-${type}`} className="text-xs cursor-pointer uppercase">
                                {type}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Databases Group */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Database Systems</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['access', 'oracle'].map((type) => {
                          const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                          return (
                            <div key={type} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
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
                              <Label htmlFor={`export-${type}`} className="text-xs cursor-pointer uppercase">
                                {type}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ECM Systems Group */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">ECM Systems</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {['filebound', 'docmgt', 'documentum', 'sharepoint'].map((type) => {
                          const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                          return (
                            <div key={type} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
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
                              <Label htmlFor={`export-${type}`} className="text-xs cursor-pointer uppercase">
                                {type}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Accounting Systems Group */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Accounting Systems</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {['quickbooks', 'greatplains'].map((type) => {
                          const config = exportConfig[type] || { enabled: false, destination: '', convertFormat: 'none' };
                          return (
                            <div key={type} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
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
                              <Label htmlFor={`export-${type}`} className="text-xs cursor-pointer uppercase">
                                {type}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Configuration sections for enabled exports */}
                    {Object.entries(exportConfig)
                      .filter(([type]) => !['filebound', 'docmgt', 'documentum', 'sharepoint', 'quickbooks', 'greatplains'].includes(type) && exportConfig[type].enabled)
                      .map(([type, config]) => (
                        <Card key={type} className="p-4 bg-muted/50 mt-4">
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

                    {/* ECM & Accounting Configuration */}
                    {Object.entries(exportConfig)
                      .filter(([type]) => ['filebound', 'docmgt', 'documentum', 'sharepoint', 'quickbooks', 'greatplains'].includes(type) && exportConfig[type].enabled)
                      .map(([type, config]) => (
                        <Card key={type} className="p-4 bg-muted/50 mt-4">
                          <h4 className="text-sm font-medium mb-3 uppercase">{type} Configuration</h4>
                          <ECMExportConfig
                            type={type as 'filebound' | 'docmgt' | 'documentum' | 'sharepoint' | 'quickbooks' | 'greatplains'}
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
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="validation" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base">Validation Lookups</span>
                    <Badge variant="outline" className="text-xs">ECM / SQL Database</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
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
                        Enable validation lookups from ECM systems or databases
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
                    Configure ECM or SQL database lookups for validation. Allows users to search and validate data against external systems during document processing.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signatures" className="space-y-4">
            {enableSignatureVerification ? (
              <SignatureReferencesManager projectId={id || ''} />
            ) : (
              <Card className="p-8 text-center">
                <div className="text-muted-foreground">
                  <p className="font-medium mb-2">Signature Verification is Disabled</p>
                  <p className="text-sm">
                    Enable "Signature Verification" in the general settings above to manage reference signatures.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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
