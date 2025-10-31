import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ValidationLookupField {
  wisdmField: string;
  ecmField: string;
  lookupEnabled: boolean;
}

export interface ValidationLookupConfig {
  enabled: boolean;
  system: 'filebound' | 'docmgt' | 'sql' | 'excel' | 'csv' | 'none';
  url?: string;
  username?: string;
  password?: string;
  project?: string;
  recordTypeId?: string;
  lookupFields?: ValidationLookupField[];
  // SQL-specific fields
  sqlHost?: string;
  sqlPort?: string;
  sqlDatabase?: string;
  sqlTable?: string;
  sqlDialect?: 'mysql' | 'postgresql' | 'sqlserver';
  // Excel/CSV-specific fields
  excelFileUrl?: string;
  excelFileName?: string;
  excelKeyColumn?: string;
}

interface ECMProject {
  id: string;
  name: string;
  description?: string;
}

interface ECMField {
  name: string;
  type: string;
  required?: boolean;
}

interface ValidationLookupConfigProps {
  config: ValidationLookupConfig;
  extractionFields: Array<{ name: string; description: string }>;
  onConfigChange: (config: ValidationLookupConfig) => void;
  disabled?: boolean;
}

export function ValidationLookupConfig({ 
  config, 
  extractionFields,
  onConfigChange,
  disabled = false 
}: ValidationLookupConfigProps) {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [availableProjects, setAvailableProjects] = useState<ECMProject[]>([]);
  const [ecmFields, setEcmFields] = useState<ECMField[]>([]);
  const [allProjectFields, setAllProjectFields] = useState<Record<string, ECMField[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string>(config.project || '');
  const [loadingFields, setLoadingFields] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const testConnection = async () => {
    if (config.system === 'none') {
      toast.error('Please select a system first');
      return;
    }

    // Excel/CSV doesn't need connection test
    if (config.system === 'excel' || config.system === 'csv') {
      if (!config.excelFileUrl) {
        toast.error(`Please upload ${config.system === 'csv' ? 'a CSV' : 'an Excel'} file first`);
        return;
      }
      toast.success(`${config.system.toUpperCase()} file is ready for validation`);
      setConnectionStatus('success');
      return;
    }

    // Validate SQL-specific fields
    if (config.system === 'sql') {
      if (!config.sqlHost || !config.sqlDatabase || !config.username || !config.password || !config.sqlDialect) {
        toast.error('Host, database, username, password, and dialect are required for SQL');
        return;
      }
    } else {
      // Validate ECM fields
      if (!config.url || !config.username || !config.password) {
        toast.error('URL, username, and password are required');
        return;
      }
    }

    setTesting(true);
    setConnectionStatus('idle');

    try {
      const functionMap = {
        'filebound': 'test-filebound-connection',
        'docmgt': 'test-docmgt-connection',
        'sql': 'test-sql-connection',
      };
      
      const functionName = functionMap[config.system];
      
      let requestBody: any;
      
      if (config.system === 'sql') {
        requestBody = {
          host: config.sqlHost,
          port: config.sqlPort || (config.sqlDialect === 'postgresql' ? '5432' : config.sqlDialect === 'mysql' ? '3306' : '1433'),
          database: config.sqlDatabase,
          username: config.username,
          password: config.password,
          dialect: config.sqlDialect,
          table: config.sqlTable,
        };
      } else {
        requestBody = { 
          url: config.url, 
          username: config.username, 
          password: config.password 
        };
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody,
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        
        if (config.system === 'sql') {
          // For SQL, we get columns directly
          const sqlColumns: ECMField[] = (data.columns || []).map((col: any) => ({
            name: col.name || col.column_name || col.COLUMN_NAME,
            type: col.type || col.data_type || col.DATA_TYPE || 'text',
            required: false
          }));
          setEcmFields(sqlColumns);
          
          toast.success('Successfully connected to SQL database');
        } else {
          // For ECM systems
          const projects: ECMProject[] = (data.projects || []).map((p: any) => ({
            id: p.ProjectId?.toString() || p.id?.toString() || p.ID?.toString(),
            name: p.Name || p.name || p.Title,
            description: p.Description || p.description || p.Summary
          }));
          
          setAvailableProjects(projects);
          
          if (data.projectFields) {
            const formattedFields: Record<string, ECMField[]> = {};
            
            Object.entries(data.projectFields).forEach(([projId, fields]) => {
              formattedFields[projId] = (fields as any[]).map((f: any) => ({
                name: f.VariableName || f.FieldName || f.name || f.Name || f.Title,
                type: f.DataType || f.FieldType || f.type || f.Type || 'text',
                required: f.Required || f.required || false
              }));
            });
            
            setAllProjectFields(formattedFields);
          }
          
          toast.success(`Successfully connected to ${config.system.toUpperCase()}`);
        }
      } else {
        setConnectionStatus('error');
        toast.error(data.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setConnectionStatus('error');
      toast.error(error.message || 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCSV = config.system === 'csv';
    const expectedExtension = isCSV ? /\.csv$/i : /\.(xlsx|xls)$/i;
    const fileType = isCSV ? 'CSV' : 'Excel';

    if (!file.name.match(expectedExtension)) {
      toast.error(`Please upload ${isCSV ? 'a CSV file (.csv)' : 'an Excel file (.xlsx or .xls)'}`);
      return;
    }

    setUploadingExcel(true);
    try {
      const filePath = `${isCSV ? 'csv' : 'excel'}-lookups/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      let columns: string[] = [];

      if (isCSV) {
        // Parse CSV directly in browser
        const text = await file.text();
        const lines = text.split('\n');
        if (lines.length > 0) {
          // Get header row (first line)
          columns = lines[0].split(',').map(col => col.trim().replace(/^"(.*)"$/, '$1'));
        }
      } else {
        // Parse Excel using edge function
        const result = await supabase.functions.invoke('parse-excel-columns', {
          body: { fileUrl: publicUrl }
        });

        if (result.error) throw result.error;
        columns = result.data.columns || [];
      }
      
      setEcmFields(columns.map((col: string) => ({
        name: col,
        type: 'string'
      })));
      
      setConnectionStatus('success');

      onConfigChange({
        ...config,
        excelFileUrl: publicUrl,
        excelFileName: file.name,
        excelKeyColumn: columns[0] || 'File Name'
      });

      toast.success(`${fileType} file uploaded successfully`);
    } catch (error) {
      console.error(`Error uploading ${fileType}:`, error);
      toast.error(`Failed to upload ${fileType} file`);
      setConnectionStatus('error');
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    const selectedProject = availableProjects.find(p => p.id === projectId);
    
    onConfigChange({
      ...config,
      project: selectedProject?.name || projectId,
      ...(config.system === 'docmgt' && !isNaN(Number(projectId)) ? { recordTypeId: projectId } : {}),
    });

    if (allProjectFields[projectId]) {
      setEcmFields(allProjectFields[projectId]);
      return;
    }

    setLoadingFields(true);
    try {
      if (config.system === 'docmgt') {
        const { data, error } = await supabase.functions.invoke('test-docmgt-connection', {
          body: {
            url: config.url,
            username: config.username,
            password: config.password,
            projectId,
          },
        });
        if (error) throw error;
        const fieldsObj = (data?.projectFields ?? {}) as Record<string, any>;
        const keyCandidates = [projectId, String(projectId)];
        const resolvedKey = keyCandidates.find(k => fieldsObj[k]) || Object.keys(fieldsObj)[0];
        const rawFields = resolvedKey ? fieldsObj[resolvedKey] : [];
        const formattedFields = (Array.isArray(rawFields) ? rawFields : []).map((f: any) => ({
          name: f.VariableName || f.FieldName || f.name || f.Name || f.Title,
          type: f.DataType || f.FieldType || f.type || f.Type || 'text',
          required: f.Required || f.required || false,
        }));
        setEcmFields(formattedFields);
        setAllProjectFields(prev => ({ ...prev, [projectId]: formattedFields }));
      } else {
        const url = config.url?.replace(/\/$/, '');
        const fieldsUrl = `${url}/api/projects/${projectId}/fields`;
        
        // Use safe-fetch edge function to prevent SSRF attacks
        const { data: safeData, error: safeError } = await supabase.functions.invoke('safe-fetch', {
          body: {
            url: fieldsUrl,
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(`${config.username}:${config.password}`)}`,
              'Accept': 'application/json',
            },
          },
        });

        if (safeError) throw safeError;
        if (!safeData || safeData.error) {
          throw new Error(safeData?.error || 'Failed to fetch from external API');
        }

        if (safeData.status >= 200 && safeData.status < 300) {
          const fieldsData = JSON.parse(safeData.body);
          const formattedFields = (Array.isArray(fieldsData) ? fieldsData : []).map((f: any) => ({
            name: f.FieldName || f.name || f.Name,
            type: f.FieldType || f.type || f.Type || 'text',
            required: f.Required || f.required || false
          }));
          setEcmFields(formattedFields);
          setAllProjectFields(prev => ({ ...prev, [projectId]: formattedFields }));
        } else {
          toast.error('Failed to fetch project fields');
        }
      }
    } catch (error: any) {
      console.error('Error fetching project fields:', error);
      toast.error('Failed to fetch project fields');
    } finally {
      setLoadingFields(false);
    }
  };

  const handleAddLookupField = () => {
    const currentFields = config.lookupFields || [];
    onConfigChange({
      ...config,
      lookupFields: [
        ...currentFields,
        { wisdmField: '', ecmField: '', lookupEnabled: true }
      ]
    });
  };

  const handleRemoveLookupField = (index: number) => {
    const currentFields = config.lookupFields || [];
    onConfigChange({
      ...config,
      lookupFields: currentFields.filter((_, i) => i !== index)
    });
  };

  const handleUpdateLookupField = (index: number, field: Partial<ValidationLookupField>) => {
    const currentFields = config.lookupFields || [];
    const updated = [...currentFields];
    updated[index] = { ...updated[index], ...field };
    onConfigChange({
      ...config,
      lookupFields: updated
    });
  };

  const isTestButtonDisabled = disabled || testing || config.system === 'none' ||
    (config.system === 'sql'
      ? !config.sqlHost || !config.sqlDatabase || !config.username || !config.password || !config.sqlDialect
      : (config.system === 'excel' || config.system === 'csv')
        ? !config.excelFileUrl
        : (!config.url || !config.username || !config.password));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="lookup-system" className="text-xs mb-1">
            Lookup System *
          </Label>
          <Select
            value={config.system}
            onValueChange={(value: 'filebound' | 'docmgt' | 'sql' | 'excel' | 'csv' | 'none') => 
              onConfigChange({ ...config, system: value })
            }
            disabled={disabled}
          >
            <SelectTrigger id="lookup-system">
              <SelectValue placeholder="Select system..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- None --</SelectItem>
              <SelectItem value="filebound">FileBound</SelectItem>
              <SelectItem value="docmgt">DocMgt</SelectItem>
              <SelectItem value="sql">SQL Database</SelectItem>
              <SelectItem value="excel">Excel Spreadsheet</SelectItem>
              <SelectItem value="csv">CSV File</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.system === 'sql' ? (
          <>
            <div>
              <Label htmlFor="sql-dialect" className="text-xs mb-1">
                SQL Dialect *
              </Label>
              <Select
                value={config.sqlDialect || ''}
                onValueChange={(value: 'mysql' | 'postgresql' | 'sqlserver') => 
                  onConfigChange({ ...config, sqlDialect: value })
                }
                disabled={disabled}
              >
                <SelectTrigger id="sql-dialect">
                  <SelectValue placeholder="Select dialect..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="sqlserver">SQL Server</SelectItem>
                </SelectContent>
              </Select>
            </div>
// ... keep existing code
          </>
        ) : (config.system === 'excel' || config.system === 'csv') ? (
          <div className="col-span-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataFile">
                {config.system === 'csv' ? 'CSV' : 'Excel'} File Upload *
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="dataFile"
                  ref={fileInputRef}
                  type="file"
                  accept={config.system === 'csv' ? '.csv' : '.xlsx,.xls'}
                  onChange={handleFileUpload}
                  disabled={uploadingExcel || disabled}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingExcel || disabled}
                >
                  {config.excelFileName ? 'Replace file' : `Upload ${config.system === 'csv' ? 'CSV' : 'Excel'} file`}
                </Button>
                {config.excelFileName && (
                  <Badge variant="outline">{config.excelFileName}</Badge>
                )}
                {uploadingExcel && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {config.excelFileName && (
                <p className="text-xs text-muted-foreground">
                  Current file: <a href={config.excelFileUrl} target="_blank" rel="noreferrer" className="underline">{config.excelFileName}</a>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Upload {config.system === 'csv' ? 'a CSV file (.csv)' : 'an Excel file (.xlsx or .xls)'} containing validation data
              </p>
            </div>

            {config.excelFileUrl && ecmFields.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="keyColumn">Key Column (for lookups) *</Label>
                <Select
                  value={config.excelKeyColumn || ''}
                  onValueChange={(value) => onConfigChange({ ...config, excelKeyColumn: value })}
                  disabled={disabled}
                >
                  <SelectTrigger id="keyColumn">
                    <SelectValue placeholder="Select key column" />
                  </SelectTrigger>
                  <SelectContent>
                    {ecmFields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Column to match against document file names (typically "File Name")
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="lookup-url" className="text-xs mb-1">
                ECM URL *
              </Label>
              <Input
                id="lookup-url"
                value={config.url || ''}
                onChange={(e) => onConfigChange({ ...config, url: e.target.value })}
                placeholder="https://ecm.example.com"
                disabled={disabled || config.system === 'none'}
              />
            </div>

            <div>
              <Label htmlFor="lookup-username" className="text-xs mb-1">
                Username *
              </Label>
              <Input
                id="lookup-username"
                value={config.username || ''}
                onChange={(e) => onConfigChange({ ...config, username: e.target.value })}
                placeholder="ECM username"
                disabled={disabled || config.system === 'none'}
              />
            </div>

            <div>
              <Label htmlFor="lookup-password" className="text-xs mb-1">
                Password *
              </Label>
              <Input
                id="lookup-password"
                type="password"
                value={config.password || ''}
                onChange={(e) => onConfigChange({ ...config, password: e.target.value })}
                placeholder="ECM password"
                disabled={disabled || config.system === 'none'}
              />
            </div>
          </>
        )}

        <div className="flex items-end col-span-2">
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={isTestButtonDisabled}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : connectionStatus === 'success' ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                {(config.system === 'excel' || config.system === 'csv') ? 'File Ready' : 'Connected'}
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <X className="h-4 w-4 mr-2 text-red-500" />
                Failed
              </>
            ) : (
              (config.system === 'excel' || config.system === 'csv') ? (config.excelFileUrl ? 'File Ready' : 'Upload a file to continue') : 'Test Connection'
            )}
          </Button>
        </div>
      </div>

      {config.system === 'docmgt' && (
        <div>
          <Label htmlFor="lookup-recordTypeId" className="text-xs mb-1">
            RecordTypeID (Numeric) *
          </Label>
          <Input
            id="lookup-recordTypeId"
            type="number"
            placeholder="e.g., 53"
            value={config.recordTypeId || ''}
            onChange={(e) => onConfigChange({ ...config, recordTypeId: e.target.value })}
            disabled={disabled}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The numeric RecordTypeID to query in DocMgt.
          </p>
        </div>
      )}

      {connectionStatus === 'success' && availableProjects.length > 0 && (
        <div>
          <Label htmlFor="lookup-project" className="text-xs mb-1">
            Select Project *
          </Label>
          <Select value={selectedProjectId} onValueChange={handleProjectSelect} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a project..." />
            </SelectTrigger>
            <SelectContent>
              {availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                  {project.description && <span className="text-xs text-muted-foreground ml-2">({project.description})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {((selectedProjectId && ecmFields.length > 0) || (config.system === 'sql' && ecmFields.length > 0) || (config.system === 'excel' && config.excelFileUrl && ecmFields.length > 0)) && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Lookup Field Configuration</Label>
            {loadingFields && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLookupField}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Configure which fields can be used for validation lookups. When enabled, users can search {config.system === 'excel' ? 'the Excel file' : config.system.toUpperCase()} during validation.
          </p>
          
          {(!config.lookupFields || config.lookupFields.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No lookup fields configured. Click "Add Field" to start.
            </p>
          )}

          <div className="space-y-2">
            {(config.lookupFields || []).map((lookupField, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-background rounded-md border">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">WISDM Field</Label>
                    <Select
                      value={lookupField.wisdmField}
                      onValueChange={(value) => handleUpdateLookupField(index, { wisdmField: value })}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {extractionFields.filter(f => f.name.trim()).map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div>
                    <Label className="text-xs">
                      {config.system === 'sql' ? 'SQL Column' : config.system === 'excel' ? 'Excel Column' : 'ECM Lookup Field'}
                    </Label>
                    <Select
                      value={lookupField.ecmField}
                      onValueChange={(value) => handleUpdateLookupField(index, { ecmField: value })}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ecmFields.map((ecmField) => (
                          <SelectItem key={ecmField.name} value={ecmField.name}>
                            {ecmField.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLookupField(index)}
                  disabled={disabled}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
