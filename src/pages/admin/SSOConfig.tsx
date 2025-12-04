import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Plus, Settings, Trash2, CheckCircle, XCircle, Key, Link2, FileText, TestTube, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
interface SSOConfig {
  id: string;
  customer_id: string;
  provider_type: string;
  provider_name: string;
  entity_id: string | null;
  sso_url: string | null;
  certificate: string | null;
  metadata_url: string | null;
  attribute_mapping: Record<string, string>;
  is_active: boolean;
  enforce_sso: boolean;
  created_at: string;
}

const providerTemplates = {
  azure_ad: {
    name: "Azure Active Directory",
    icon: "🔷",
    entityIdPlaceholder: "https://sts.windows.net/{tenant-id}/",
    ssoUrlPlaceholder: "https://login.microsoftonline.com/{tenant-id}/saml2",
    docs: "https://docs.microsoft.com/azure/active-directory/saas-apps"
  },
  okta: {
    name: "Okta",
    icon: "🔐",
    entityIdPlaceholder: "http://www.okta.com/{org-id}",
    ssoUrlPlaceholder: "https://{org}.okta.com/app/{app-id}/sso/saml",
    docs: "https://developer.okta.com/docs/guides/saml-application-setup"
  },
  onelogin: {
    name: "OneLogin",
    icon: "🔑",
    entityIdPlaceholder: "https://app.onelogin.com/saml/metadata/{app-id}",
    ssoUrlPlaceholder: "https://{subdomain}.onelogin.com/trust/saml2/http-post/sso/{app-id}",
    docs: "https://developers.onelogin.com/saml"
  },
  custom_saml: {
    name: "Custom SAML",
    icon: "⚙️",
    entityIdPlaceholder: "Your Identity Provider Entity ID",
    ssoUrlPlaceholder: "Your SSO URL",
    docs: ""
  }
};

interface TestResult {
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface TestSummary {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  passCount: number;
  failCount: number;
  warnCount: number;
}

export default function SSOConfig() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SSOConfig | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    provider_type: "azure_ad",
    provider_name: "",
    entity_id: "",
    sso_url: "",
    certificate: "",
    metadata_url: "",
    attribute_mapping: { email: "email", name: "name", groups: "groups" },
    enforce_sso: false
  });

  const testConnection = async (config: SSOConfig) => {
    setIsTesting(config.id);
    setSelectedConfig(config);
    setTestResults(null);
    setTestSummary(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-sso-config', {
        body: {
          config_id: config.id,
          entity_id: config.entity_id,
          sso_url: config.sso_url,
          certificate: config.certificate,
          metadata_url: config.metadata_url
        }
      });

      if (error) throw error;
      
      setTestResults(data.results);
      setTestSummary(data.summary);
      
      if (data.summary.status === 'pass') {
        toast.success('All tests passed!');
      } else if (data.summary.status === 'warn') {
        toast.warning('Tests completed with warnings');
      } else {
        toast.error('Some tests failed');
      }
    } catch (err) {
      toast.error('Failed to test connection');
      console.error(err);
    } finally {
      setIsTesting(null);
    }
  };

  const { data: configs, isLoading } = useQuery({
    queryKey: ["sso-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sso_configs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SSOConfig[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userCustomers } = await supabase
        .from("user_customers")
        .select("customer_id")
        .eq("user_id", userData.user?.id)
        .single();

      const { error } = await supabase.from("sso_configs").insert({
        ...data,
        customer_id: userCustomers?.customer_id,
        created_by: userData.user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso-configs"] });
      toast.success("SSO configuration created");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(`Failed to create SSO config: ${error.message}`)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SSOConfig> & { id: string }) => {
      const { error } = await supabase.from("sso_configs").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso-configs"] });
      toast.success("SSO configuration updated");
    },
    onError: (error) => toast.error(`Failed to update SSO config: ${error.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sso_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso-configs"] });
      toast.success("SSO configuration deleted");
    },
    onError: (error) => toast.error(`Failed to delete SSO config: ${error.message}`)
  });

  const resetForm = () => {
    setFormData({
      provider_type: "azure_ad",
      provider_name: "",
      entity_id: "",
      sso_url: "",
      certificate: "",
      metadata_url: "",
      attribute_mapping: { email: "email", name: "name", groups: "groups" },
      enforce_sso: false
    });
    setSelectedConfig(null);
  };

  const template = providerTemplates[formData.provider_type as keyof typeof providerTemplates];

  return (
    <AdminLayout title="SSO Configuration">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              SSO / SAML Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure Single Sign-On with Azure AD, Okta, OneLogin, or custom SAML providers
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add SSO Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure SSO Provider</DialogTitle>
                <DialogDescription>
                  Set up SAML-based Single Sign-On for your organization
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="provider" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="provider">Provider</TabsTrigger>
                  <TabsTrigger value="saml">SAML Settings</TabsTrigger>
                  <TabsTrigger value="mapping">Attribute Mapping</TabsTrigger>
                </TabsList>
                <TabsContent value="provider" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(providerTemplates).map(([key, provider]) => (
                      <Card 
                        key={key}
                        className={`cursor-pointer transition-all ${formData.provider_type === key ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
                        onClick={() => setFormData(prev => ({ ...prev, provider_type: key, provider_name: provider.name }))}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <span className="text-2xl">{provider.icon}</span>
                          <span className="font-medium">{provider.name}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      value={formData.provider_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, provider_name: e.target.value }))}
                      placeholder={template.name}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="saml" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Metadata URL (Optional)</Label>
                    <Input
                      value={formData.metadata_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, metadata_url: e.target.value }))}
                      placeholder="https://idp.example.com/metadata.xml"
                    />
                    <p className="text-xs text-muted-foreground">If provided, settings will be auto-configured</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Entity ID / Issuer</Label>
                    <Input
                      value={formData.entity_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, entity_id: e.target.value }))}
                      placeholder={template.entityIdPlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SSO URL</Label>
                    <Input
                      value={formData.sso_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, sso_url: e.target.value }))}
                      placeholder={template.ssoUrlPlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>X.509 Certificate</Label>
                    <Textarea
                      value={formData.certificate}
                      onChange={(e) => setFormData(prev => ({ ...prev, certificate: e.target.value }))}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      className="font-mono text-xs h-32"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="mapping" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Map SAML attributes to user profile fields
                  </p>
                  {Object.entries(formData.attribute_mapping).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-4">
                      <div className="w-32">
                        <Label className="capitalize">{key}</Label>
                      </div>
                      <Input
                        value={value}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          attribute_mapping: { ...prev.attribute_mapping, [key]: e.target.value }
                        }))}
                        placeholder={`SAML attribute for ${key}`}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <Label>Enforce SSO</Label>
                      <p className="text-xs text-muted-foreground">Require SSO for all users</p>
                    </div>
                    <Switch
                      checked={formData.enforce_sso}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enforce_sso: checked }))}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Configuration"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading configurations...</div>
        ) : configs?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No SSO Providers Configured</h3>
              <p className="text-muted-foreground mb-4">
                Set up Single Sign-On to enable secure authentication for your organization
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add SSO Provider
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {configs?.map((config) => {
              const provider = providerTemplates[config.provider_type as keyof typeof providerTemplates];
              return (
                <Card key={config.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{provider?.icon || "⚙️"}</span>
                        <div>
                          <CardTitle className="text-lg">{config.provider_name}</CardTitle>
                          <CardDescription>{provider?.name || config.provider_type}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.is_active ? "default" : "secondary"}>
                          {config.is_active ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                          )}
                        </Badge>
                        {config.enforce_sso && (
                          <Badge variant="outline">Enforced</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Entity ID:</span>
                        <span className="truncate">{config.entity_id || "Not configured"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">SSO URL:</span>
                        <span className="truncate">{config.sso_url || "Not configured"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Certificate:</span>
                        <span>{config.certificate ? "Configured" : "Not configured"}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={(checked) => updateMutation.mutate({ id: config.id, is_active: checked })}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => testConnection(config)}
                        disabled={isTesting === config.id}
                      >
                        {isTesting === config.id ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</>
                        ) : (
                          <><TestTube className="h-4 w-4 mr-2" /> Test Connection</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(config.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                    
                    {/* Test Results Display */}
                    {isTesting === config.id && (
                      <div className="mt-4 pt-4 border-t text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                        <p className="mt-2">Running connection tests...</p>
                      </div>
                    )}
                    
                    {testResults && testSummary && selectedConfig?.id === config.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <Alert variant={testSummary.status === 'pass' ? 'default' : testSummary.status === 'warn' ? 'default' : 'destructive'}>
                          <div className="flex items-center gap-2">
                            {testSummary.status === 'pass' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : testSummary.status === 'warn' ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            <AlertDescription>{testSummary.message}</AlertDescription>
                          </div>
                        </Alert>
                        
                        <div className="space-y-2">
                          {testResults.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded bg-muted/50">
                              <span className="font-medium">{result.check}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{result.message}</span>
                                {result.status === 'pass' ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : result.status === 'warn' ? (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Service Provider Details</CardTitle>
            <CardDescription>Use these values when configuring your Identity Provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ACS URL (Assertion Consumer Service)</Label>
                <Input readOnly value={`${window.location.origin}/auth/saml/callback`} className="font-mono text-sm" />
              </div>
              <div>
                <Label>Entity ID / Audience</Label>
                <Input readOnly value={`${window.location.origin}`} className="font-mono text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Testing Resources</CardTitle>
            <CardDescription>Use these free services to test your SAML configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <a href="https://samltest.id" target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border hover:border-primary transition-colors">
                <h4 className="font-medium">SAMLtest.id</h4>
                <p className="text-sm text-muted-foreground">Free SAML testing service</p>
              </a>
              <a href="https://developer.okta.com/signup/" target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border hover:border-primary transition-colors">
                <h4 className="font-medium">Okta Developer</h4>
                <p className="text-sm text-muted-foreground">Free developer account</p>
              </a>
              <a href="https://auth0.com/signup" target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border hover:border-primary transition-colors">
                <h4 className="font-medium">Auth0</h4>
                <p className="text-sm text-muted-foreground">Free tier available</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
