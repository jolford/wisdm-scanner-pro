import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportConfig {
  enabled: boolean;
  destination: string;
  url?: string;
  username?: string;
  password?: string;
  accessToken?: string; // For SharePoint OAuth
  project?: string;
  recordTypeId?: string; // For DocMgt RecordTypeID (numeric)
  repository?: string; // For Documentum
  cabinet?: string; // For Documentum
  library?: string; // For SharePoint
  folder?: string; // For SharePoint
  fieldMappings?: Record<string, string>;
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

interface ECMExportConfigProps {
  type: 'filebound' | 'docmgt' | 'documentum' | 'sharepoint';
  config: ExportConfig;
  extractionFields: Array<{ name: string; description: string }>;
  onConfigChange: (config: ExportConfig) => void;
  disabled?: boolean;
}

export function ECMExportConfig({ 
  type, 
  config, 
  extractionFields,
  onConfigChange,
  disabled = false 
}: ECMExportConfigProps) {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [availableProjects, setAvailableProjects] = useState<ECMProject[]>([]);
  const [allProjectFields, setAllProjectFields] = useState<Record<string, ECMField[]>>({});
  const [ecmFields, setEcmFields] = useState<ECMField[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(config.project || '');
  const [loadingFields, setLoadingFields] = useState(false);

  const testConnection = async () => {
    // Validate required fields based on ECM type
    if (!config.url) {
      toast.error('ECM URL is required');
      return;
    }
    
    if (type === 'sharepoint') {
      if (!config.accessToken) {
        toast.error('Access token is required for SharePoint');
        return;
      }
    } else {
      if (!config.username || !config.password) {
        toast.error('Username and password are required');
        return;
      }
    }

    setTesting(true);
    setConnectionStatus('idle');

    try {
      // Map ECM type to function name
      const functionMap = {
        'filebound': 'test-filebound-connection',
        'docmgt': 'test-docmgt-connection',
        'documentum': 'test-documentum-connection',
        'sharepoint': 'test-sharepoint-connection',
      };
      
      const functionName = functionMap[type];
      
      // Build request body based on ECM type
      const requestBody = type === 'sharepoint' 
        ? { url: config.url, accessToken: config.accessToken }
        : { url: config.url, username: config.username, password: config.password };
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody,
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        
        // Handle different response structures
        let projects: ECMProject[] = [];
        
        if (type === 'documentum') {
          // Documentum returns repositories with cabinets
          projects = (data.repositories || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            description: `Repository with ${r.cabinets?.length || 0} cabinets`,
          }));
        } else if (type === 'sharepoint') {
          // SharePoint returns libraries with fields
          projects = (data.libraries || []).map((l: any) => ({
            id: l.id,
            name: l.name,
            description: `Document library with ${l.fields?.length || 0} fields`,
          }));
        } else {
          // FileBound and DocMgt return projects
          projects = (data.projects || []).map((p: any) => ({
            id: p.ProjectId?.toString() || p.id?.toString() || p.ID?.toString(),
            name: p.Name || p.name || p.Title,
            description: p.Description || p.description || p.Summary
          }));
        }
        
        setAvailableProjects(projects);
        
        // Store all project/repository/library fields
        if (data.projectFields || data.libraries || data.repositories) {
          const formattedFields: Record<string, ECMField[]> = {};
          
          if (type === 'sharepoint' && data.libraries) {
            data.libraries.forEach((lib: any) => {
              formattedFields[lib.id] = (lib.fields || []).map((f: any) => ({
                name: f.InternalName || f.Title || f.name,
                type: f.TypeAsString || f.type || 'text',
                required: f.Required || false
              }));
            });
          } else if (data.projectFields) {
            Object.entries(data.projectFields).forEach(([projId, fields]) => {
              formattedFields[projId] = (fields as any[]).map((f: any) => ({
                // Handle different property names from different ECM systems
                // DocMgt uses: VariableName, DataType
                // FileBound uses: FieldName, FieldType
                // Others use: name, type
                name: f.VariableName || f.FieldName || f.name || f.Name || f.Title,
                type: f.DataType || f.FieldType || f.type || f.Type || 'text',
                required: f.Required || f.required || false
              }));
            });
          }
          
          setAllProjectFields(formattedFields);
        }
        
        toast.success(`Successfully connected to ${type.toUpperCase()}`);
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
      // For DocMgt, also store the ID as recordTypeId if it's numeric
      ...(type === 'docmgt' && !isNaN(Number(projectId)) ? { recordTypeId: projectId } : {}),
    });

    // Check if we already have fields for this project
    if (allProjectFields[projectId]) {
      setEcmFields(allProjectFields[projectId]);
      return;
    }

    // Otherwise, fetch fields for this specific project
    setLoadingFields(true);
    try {
      if (type === 'docmgt') {
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
        const response = await fetch(fieldsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(`${config.username}:${config.password}`)}`,
            'Accept': 'application/json',
          },
        });
        if (response.ok) {
          const fieldsData = await response.json();
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

  const handleFieldMapping = (wisdmField: string, ecmField: string) => {
    const currentMappings = config.fieldMappings || {};
    
    // If user selected "none", remove the mapping
    if (ecmField === '__none__') {
      const { [wisdmField]: removed, ...rest } = currentMappings;
      onConfigChange({
        ...config,
        fieldMappings: rest,
      });
      return;
    }
    
    onConfigChange({
      ...config,
      fieldMappings: {
        ...currentMappings,
        [wisdmField]: ecmField,
      },
    });
  };

  const isSharePoint = type === 'sharepoint';
  const isTestButtonDisabled = disabled || testing || !config.url || 
    (isSharePoint ? !config.accessToken : (!config.username || !config.password));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`url-${type}`} className="text-xs mb-1">
            {type === 'sharepoint' ? 'SharePoint Site URL' : 'ECM URL'} *
          </Label>
          <Input
            id={`url-${type}`}
            value={config.url || ''}
            onChange={(e) => onConfigChange({ ...config, url: e.target.value })}
            placeholder={type === 'sharepoint' ? 'https://contoso.sharepoint.com/sites/yoursite' : 'https://ecm.example.com'}
            disabled={disabled}
          />
        </div>
        
        {isSharePoint ? (
          <div>
            <Label htmlFor={`token-${type}`} className="text-xs mb-1">
              Access Token *
            </Label>
            <Input
              id={`token-${type}`}
              type="password"
              value={config.accessToken || ''}
              onChange={(e) => onConfigChange({ ...config, accessToken: e.target.value })}
              placeholder="Bearer token for SharePoint API"
              disabled={disabled}
            />
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor={`username-${type}`} className="text-xs mb-1">
                Username *
              </Label>
              <Input
                id={`username-${type}`}
                value={config.username || ''}
                onChange={(e) => onConfigChange({ ...config, username: e.target.value })}
                placeholder="ECM username"
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor={`password-${type}`} className="text-xs mb-1">
                Password *
              </Label>
              <Input
                id={`password-${type}`}
                type="password"
                value={config.password || ''}
                onChange={(e) => onConfigChange({ ...config, password: e.target.value })}
                placeholder="ECM password"
                disabled={disabled}
              />
            </div>
          </>
        )}
        
        <div className="flex items-end">
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

      {type === 'docmgt' && (
        <div className="mt-3">
          <Label htmlFor="recordTypeId" className="text-xs mb-1">
            RecordTypeID (Numeric) *
          </Label>
          <Input
            id="recordTypeId"
            type="number"
            placeholder="e.g., 53"
            value={config.recordTypeId || ''}
            onChange={(e) => onConfigChange({ ...config, recordTypeId: e.target.value })}
            disabled={disabled}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The numeric RecordTypeID where documents will be filed in DocMgt.
          </p>
        </div>
      )}


      {connectionStatus === 'success' && availableProjects.length > 0 && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`project-${type}`} className="text-xs mb-1">
              {type === 'documentum' ? 'Select Repository' : type === 'sharepoint' ? 'Select Library' : 'Select Project'} *
            </Label>
            <Select value={selectedProjectId} onValueChange={handleProjectSelect} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder={`Choose a ${type === 'documentum' ? 'repository' : type === 'sharepoint' ? 'library' : 'project'}...`} />
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
            <Label className="text-sm font-medium">Field Mapping</Label>
            {loadingFields && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Map your WISDM extraction fields to {type.toUpperCase()} index fields
          </p>
          <div className="space-y-2">
            {extractionFields.filter(f => f.name.trim()).map((field) => (
              <div key={field.name} className="flex items-center gap-2 p-2 bg-background rounded-md border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{field.name}</div>
                  {field.description && (
                    <div className="text-xs text-muted-foreground truncate">{field.description}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Select
                  value={config.fieldMappings?.[field.name] || '__none__'}
                  onValueChange={(value) => handleFieldMapping(field.name, value)}
                  disabled={disabled || loadingFields}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="__none__">-- No mapping --</SelectItem>
                    {ecmFields.map((ecmField) => (
                      <SelectItem key={ecmField.name} value={ecmField.name}>
                        {ecmField.name}
                        {ecmField.required && <span className="text-destructive ml-1">*</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {selectedProjectId && ecmFields.length === 0 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Field Mapping</Label>
            {loadingFields && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            No fields were returned from {type.toUpperCase()}. You can still map by typing the exact Variable names.
          </p>
          <div className="space-y-2">
            {extractionFields.filter(f => f.name.trim()).map((field) => (
              <div key={field.name} className="flex items-center gap-2 p-2 bg-background rounded-md border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{field.name}</div>
                  {field.description && (
                    <div className="text-xs text-muted-foreground truncate">{field.description}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder="Enter DocMgt field (VariableName)"
                  value={config.fieldMappings?.[field.name] || ''}
                  onChange={(e) => handleFieldMapping(field.name, e.target.value)}
                  disabled={disabled}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

