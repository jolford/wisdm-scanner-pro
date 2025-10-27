import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailImportConfigProps {
  projectId: string;
  customerId?: string;
}

export function EmailImportConfig({ projectId, customerId }: EmailImportConfigProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [configId, setConfigId] = useState<string | null>(null);
  const [emailHost, setEmailHost] = useState("");
  const [emailPort, setEmailPort] = useState(993);
  const [emailUsername, setEmailUsername] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailFolder, setEmailFolder] = useState("INBOX");
  const [useSsl, setUseSsl] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [autoCreateBatch, setAutoCreateBatch] = useState(true);
  const [batchTemplate, setBatchTemplate] = useState("Email Import {date}");
  const [deleteAfterImport, setDeleteAfterImport] = useState(false);
  const [markAsRead, setMarkAsRead] = useState(true);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_import_configs")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setEmailHost(data.email_host || "");
        setEmailPort(data.email_port || 993);
        setEmailUsername(data.email_username || "");
        setEmailPassword(data.email_password || "");
        setEmailFolder(data.email_folder || "INBOX");
        setUseSsl(data.use_ssl ?? true);
        setIsActive(data.is_active ?? true);
        setAutoCreateBatch(data.auto_create_batch ?? true);
        setBatchTemplate(data.batch_name_template || "Email Import {date}");
        setDeleteAfterImport(data.delete_after_import ?? false);
        setMarkAsRead(data.mark_as_read ?? true);
        setLastCheckAt(data.last_check_at);
        setLastError(data.last_error);
      }
    } catch (error: any) {
      console.error("Error loading config:", error);
      toast({
        title: "Error",
        description: "Failed to load email import configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!emailHost || !emailUsername || !emailPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required email settings",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const configData = {
        project_id: projectId,
        customer_id: customerId,
        email_host: emailHost,
        email_port: emailPort,
        email_username: emailUsername,
        email_password: emailPassword,
        email_folder: emailFolder,
        use_ssl: useSsl,
        is_active: isActive,
        auto_create_batch: autoCreateBatch,
        batch_name_template: batchTemplate,
        delete_after_import: deleteAfterImport,
        mark_as_read: markAsRead,
        created_by: user.id,
      };

      if (configId) {
        const { error } = await supabase
          .from("email_import_configs")
          .update(configData)
          .eq("id", configId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("email_import_configs")
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        setConfigId(data.id);
      }

      toast({
        title: "Success",
        description: "Email import configuration saved",
      });
    } catch (error: any) {
      console.error("Error saving config:", error);
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
      setTesting(true);
      const { data, error } = await supabase.functions.invoke("process-email-imports");

      if (error) throw error;

      toast({
        title: "Test Complete",
        description: `Processed ${data.totalProcessed || 0} emails`,
      });

      loadConfig(); // Reload to get updated last_check_at
    } catch (error: any) {
      console.error("Error testing import:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to test import",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>Email Import Configuration</CardTitle>
        </div>
        <CardDescription>
          Monitor an email inbox for documents to process automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Configure an email inbox to monitor. Any attachments from incoming emails will be
            automatically imported as documents. Supports IMAP/POP3 email accounts.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-host">IMAP Host *</Label>
              <Input
                id="email-host"
                value={emailHost}
                onChange={(e) => setEmailHost(e.target.value)}
                placeholder="imap.gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-port">Port *</Label>
              <Input
                id="email-port"
                type="number"
                value={emailPort}
                onChange={(e) => setEmailPort(parseInt(e.target.value))}
                placeholder="993"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-username">Email Address *</Label>
            <Input
              id="email-username"
              type="email"
              value={emailUsername}
              onChange={(e) => setEmailUsername(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-password">Password / App Password *</Label>
            <Input
              id="email-password"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-folder">Email Folder / Mailbox</Label>
            <Input
              id="email-folder"
              value={emailFolder}
              onChange={(e) => setEmailFolder(e.target.value)}
              placeholder="INBOX"
            />
            <p className="text-xs text-muted-foreground">
              Specify which folder to monitor (e.g., INBOX, INBOX/Scans, Documents)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="use-ssl">Use SSL/TLS</Label>
            <Switch
              id="use-ssl"
              checked={useSsl}
              onCheckedChange={setUseSsl}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is-active">Enable Email Import</Label>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-batch">Auto-Create Batches</Label>
            <Switch
              id="auto-batch"
              checked={autoCreateBatch}
              onCheckedChange={setAutoCreateBatch}
            />
          </div>

          {autoCreateBatch && (
            <div className="space-y-2">
              <Label htmlFor="batch-template">Batch Name Template</Label>
              <Input
                id="batch-template"
                value={batchTemplate}
                onChange={(e) => setBatchTemplate(e.target.value)}
                placeholder="Email Import {date}"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{date}"} to include the current date
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="mark-read">Mark Emails as Read</Label>
            <Switch
              id="mark-read"
              checked={markAsRead}
              onCheckedChange={setMarkAsRead}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="delete-after">Delete After Import</Label>
            <Switch
              id="delete-after"
              checked={deleteAfterImport}
              onCheckedChange={setDeleteAfterImport}
            />
          </div>
        </div>

        {lastCheckAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Last checked: {new Date(lastCheckAt).toLocaleString()}
          </div>
        )}

        {lastError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button onClick={saveConfig} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>

          {configId && (
            <Button onClick={testImport} variant="outline" disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Test Import Now
            </Button>
          )}
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Common IMAP Settings:</strong><br />
            Gmail: imap.gmail.com:993 (requires App Password)<br />
            Outlook: outlook.office365.com:993<br />
            Yahoo: imap.mail.yahoo.com:993<br />
            The system checks for new emails every 5 minutes.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
