import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FolderSync, CheckCircle, AlertCircle, Upload } from 'lucide-react';

interface ScannerAutoImportConfigProps {
  projectId: string;
  customerId?: string;
}

export const ScannerAutoImportConfig = ({ projectId, customerId }: ScannerAutoImportConfigProps) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [watchFolder, setWatchFolder] = useState('');
  const [batchTemplate, setBatchTemplate] = useState('Auto-Import {date}');
  const [isActive, setIsActive] = useState(true);
  const [autoCreateBatch, setAutoCreateBatch] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('scanner_import_configs')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setWatchFolder(data.watch_folder);
        setBatchTemplate(data.batch_name_template);
        setIsActive(data.is_active);
        setAutoCreateBatch(data.auto_create_batch);
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
      toast({
        title: "Error",
        description: "Failed to load auto-import configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!watchFolder.trim()) {
      toast({
        title: "Validation Error",
        description: "Watch folder path is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from('scanner_import_configs')
          .update({
            watch_folder: watchFolder,
            batch_name_template: batchTemplate,
            is_active: isActive,
            auto_create_batch: autoCreateBatch,
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Create new config
        const { data, error } = await supabase
          .from('scanner_import_configs')
          .insert({
            project_id: projectId,
            customer_id: customerId,
            watch_folder: watchFolder,
            batch_name_template: batchTemplate,
            is_active: isActive,
            auto_create_batch: autoCreateBatch,
            created_by: userData.user.id,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(data);
      }

      toast({
        title: "Success",
        description: "Auto-import configuration saved successfully",
      });
      await loadConfig();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testImport = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-scanner-imports');
      
      if (error) throw error;

      toast({
        title: "Import Triggered",
        description: "Auto-import process started. Check logs for results.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger import",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <FolderSync className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Scanner Auto-Import</CardTitle>
            <CardDescription>
              Automatically import files from network scanners or watched folders
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How it works:</strong> Configure your scanner to save files to the designated folder. 
            The system checks every 5 minutes and automatically imports new files into the specified project.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="active">Enable Auto-Import</Label>
              <p className="text-sm text-muted-foreground">
                Activate automatic file processing
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">Watch Folder Path</Label>
            <Input
              id="folder"
              value={watchFolder}
              onChange={(e) => setWatchFolder(e.target.value)}
              placeholder="e.g., customer1/scanner or department/receipts"
            />
            <p className="text-xs text-muted-foreground">
              Path within the scanner-import storage bucket where files will be monitored
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="autoBatch">Auto-Create Batches</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create new batches for imported files
              </p>
            </div>
            <Switch
              id="autoBatch"
              checked={autoCreateBatch}
              onCheckedChange={setAutoCreateBatch}
            />
          </div>

          {autoCreateBatch && (
            <div className="space-y-2">
              <Label htmlFor="template">Batch Name Template</Label>
              <Input
                id="template"
                value={batchTemplate}
                onChange={(e) => setBatchTemplate(e.target.value)}
                placeholder="Auto-Import {date}"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{date}'} to insert current date (e.g., "Auto-Import 2025-01-15")
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button type="button" onClick={saveConfig} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Configuration
          </Button>
          {config && (
            <Button type="button" onClick={testImport} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Test Import Now
            </Button>
          )}
        </div>

        {config && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span>
                Last checked: {config.last_check_at 
                  ? new Date(config.last_check_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Scanner Setup:</strong> Configure your network scanner to save files to the watch folder path. 
            Most scanners support FTP, SMB, or network folder destinations. Contact your scanner administrator for setup assistance.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};