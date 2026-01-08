import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Key, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeErrorMessage, logError } from '@/lib/error-handler';
import axiomiqLogo from '@/assets/axiomiq-logo.png';
import { Badge } from '@/components/ui/badge';

const EditLicense = () => {
  const { id } = useParams();
  const { loading: authLoading } = useRequireAuth(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [totalDocuments, setTotalDocuments] = useState('');
  const [remainingDocuments, setRemainingDocuments] = useState('');
  const [status, setStatus] = useState<'active' | 'suspended' | 'expired' | 'exhausted'>('active');
  const [planType, setPlanType] = useState<'starter' | 'professional' | 'business' | 'enterprise'>('professional');
  const [notes, setNotes] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch license details
  const { data: license, isLoading: licenseLoading } = useQuery({
    queryKey: ['license', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licenses')
        .select(`
          *,
          customers (
            id,
            company_name,
            contact_email
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_email')
        .order('company_name');

      if (error) throw error;
      return data;
    },
  });

  // Populate form when license loads
  useEffect(() => {
    if (license) {
      setCustomerId(license.customer_id);
      setTotalDocuments(license.total_documents.toString());
      setRemainingDocuments(license.remaining_documents.toString());
      setStatus(license.status as 'active' | 'suspended' | 'expired' | 'exhausted');
      setPlanType((license.plan_type as 'starter' | 'professional' | 'business' | 'enterprise') || 'professional');
      setNotes(license.notes || '');
      setEndDate(new Date(license.end_date).toISOString().split('T')[0]);
    }
  }, [license]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a customer',
        variant: 'destructive',
      });
      return;
    }

    const totalDocsNum = parseInt(totalDocuments);
    const remainingDocsNum = parseInt(remainingDocuments);

    if (remainingDocsNum > totalDocsNum) {
      toast({
        title: 'Validation Error',
        description: 'Remaining documents cannot exceed total documents',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          customer_id: customerId,
          total_documents: totalDocsNum,
          remaining_documents: remainingDocsNum,
          status: status,
          plan_type: planType,
          notes: notes.trim() || null,
          end_date: new Date(endDate).toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Invalidate queries to force refresh
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['license', id] });

      toast({
        title: 'License Updated',
        description: 'License has been updated successfully',
      });

      navigate('/admin/licenses');
    } catch (error: any) {
      logError('License update', error);
      toast({
        title: 'Error',
        description: safeErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || licenseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-xl font-semibold mb-2 text-center">License Not Found</h3>
          <Button onClick={() => navigate('/admin/licenses')} className="w-full">
            Back to Licenses
          </Button>
        </Card>
      </div>
    );
  }

  const usagePercent = Math.round((parseInt(remainingDocuments) / parseInt(totalDocuments)) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={axiomiqLogo} alt="AxiomIQ Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-xl font-bold">Edit License</h1>
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
        <div className="grid lg:grid-cols-3 gap-6">
          {/* License Summary Sidebar */}
          <Card className="p-6 lg:col-span-1 h-fit">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  License Summary
                </h3>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">License Key</div>
                <p className="font-mono text-sm font-semibold">{license.license_key}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">License Tier</div>
                <Badge variant="outline" className="capitalize">
                  {license.plan_type || 'professional'}
                </Badge>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Current Status</div>
                <Badge className={
                  license.status === 'active' ? 'bg-green-500' :
                  license.status === 'expired' ? 'bg-gray-500' :
                  license.status === 'exhausted' ? 'bg-orange-500' :
                  'bg-red-500'
                }>
                  {license.status}
                </Badge>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-2">Usage</div>
                <div className="w-full bg-muted rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      usagePercent > 50 ? 'bg-green-500' : 
                      usagePercent > 20 ? 'bg-orange-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-sm font-medium">
                  {parseInt(remainingDocuments).toLocaleString()} / {parseInt(totalDocuments).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{usagePercent}% remaining</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Created</div>
                <p className="text-sm">{new Date(license.created_at).toLocaleDateString()}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Start Date</div>
                <p className="text-sm">{new Date(license.start_date).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          {/* Edit Form */}
          <Card className="p-6 lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">License Details</h2>
                
                <div>
                  <Label htmlFor="customer">Assigned Customer *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.company_name} ({customer.contact_email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reassigning will move this license to a different customer
                  </p>
                </div>

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
                    Pricing tier per price guide
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalDocuments">Total Documents *</Label>
                    <Input
                      id="totalDocuments"
                      type="number"
                      min="1"
                      value={totalDocuments}
                      onChange={(e) => setTotalDocuments(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Annual document capacity
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="remainingDocuments">Remaining Documents *</Label>
                    <Input
                      id="remainingDocuments"
                      type="number"
                      min="0"
                      value={remainingDocuments}
                      onChange={(e) => setRemainingDocuments(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Documents left to process
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as 'active' | 'suspended' | 'expired' | 'exhausted')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="exhausted">Exhausted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this license..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t">
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
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
        </div>
      </main>
    </div>
  );
};

export default EditLicense;
