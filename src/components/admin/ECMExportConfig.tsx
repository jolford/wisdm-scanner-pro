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
  const [ecmFields, setEcmFields] = useState<ECMField[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(config.project || '');

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
        setAvailableProjects(data.projects || []);
        
        // If we got field info, store it
        if (data.projectFields) {
          const firstProjectId = Object.keys(data.projectFields)[0];
          if (firstProjectId) {
            setEcmFields(data.projectFields[firstProjectId] || []);
          }
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

    // Fetch fields for this project
    try {
      const functionName = type === 'filebound' ? 'test-filebound-connection' : 'test-docmgt-connection';
      
      const { data } = await supabase.functions.invoke(functionName, {
        body: {
          url: config.url,
          username: config.username,
          password: config.password,
        },
      });

      if (data.success && data.projectFields && data.projectFields[projectId]) {
        setEcmFields(data.projectFields[projectId]);
      }
    } catch (error) {
      console.error('Error fetching project fields:', error);
    }
  };

  const handleFieldMapping = (wisdmField: string, ecmField: string) => {
    const currentMappings = config.fieldMappings || {};
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
          <Label className="text-sm font-medium mb-3 block">Field Mapping</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Map your WISDM extraction fields to {type.toUpperCase()} project fields
          </p>
          <div className="space-y-2">
            {extractionFields.filter(f => f.name.trim()).map((field) => (
              <div key={field.name} className="flex items-center gap-2">
                <div className="flex-1 text-sm font-medium">{field.name}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={config.fieldMappings?.[field.name] || ''}
                  onValueChange={(value) => handleFieldMapping(field.name, value)}
                  disabled={disabled}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select ECM field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ecmFields.map((ecmField) => (
                      <SelectItem key={ecmField.name} value={ecmField.name}>
                        {ecmField.name}
                        {ecmField.required && ' *'}
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
