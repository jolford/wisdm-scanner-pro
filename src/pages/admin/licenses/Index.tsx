import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Key, AlertCircle, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MaintenanceInvoiceGenerator } from '@/components/admin/MaintenanceInvoiceGenerator';
import wisdmLogo from '@/assets/wisdm-logo.png';

const LicensesIndex = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: licenses, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      console.log('Fetching licenses...');
      const { data, error } = await supabase
        .from('licenses')
        .select(`
          *,
          customers (
            company_name,
            contact_email,
            contact_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('License query error:', error);
        throw error;
      }
      console.log('Licenses fetched:', data);
      return data;
    },
  });

  // Show error if query fails
  if (queryError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-xl font-semibold mb-2 text-center">Error Loading Licenses</h3>
          <p className="text-muted-foreground text-center mb-4">
            {queryError instanceof Error ? queryError.message : 'Failed to load licenses'}
          </p>
          <Button onClick={() => refetch()} className="w-full">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'expired':
        return <Clock className="h-4 w-4" />;
      case 'exhausted':
        return <AlertCircle className="h-4 w-4" />;
      case 'suspended':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Key className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500',
      expired: 'bg-gray-500',
      exhausted: 'bg-orange-500',
      suspended: 'bg-red-500',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getUsagePercentage = (remaining: number, total: number) => {
    return Math.round((remaining / total) * 100);
  };

  if (isLoading) {
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
                <h1 className="text-xl font-bold">License Management</h1>
                <p className="text-xs text-muted-foreground">Manage customer licenses and volume tracking</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <Button onClick={() => navigate('/admin/licenses/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New License
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {licenses && licenses.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {licenses.map((license) => {
              const usagePercent = getUsagePercentage(license.remaining_documents, license.total_documents);
              const isExpiringSoon = new Date(license.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              const isLowVolume = usagePercent < 20;
              
              return (
                <Card
                  key={license.id}
                  className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)] hover:shadow-lg transition-shadow"
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/licenses/${license.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">
                          {license.customers?.company_name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {license.customers?.contact_email}
                        </p>
                        <Badge className={getStatusColor(license.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(license.status)}
                            {license.status}
                          </span>
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">License Key</span>
                          <Key className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="font-mono text-sm font-semibold">{license.license_key}</p>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex justify-between items-baseline mb-2">
                          <span className="text-xs text-muted-foreground">Documents Remaining</span>
                          <span className={`text-lg font-bold ${usagePercent < 20 ? 'text-destructive' : ''}`}>
                            {license.remaining_documents.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              usagePercent > 50 ? 'bg-green-500' : 
                              usagePercent > 20 ? 'bg-orange-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {usagePercent}% of {license.total_documents.toLocaleString()} total
                        </p>
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>
                          Expires: {new Date(license.end_date).toLocaleDateString()}
                        </span>
                        {isExpiringSoon && (
                          <Badge variant="outline" className="text-orange-600">
                            Expiring Soon
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Generate Invoice Button - Only show for low volume licenses */}
                  {isLowVolume && (
                    <div className="mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full"
                            size="sm"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Maintenance Invoice
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Generate Maintenance Invoice</DialogTitle>
                          </DialogHeader>
                          <MaintenanceInvoiceGenerator license={license} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80">
            <Key className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Licenses Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first license to start tracking document volume
            </p>
            <Button onClick={() => navigate('/admin/licenses/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create License
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LicensesIndex;