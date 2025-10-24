import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
  system: 'filebound' | 'docmgt' | 'none';
  url?: string;
  username?: string;
  password?: string;
  project?: string;
  recordTypeId?: string;
  lookupFields?: ValidationLookupField[];
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

  const testConnection = async () => {
    if (!config.url || !config.username || !config.password) {
      toast.error('URL, username, and password are required');
      return;
    }

    if (config.system === 'none') {
      toast.error('Please select a system first');
      return;
    }

    setTesting(true);
    setConnectionStatus('idle');

    try {
      const functionMap = {
        'filebound': 'test-filebound-connection',
        'docmgt': 'test-docmgt-connection',
      };
      
      const functionName = functionMap[config.system];
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          url: config.url, 
          username: config.username, 
          password: config.password 
        },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        
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

  const isTestButtonDisabled = disabled || testing || !config.url || !config.username || !config.password || config.system === 'none';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="lookup-system" className="text-xs mb-1">
            Lookup System *
          </Label>
          <Select
            value={config.system}
            onValueChange={(value: 'filebound' | 'docmgt' | 'none') => 
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
            </SelectContent>
          </Select>
        </div>

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
                Connected
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <X className="h-4 w-4 mr-2 text-red-500" />
                Failed
              </>
            ) : (
              'Test Connection'
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

      {selectedProjectId && ecmFields.length > 0 && (
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
            Configure which fields can be used for validation lookups. When enabled, users can search {config.system.toUpperCase()} during validation.
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
                    <Label className="text-xs">ECM Lookup Field</Label>
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
