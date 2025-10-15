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
  project?: string;
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
  type: 'filebound' | 'docmgt';
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
    if (!config.url || !config.username || !config.password) {
      toast.error('Please fill in all connection fields');
      return;
    }

    setTesting(true);
    setConnectionStatus('idle');

    try {
      const functionName = type === 'filebound' ? 'test-filebound-connection' : 'test-docmgt-connection';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          url: config.url,
          username: config.username,
          password: config.password,
        },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        const projects = data.projects.map((p: any) => ({
          id: p.ProjectId?.toString() || p.id?.toString(),
          name: p.Name || p.name,
          description: p.Description || p.description
        }));
        setAvailableProjects(projects);
        
        // Store all project fields for later use
        if (data.projectFields) {
          const formattedFields: Record<string, ECMField[]> = {};
          Object.entries(data.projectFields).forEach(([projId, fields]) => {
            formattedFields[projId] = (fields as any[]).map((f: any) => ({
              name: f.FieldName || f.name || f.Name,
              type: f.FieldType || f.type || f.Type || 'text',
              required: f.Required || f.required || false
            }));
          });
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
    });

    // Check if we already have fields for this project
    if (allProjectFields[projectId]) {
      setEcmFields(allProjectFields[projectId]);
      return;
    }

    // Otherwise, fetch fields for this specific project
    setLoadingFields(true);
    try {
      const functionName = type === 'filebound' ? 'test-filebound-connection' : 'test-docmgt-connection';
      
      // Make a request to fetch just this project's fields
      const url = config.url?.replace(/\/$/, '');
      const fieldsUrl = type === 'filebound' 
        ? `${url}/api/projects/${projectId}/fields`
        : `${url}/api/v1/projects/${projectId}/fields`;
      
      // We'll need to call the edge function with a special parameter or create a new endpoint
      // For now, let's use the connection test with the project ID
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
        setAllProjectFields(prev => ({
          ...prev,
          [projectId]: formattedFields
        }));
      } else {
        toast.error('Failed to fetch project fields');
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`url-${type}`} className="text-xs mb-1">
            ECM URL *
          </Label>
          <Input
            id={`url-${type}`}
            value={config.url || ''}
            onChange={(e) => onConfigChange({ ...config, url: e.target.value })}
            placeholder="https://ecm.example.com"
            disabled={disabled}
          />
        </div>
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
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={disabled || testing || !config.url || !config.username || !config.password}
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

      {connectionStatus === 'success' && availableProjects.length > 0 && (
        <div>
          <Label htmlFor={`project-${type}`} className="text-xs mb-1">
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
    </div>
  );
}
