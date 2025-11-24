import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { 
  Store, 
  Search, 
  Star, 
  Download, 
  CheckCircle2, 
  Package,
  Webhook,
  Mail,
  FileText,
  Database,
  Cloud,
  MessageSquare,
  Calendar,
  DollarSign,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: 'export' | 'communication' | 'storage' | 'analytics';
  rating: number;
  installs: number;
  installed: boolean;
  featured: boolean;
}

const integrations: Integration[] = [
  {
    id: 'sharepoint',
    name: 'Microsoft SharePoint',
    description: 'Export documents directly to SharePoint document libraries',
    icon: Cloud,
    category: 'export',
    rating: 4.8,
    installs: 1250,
    installed: true,
    featured: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Send real-time notifications to Teams channels',
    icon: MessageSquare,
    category: 'communication',
    rating: 4.9,
    installs: 2100,
    installed: true,
    featured: true,
  },
  {
    id: 'documentum',
    name: 'OpenText Documentum',
    description: 'Export to Documentum content management system',
    icon: Database,
    category: 'export',
    rating: 4.6,
    installs: 890,
    installed: false,
    featured: false,
  },
  {
    id: 'filebound',
    name: 'FileBound',
    description: 'Direct integration with FileBound document management',
    icon: FileText,
    category: 'export',
    rating: 4.7,
    installs: 650,
    installed: false,
    featured: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post validation alerts to Slack channels',
    icon: MessageSquare,
    category: 'communication',
    rating: 4.8,
    installs: 1800,
    installed: false,
    featured: true,
  },
  {
    id: 'gmail',
    name: 'Gmail / Google Workspace',
    description: 'Import documents from Gmail attachments',
    icon: Mail,
    category: 'communication',
    rating: 4.7,
    installs: 1450,
    installed: false,
    featured: false,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Export invoice data directly to QuickBooks',
    icon: DollarSign,
    category: 'analytics',
    rating: 4.9,
    installs: 980,
    installed: false,
    featured: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sync documents and data with Salesforce records',
    icon: Cloud,
    category: 'analytics',
    rating: 4.8,
    installs: 1120,
    installed: false,
    featured: false,
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Create calendar events from document dates',
    icon: Calendar,
    category: 'analytics',
    rating: 4.5,
    installs: 420,
    installed: false,
    featured: false,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Store and retrieve documents from Dropbox',
    icon: Cloud,
    category: 'storage',
    rating: 4.6,
    installs: 890,
    installed: false,
    featured: false,
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Enterprise content management with Box',
    icon: Package,
    category: 'storage',
    rating: 4.7,
    installs: 760,
    installed: false,
    featured: false,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect to 3000+ apps through Zapier automation',
    icon: Webhook,
    category: 'communication',
    rating: 4.9,
    installs: 2500,
    installed: false,
    featured: true,
  },
];

export default function IntegrationMarketplace() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [installedIntegrations, setInstalledIntegrations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [configureIntegration, setConfigureIntegration] = useState<string | null>(null);
  const [configData, setConfigData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchCustomerAndInstalledIntegrations();
  }, [user]);

  const fetchCustomerAndInstalledIntegrations = async () => {
    if (!user) return;
    
    try {
      // Get customer_id from user_customers table
      const { data: userCustomer, error: customerError } = await supabase
        .from('user_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        throw customerError;
      }

      if (userCustomer?.customer_id) {
        setCustomerId(userCustomer.customer_id);

        // Fetch installed integrations for this customer
        const { data: installed, error: installedError } = await supabase
          .from('installed_integrations')
          .select('integration_id')
          .eq('customer_id', userCustomer.customer_id)
          .eq('is_active', true);

        if (installedError) {
          console.error('Error fetching installed integrations:', installedError);
          throw installedError;
        }

        if (installed) {
          setInstalledIntegrations(new Set(installed.map(i => i.integration_id)));
        }
      }
    } catch (error) {
      console.error('Error fetching installed integrations:', error);
      toast.error('Failed to load integration data');
    } finally {
      setLoading(false);
    }
  };

  const filteredIntegrations = integrations.map(integration => ({
    ...integration,
    installed: installedIntegrations.has(integration.id)
  })).filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const installIntegration = async (id: string) => {
    if (!user || !customerId) {
      toast.error('Unable to install integration. Please try again.');
      return;
    }

    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    try {
      const { error } = await supabase
        .from('installed_integrations')
        .insert({
          customer_id: customerId,
          integration_id: id,
          integration_name: integration.name,
          installed_by: user.id
        });

      if (error) throw error;

      setInstalledIntegrations(prev => new Set(prev).add(id));
      toast.success(`${integration.name} installed successfully!`);
    } catch (error) {
      console.error('Error installing integration:', error);
      toast.error('Failed to install integration');
    }
  };

  const uninstallIntegration = async (id: string) => {
    if (!customerId) return;

    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    try {
      const { error } = await supabase
        .from('installed_integrations')
        .delete()
        .eq('customer_id', customerId)
        .eq('integration_id', id);

      if (error) throw error;

      setInstalledIntegrations(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast.success(`${integration.name} uninstalled successfully`);
    } catch (error) {
      console.error('Error uninstalling integration:', error);
      toast.error('Failed to uninstall integration');
    }
  };

  const openConfiguration = async (id: string) => {
    if (!customerId) return;
    
    try {
      const { data, error } = await supabase
        .from('installed_integrations')
        .select('configuration')
        .eq('customer_id', customerId)
        .eq('integration_id', id)
        .maybeSingle();
      
      if (error) throw error;
      
      setConfigData((data?.configuration as Record<string, any>) || {});
      setConfigureIntegration(id);
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast.error('Failed to load configuration');
    }
  };

  const saveConfiguration = async () => {
    if (!customerId || !configureIntegration) return;
    
    try {
      const { error } = await supabase
        .from('installed_integrations')
        .update({ configuration: configData })
        .eq('customer_id', customerId)
        .eq('integration_id', configureIntegration);
      
      if (error) throw error;
      
      toast.success('Configuration saved successfully');
      setConfigureIntegration(null);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  const getConfigFields = (integrationId: string) => {
    switch (integrationId) {
      case 'quickbooks':
        return [
          { key: 'company_id', label: 'Company ID', type: 'text', placeholder: 'Enter your QuickBooks Company ID' },
          { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'OAuth Client ID' },
          { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'OAuth Client Secret' },
          { key: 'redirect_uri', label: 'Redirect URI', type: 'text', placeholder: 'OAuth Redirect URI' },
          { key: 'sandbox', label: 'Use Sandbox', type: 'checkbox' }
        ];
      case 'salesforce':
        return [
          { key: 'instance_url', label: 'Instance URL', type: 'text', placeholder: 'https://yourinstance.salesforce.com' },
          { key: 'client_id', label: 'Consumer Key', type: 'text' },
          { key: 'client_secret', label: 'Consumer Secret', type: 'password' },
          { key: 'username', label: 'Username', type: 'text' },
          { key: 'security_token', label: 'Security Token', type: 'password' }
        ];
      case 'sharepoint':
        return [
          { key: 'site_url', label: 'SharePoint Site URL', type: 'text', placeholder: 'https://yourorg.sharepoint.com/sites/yoursite' },
          { key: 'client_id', label: 'Client ID', type: 'text' },
          { key: 'client_secret', label: 'Client Secret', type: 'password' },
          { key: 'library_name', label: 'Document Library', type: 'text', placeholder: 'Documents' }
        ];
      case 'teams':
        return [
          { key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://outlook.office.com/webhook/...' }
        ];
      case 'slack':
        return [
          { key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/...' }
        ];
      default:
        return [
          { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Enter API key' },
          { key: 'endpoint', label: 'Endpoint URL', type: 'text', placeholder: 'https://api.example.com' }
        ];
    }
  };

  return (
    <AdminLayout title="Integration Marketplace">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <CardTitle>Integration Marketplace</CardTitle>
            </div>
            <CardDescription>
              Connect WISDM to your favorite tools and services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Categories */}
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="export">Export</TabsTrigger>
                  <TabsTrigger value="communication">Communication</TabsTrigger>
                  <TabsTrigger value="storage">Storage</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Featured Integrations */}
              {selectedCategory === 'all' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Featured Integrations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {integrations.filter(i => i.featured).map((integration) => {
                      const Icon = integration.icon;
                      return (
                        <Card key={integration.id} className="border-primary/20">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="font-semibold">{integration.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {integration.description}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-primary text-primary" />
                                    {integration.rating}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Download className="h-4 w-4" />
                                    {integration.installs.toLocaleString()}
                                  </div>
                                </div>
                                 {integration.installed ? (
                                  <div className="flex gap-2 w-full">
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="flex-1"
                                      onClick={() => openConfiguration(integration.id)}
                                    >
                                      <Settings className="h-4 w-4 mr-2" />
                                      Configure
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => uninstallIntegration(integration.id)}
                                    >
                                      Uninstall
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() => installIntegration(integration.id)}
                                    disabled={loading}
                                  >
                                    Install
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Integrations */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  {selectedCategory === 'all' ? 'All Integrations' : `${selectedCategory} Integrations`}
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {filteredIntegrations.map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <Card key={integration.id} className="hover:bg-accent transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-muted rounded-lg">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{integration.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {integration.description}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Star className="h-4 w-4 fill-primary text-primary" />
                                {integration.rating}
                              </div>
                              {integration.installed ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openConfiguration(integration.id)}
                                  >
                                    <Settings className="h-3 w-3 mr-1" />
                                    Configure
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => uninstallIntegration(integration.id)}
                                  >
                                    Uninstall
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => installIntegration(integration.id)}
                                  disabled={loading}
                                >
                                  Install
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{integrations.length}</div>
              <div className="text-sm text-muted-foreground">Available Integrations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {installedIntegrations.size}
              </div>
              <div className="text-sm text-muted-foreground">Installed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">4.7</div>
              <div className="text-sm text-muted-foreground">Average Rating</div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Sheet */}
        <Sheet open={!!configureIntegration} onOpenChange={() => setConfigureIntegration(null)}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                Configure {integrations.find(i => i.id === configureIntegration)?.name}
              </SheetTitle>
              <SheetDescription>
                Enter your integration credentials and settings
              </SheetDescription>
            </SheetHeader>

            {/* Setup Instructions */}
            {configureIntegration && (
              <Card className="mt-4 bg-muted">
                <CardContent className="p-4 text-sm space-y-2">
                  <div className="font-semibold">Setup Instructions:</div>
                  {configureIntegration === 'quickbooks' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Log into QuickBooks Developer Portal</li>
                      <li>Create a new app or select existing app</li>
                      <li>Copy the Client ID and Client Secret from Keys & OAuth</li>
                      <li>Find your Company ID in QuickBooks settings</li>
                      <li>Set redirect URI to your application URL</li>
                      <li>Enable sandbox mode for testing (optional)</li>
                    </ol>
                  )}
                  {configureIntegration === 'salesforce' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Log into Salesforce Setup</li>
                      <li>Navigate to Apps → App Manager → New Connected App</li>
                      <li>Enable OAuth Settings and select scopes</li>
                      <li>Copy Consumer Key (Client ID) and Consumer Secret</li>
                      <li>Get Security Token from Settings → Reset Security Token</li>
                      <li>Your Instance URL is typically https://[domain].salesforce.com</li>
                    </ol>
                  )}
                  {configureIntegration === 'sharepoint' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Go to Azure Portal → App Registrations</li>
                      <li>Create new registration or use existing</li>
                      <li>Copy Application (client) ID</li>
                      <li>Create client secret under Certificates & Secrets</li>
                      <li>Grant SharePoint API permissions (Sites.ReadWrite.All)</li>
                      <li>Enter your SharePoint site URL and library name</li>
                    </ol>
                  )}
                  {configureIntegration === 'teams' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open Microsoft Teams and go to your channel</li>
                      <li>Click ⋯ (More options) → Connectors</li>
                      <li>Search for "Incoming Webhook" and click Configure</li>
                      <li>Give it a name (e.g., "WISDM Notifications")</li>
                      <li>Copy the webhook URL provided</li>
                      <li>Paste the URL in the Endpoint field below</li>
                    </ol>
                  )}
                  {configureIntegration === 'slack' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Go to api.slack.com → Your Apps → Create New App</li>
                      <li>Choose "From scratch" and select your workspace</li>
                      <li>Navigate to Incoming Webhooks and activate</li>
                      <li>Click "Add New Webhook to Workspace"</li>
                      <li>Select the channel for notifications</li>
                      <li>Copy the webhook URL and paste below</li>
                    </ol>
                  )}
                  {!['quickbooks', 'salesforce', 'sharepoint', 'teams', 'slack'].includes(configureIntegration) && (
                    <p className="text-muted-foreground">
                      Please refer to the integration's documentation for setup instructions.
                      Enter your API credentials below to connect.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4 mt-4">
              {configureIntegration && getConfigFields(configureIntegration).map(field => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.type === 'checkbox' ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={field.key}
                        checked={configData[field.key] || false}
                        onChange={(e) => setConfigData(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={field.key} className="font-normal">{field.label}</Label>
                    </div>
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={configData[field.key] || ''}
                      onChange={(e) => setConfigData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <Button onClick={saveConfiguration} className="flex-1">
                  Save Configuration
                </Button>
                <Button variant="outline" onClick={() => setConfigureIntegration(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
