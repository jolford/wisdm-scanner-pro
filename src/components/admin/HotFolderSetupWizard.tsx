import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Download, Play, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface HotFolderSetupWizardProps {
  projectId: string;
  customerId?: string;
  onComplete?: () => void;
}

export function HotFolderSetupWizard({ projectId, customerId, onComplete }: HotFolderSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [setupType, setSetupType] = useState<"cloud" | "local" | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [watchFolder, setWatchFolder] = useState("auto-import");
  const [batchTemplate, setBatchTemplate] = useState("Scanned_{date}");
  const [autoCreateBatch, setAutoCreateBatch] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [nextAction, setNextAction] = useState<"cloud" | "local" | "test" | null>(null);

  const steps = [
    { id: 1, title: "Choose Setup Type", icon: Settings },
    { id: 2, title: "Configure Settings", icon: Settings },
    { id: 3, title: "Test & Activate", icon: Play },
  ];

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const config = {
        project_id: projectId,
        customer_id: customerId,
        watch_folder: watchFolder,
        batch_name_template: batchTemplate,
        auto_create_batch: autoCreateBatch,
        is_active: isActive,
        created_by: user.id,
      };

      if (configId) {
        const { error } = await supabase
          .from("scanner_import_configs")
          .update(config)
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("scanner_import_configs")
          .insert([config])
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success("Configuration saved successfully");
      return true;
    } catch (error: any) {
      toast.error("Failed to save configuration: " + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("process-scanner-imports");
      if (error) throw error;
      toast.success("Test import triggered successfully");
    } catch (error: any) {
      toast.error("Test failed: " + error.message);
    } finally {
      setTesting(false);
    }
  };

  const downloadFile = async (filename: string) => {
    const response = await fetch(`/downloads/${filename}`);
    if (!response.ok) throw new Error('File not found');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDownload = async (e: React.MouseEvent, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await downloadFile(filename);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error(`Failed to download ${filename}`);
    }
  };

  const handleDownloadBundle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await downloadFile('scanner-sync-agent.js');
      await new Promise((r) => setTimeout(r, 150));
      await downloadFile('.env.scanner-sync');
      await new Promise((r) => setTimeout(r, 150));
      await downloadFile('package.json');
      toast.success('Downloaded agent files');
    } catch (err) {
      console.error('Bundle download error:', err);
      toast.error('Failed to download agent files');
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      const success = await handleSaveConfig();
      if (!success) return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  currentStep > step.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : currentStep === step.id
                    ? "border-primary bg-background text-primary"
                    : "border-muted bg-background text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="mt-2 text-sm font-medium">{step.title}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Choose Your Setup Type</h3>
              <p className="text-sm text-muted-foreground mb-4">
                How will documents reach the system?
              </p>
            </div>

            <div className="grid gap-4">
              <button
                onClick={() => {
                  setSetupType("cloud");
                  setCurrentStep(2);
                }}
                className="text-left p-4 border-2 border-muted rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Settings className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Cloud Storage (Recommended)</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Files upload to cloud storage, processed automatically every 5 minutes
                    </p>
                    <Badge variant="secondary">No desktop agent needed</Badge>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSetupType("local");
                  setCurrentStep(2);
                }}
                className="text-left p-4 border-2 border-muted rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Local Network Scanner</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Desktop agent watches local folder and syncs to cloud
                    </p>
                    <Badge variant="secondary">Requires sync agent</Badge>
                  </div>
                </div>
              </button>
            </div>

            {setupType === "local" && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-4">
                    <p className="font-medium">📦 Download Sync Agent Files:</p>
                    <div className="grid gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDownload(e, 'scanner-sync-agent.js')}
                        className="justify-start h-auto py-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        scanner-sync-agent.js
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDownload(e, '.env.scanner-sync')}
                        className="justify-start h-auto py-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        .env.scanner-sync (configuration template)
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDownload(e, 'package.json')}
                        className="justify-start h-auto py-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        package.json
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDownload(e, 'SCANNER_SYNC_SETUP.md')}
                        className="justify-start h-auto py-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        SCANNER_SYNC_SETUP.md (full instructions)
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Note:</strong> Both methods are configured the same way in WISDM. The difference
                is where files are placed initially.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Configure Hot Folder Settings</h3>
              <p className="text-sm text-muted-foreground">
                Set up how documents should be imported and organized
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="watch-folder">Watch Folder Path</Label>
                <Input
                  id="watch-folder"
                  value={watchFolder}
                  onChange={(e) => setWatchFolder(e.target.value)}
                  placeholder="e.g., auto-import or C:\AutoImport"
                />
                <p className="text-xs text-muted-foreground">
                  Cloud storage path (e.g., "auto-import") or local path for desktop agent
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-template">Batch Name Template</Label>
                <Input
                  id="batch-template"
                  value={batchTemplate}
                  onChange={(e) => setBatchTemplate(e.target.value)}
                  placeholder="Scanned_{date}"
                />
                <p className="text-xs text-muted-foreground">
                  Use {`{date}`} for current date. Example: "Invoices_{`{date}`}"
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-batch">Auto-Create Batches</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically group imported documents into batches
                  </p>
                </div>
                <Switch
                  id="auto-batch"
                  checked={autoCreateBatch}
                  onCheckedChange={setAutoCreateBatch}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="is-active">Enable Auto-Import</Label>
                  <p className="text-xs text-muted-foreground">
                    Start monitoring the folder immediately
                  </p>
                </div>
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                The system checks for new files every 5 minutes automatically. Supported formats:
                PDF, JPEG, PNG, TIFF (max 50MB)
              </AlertDescription>
            </Alert>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Test & Activate</h3>
              <p className="text-sm text-muted-foreground">
                Verify your configuration is working correctly
              </p>
            </div>

            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">✓ Configuration saved successfully!</p>
                  <p className="text-sm">Watch Folder: <code className="text-xs bg-muted px-1 py-0.5 rounded">{watchFolder}</code></p>
                  <p className="text-sm">Batch Template: <code className="text-xs bg-muted px-1 py-0.5 rounded">{batchTemplate}</code></p>
                  <div className="text-sm">
                    Status: <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-semibold">Next Steps</h4>
                
                <RadioGroup value={nextAction ?? ''} onValueChange={(v) => setNextAction(v as any)} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="cloud" id="ns-cloud" className="mt-1.5" />
                    <div className="flex-1">
                      <Label htmlFor="ns-cloud" className="font-medium">For Cloud Storage</Label>
                      <p className="text-muted-foreground">Upload test files to the storage bucket at path: <code className="text-xs bg-muted px-1 py-0.5 rounded">{watchFolder}</code></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="local" id="ns-local" className="mt-1.5" />
                    <div className="flex-1">
                      <Label htmlFor="ns-local" className="font-medium">For Local Scanner</Label>
                      <p className="text-muted-foreground mb-2">Download and configure the sync agent</p>
                      {nextAction === 'local' && (
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={(e) => handleDownloadBundle(e)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Agent Files
                          </Button>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={(e) => handleDownload(e, 'SCANNER_SYNC_SETUP.md')}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Setup Guide
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="test" id="ns-test" className="mt-1.5" />
                    <div className="flex-1">
                      <Label htmlFor="ns-test" className="font-medium">Test Now</Label>
                      <p className="text-muted-foreground">Place a test file and click "Test Import" to verify</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <Button
                onClick={handleTest}
                disabled={testing}
                variant="outline"
                className="w-full"
              >
                {testing ? "Testing..." : "Test Import Now"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={saving}
        >
          {currentStep === 3 ? "Complete Setup" : saving ? "Saving..." : "Next"}
        </Button>
      </div>
    </div>
  );
}
