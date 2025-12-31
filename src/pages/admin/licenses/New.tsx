import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeErrorMessage, logError } from '@/lib/error-handler';
import { licenseSchema } from '@/lib/validation-schemas';
import wisdmLogo from '@/assets/wisdm-logo.png';

const NewLicense = () => {
  const { loading } = useRequireAuth(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [totalDocuments, setTotalDocuments] = useState('10000');
  const [durationMonths, setDurationMonths] = useState('12');
  const [planType, setPlanType] = useState<'starter' | 'professional' | 'business' | 'enterprise'>('professional');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data with zod
    try {
      licenseSchema.parse({
        companyName,
        contactName,
        contactEmail,
        phone,
        totalDocuments: parseInt(totalDocuments),
        durationMonths: parseInt(durationMonths),
        notes,
      });
    } catch (error: any) {
      const firstError = error.errors?.[0];
      toast({
        title: 'Validation Error',
        description: firstError?.message || 'Please check your input',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Create or get customer
      let customerId: string;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('contact_email', contactEmail.trim())
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        // Update customer info
        await supabase
          .from('customers')
          .update({
            company_name: companyName.trim(),
            contact_name: contactName.trim() || null,
            phone: phone.trim() || null,
          })
          .eq('id', customerId);
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{
            company_name: companyName.trim(),
            contact_email: contactEmail.trim(),
            contact_name: contactName.trim() || null,
            phone: phone.trim() || null,
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Generate license key
      const { data: keyData, error: keyError } = await supabase
        .rpc('generate_license_key');

      if (keyError) throw keyError;

      // Calculate end date
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + parseInt(durationMonths));

      // Create license
      const { error: licenseError } = await supabase
        .from('licenses')
        .insert([{
          customer_id: customerId,
          license_key: keyData,
          total_documents: parseInt(totalDocuments),
          remaining_documents: parseInt(totalDocuments),
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          plan_type: planType,
          notes: notes.trim() || null,
        }]);

      if (licenseError) throw licenseError;

      // Invalidate licenses query to force refresh
      queryClient.invalidateQueries({ queryKey: ['licenses'] });

      toast({
        title: 'License Created',
        description: 'New license has been created successfully',
      });

      navigate('/admin/licenses');
    } catch (error: any) {
      logError('License creation', error);
      toast({
        title: 'Error',
        description: safeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-xl font-bold">Create New License</h1>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/admin/licenses')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Customer Information</h2>
              
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </div>

              <div>
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@acme.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t">
              <h2 className="text-xl font-semibold">License Details</h2>
              
              <div>
                <Label htmlFor="planType">License Tier *</Label>
                <Select value={planType} onValueChange={(value) => setPlanType(value as 'starter' | 'professional' | 'business' | 'enterprise')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the pricing tier per your price guide
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalDocuments">Annual Document Volume *</Label>
                  <Input
                    id="totalDocuments"
                    type="number"
                    min="1"
                    value={totalDocuments}
                    onChange={(e) => setTotalDocuments(e.target.value)}
                    placeholder="10000"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total documents allowed per year
                  </p>
                </div>

                <div>
                  <Label htmlFor="durationMonths">Duration (Months) *</Label>
                  <Input
                    id="durationMonths"
                    type="number"
                    min="1"
                    max="36"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    placeholder="12"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    License validity period
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this license..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <Button type="submit" disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Creating...' : 'Create License'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/licenses')}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default NewLicense;