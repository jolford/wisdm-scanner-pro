import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Upload, Save, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface WhiteLabelConfig {
  companyName: string;
  companyLogo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  favicon: string;
  supportEmail: string;
  supportPhone: string;
  customDomain: string;
  hideWisdmBranding: boolean;
  customFooterText: string;
}

export default function WhiteLabel() {
  const { toast } = useToast();
  const [config, setConfig] = useState<WhiteLabelConfig>({
    companyName: 'WISDM Scanner Pro',
    companyLogo: '/wisdm-logo.png',
    primaryColor: '#1a56db',
    secondaryColor: '#7c3aed',
    accentColor: '#f59e0b',
    favicon: '/favicon.png',
    supportEmail: 'support@wisdm.com',
    supportPhone: '+1-800-WISDM',
    customDomain: '',
    hideWisdmBranding: false,
    customFooterText: '',
  });
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Temporarily disabled until types are regenerated
      // Will load from system_settings once types are available
      console.log('White-label config will load once database types are updated');
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Temporarily disabled until types are regenerated
      toast({
        title: 'Coming Soon',
        description: 'White-label configuration will be available once database types are updated.',
      });
      
      /* Will be enabled once types are available
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'white_label_config',
          value: config,
        });

      if (error) throw error;

      toast({
        title: 'Settings Saved',
        description: 'White-label configuration has been updated successfully.',
      });
      */
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save white-label settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `white-label/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setConfig(prev => ({
        ...prev,
        [type === 'logo' ? 'companyLogo' : 'favicon']: publicUrl,
      }));

      toast({
        title: 'Upload Successful',
        description: `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload file.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AdminLayout 
      title="White-Label Configuration" 
      description="Customize branding for resale or multi-tenant deployment"
    >
      <div className="space-y-6">
        {/* Preview Toggle */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  White-Label Preview
                </CardTitle>
                <CardDescription>
                  Customize branding to match your company identity or reseller requirements
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="preview-mode">Preview Mode</Label>
                <Switch
                  id="preview-mode"
                  checked={previewMode}
                  onCheckedChange={setPreviewMode}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Company Branding */}
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>Customize company identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  placeholder="Your Company Name"
                />
              </div>

              <div>
                <Label htmlFor="companyLogo">Company Logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  {config.companyLogo && (
                    <img src={config.companyLogo} alt="Logo" className="h-12 w-auto" />
                  )}
                  <Input
                    id="companyLogo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, 'logo')}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="favicon">Favicon</Label>
                <div className="flex items-center gap-4 mt-2">
                  {config.favicon && (
                    <img src={config.favicon} alt="Favicon" className="h-8 w-8" />
                  )}
                  <Input
                    id="favicon"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, 'favicon')}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="hideBranding">Hide WISDM Branding</Label>
                <Switch
                  id="hideBranding"
                  checked={config.hideWisdmBranding}
                  onCheckedChange={(checked) => setConfig({ ...config, hideWisdmBranding: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Color Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Theme
              </CardTitle>
              <CardDescription>Customize application colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    placeholder="#1a56db"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={config.secondaryColor}
                    onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                    placeholder="#7c3aed"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="accentColor"
                    type="color"
                    value={config.accentColor}
                    onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={config.accentColor}
                    onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                    placeholder="#f59e0b"
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Support Contact</CardTitle>
              <CardDescription>Customer support information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={config.supportEmail}
                  onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                  placeholder="support@yourcompany.com"
                />
              </div>

              <div>
                <Label htmlFor="supportPhone">Support Phone</Label>
                <Input
                  id="supportPhone"
                  type="tel"
                  value={config.supportPhone}
                  onChange={(e) => setConfig({ ...config, supportPhone: e.target.value })}
                  placeholder="+1-800-XXX-XXXX"
                />
              </div>

              <div>
                <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                <Input
                  id="customDomain"
                  type="text"
                  value={config.customDomain}
                  onChange={(e) => setConfig({ ...config, customDomain: e.target.value })}
                  placeholder="scanner.yourcompany.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Custom Footer */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Footer Text</CardTitle>
              <CardDescription>Add custom copyright or legal text</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={config.customFooterText}
                onChange={(e) => setConfig({ ...config, customFooterText: e.target.value })}
                placeholder="© 2024 Your Company. All rights reserved."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={loadConfig}>
            Reset Changes
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>

        {/* Value Proposition */}
        <Card className="border-green-500/20 bg-green-50 dark:bg-green-950/10">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">
              Resale Value Enhancement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-green-700 dark:text-green-400">
            <p>✓ Enable multi-tenant deployment with custom branding per customer</p>
            <p>✓ Allow resellers to white-label the platform under their own brand</p>
            <p>✓ Increase product value by offering customization flexibility</p>
            <p>✓ Support enterprise customers requiring branded solutions</p>
            <p>✓ Reduce buyer integration costs with ready-made white-label features</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
