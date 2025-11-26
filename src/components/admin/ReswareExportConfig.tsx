import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, TestTube, CheckCircle2, XCircle, FileText, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface ReswareExportConfigProps {
  projectId: string;
  currentConfig: any;
  onConfigChange: (config: any) => void;
}

export const ReswareExportConfig = ({ projectId, currentConfig, onConfigChange }: ReswareExportConfigProps) => {
  const [enabled, setEnabled] = useState(currentConfig?.enabled || false);
  const [apiUrl, setApiUrl] = useState(currentConfig?.url || currentConfig?.apiUrl || '');
  const [username, setUsername] = useState(currentConfig?.username || '');
  const [password, setPassword] = useState(currentConfig?.password || '');
  const [orderId, setOrderId] = useState(currentConfig?.orderId || '');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(currentConfig?.fieldMapping || {});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Standard mortgage fields for mapping
  const standardFields = [
    { key: 'Borrower Name', label: 'Borrower Name', category: 'borrower' },
    { key: 'Social Security Number', label: 'SSN', category: 'borrower' },
    { key: 'Date of Birth', label: 'Date of Birth', category: 'borrower' },
    { key: 'Work Phone', label: 'Work Phone', category: 'borrower' },
    { key: 'Current Address', label: 'Address', category: 'borrower' },
    { key: 'City', label: 'City', category: 'borrower' },
    { key: 'State', label: 'State', category: 'borrower' },
    { key: 'Zip', label: 'ZIP Code', category: 'borrower' },
    { key: 'Citizenship', label: 'Citizenship', category: 'borrower' },
    { key: 'Loan Identifier', label: 'Loan Number', category: 'loan' },
    { key: 'Monthly Income', label: 'Monthly Income', category: 'loan' },
    { key: 'Base Income', label: 'Base Income', category: 'loan' },
    { key: 'Overtime', label: 'Overtime Pay', category: 'loan' },
    { key: 'Business Name', label: 'Employer', category: 'loan' },
  ];

  const handleSave = () => {
    const config = {
      enabled,
      url: apiUrl,
      apiUrl: apiUrl,
      username,
      password,
      orderId,
      fieldMapping,
    };
    onConfigChange(config);
    toast.success('Resware configuration saved');
  };

  const handleTest = async () => {
    if (!apiUrl || !username || !password) {
      toast.error('Please fill in all connection details');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-resware-connection', {
        body: { url: apiUrl, username, password },
      });

      if (error) throw error;

      setTestResult({
        success: data.success,
        message: data.message || 'Connection test completed',
      });

      if (data.success) {
        toast.success('Resware connection successful');
      } else {
        toast.error(data.error || 'Connection test failed');
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setTestResult({
        success: false,
        message: error.message,
      });
      toast.error(`Connection test failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const updateFieldMapping = (sourceField: string, targetField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [sourceField]: targetField,
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resware Export Configuration
              </CardTitle>
              <CardDescription>
                Configure connection to Resware title & settlement platform for mortgage document exports
              </CardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="connection">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="instructions">Setup Guide</TabsTrigger>
            </TabsList>

            <TabsContent value="connection" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="resware-url">Resware API URL</Label>
                <Input
                  id="resware-url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://your-instance.resware.com"
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Your Resware instance URL (e.g., https://yourcompany.resware.com)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resware-username">Username</Label>
                  <Input
                    id="resware-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="API Username"
                    disabled={!enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resware-password">Password</Label>
                  <Input
                    id="resware-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="API Password"
                    disabled={!enabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resware-order">Default Order ID (Optional)</Label>
                <Input
                  id="resware-order"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Leave blank to use batch-specific order IDs"
                  disabled={!enabled}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleTest}
                  disabled={!enabled || !apiUrl || !username || !password || isTesting}
                  variant="outline"
                  className="gap-2"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>

                {testResult && (
                  <Badge variant={testResult.success ? 'default' : 'destructive'} className="gap-1">
                    {testResult.success ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {testResult.message}
                  </Badge>
                )}
              </div>
            </TabsContent>

            <TabsContent value="mapping" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Map your extracted fields to Resware field names
                </div>

                {['borrower', 'loan'].map(category => (
                  <div key={category} className="space-y-3">
                    <h4 className="font-semibold text-sm capitalize border-b pb-2">
                      {category} Information
                    </h4>
                    {standardFields
                      .filter(field => field.category === category)
                      .map(field => (
                        <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                          <Label className="text-sm">{field.label}</Label>
                          <Input
                            value={fieldMapping[field.key] || field.key}
                            onChange={(e) => updateFieldMapping(field.key, e.target.value)}
                            placeholder={`Resware field name for ${field.label}`}
                            disabled={!enabled}
                            className="text-sm"
                          />
                        </div>
                      ))}
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    💡 Leave fields blank to use default field names. Custom field mappings allow you
                    to match your Resware schema exactly.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="instructions" className="space-y-4 mt-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-base font-semibold mb-3">Setup Instructions</h3>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-semibold mb-1">1. Obtain Resware API Credentials</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Log in to your Resware admin portal</li>
                      <li>Navigate to Settings → API Access</li>
                      <li>Create a new API user with document upload permissions</li>
                      <li>Save the username and password for API access</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">2. Enter Connection Details</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Enter your Resware instance URL (e.g., https://yourcompany.resware.com)</li>
                      <li>Enter the API username and password</li>
                      <li>Optionally specify a default Order ID for document routing</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">3. Configure Field Mapping</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Map extracted fields to your Resware field names</li>
                      <li>Borrower information and loan details are automatically categorized</li>
                      <li>Custom fields not in standard categories are exported as-is</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-1">4. Test & Export</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Click "Test Connection" to verify credentials</li>
                      <li>Enable the integration using the toggle</li>
                      <li>Documents will export to Resware when batches are completed</li>
                      <li>Monitor export status in the batch details view</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Only validated documents are exported to Resware. 
                    Documents must pass validation before they can be sent to your title & settlement system.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={!enabled}>
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
