import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Key, AlertCircle, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MaintenanceInvoiceGenerator } from '@/components/admin/MaintenanceInvoiceGenerator';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
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

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: 'success' as const, icon: <CheckCircle2 className="h-3 w-3" /> },
      expired: { variant: 'secondary' as const, icon: <Clock className="h-3 w-3" /> },
      exhausted: { variant: 'warning' as const, icon: <AlertCircle className="h-3 w-3" /> },
      suspended: { variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" /> },
    };
    const config = variants[status as keyof typeof variants] || variants.active;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getProgressVariant = (percent: number): "default" | "success" | "warning" | "info" => {
    if (percent > 50) return 'success';
    if (percent > 20) return 'warning';
    return 'default';
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
                <h1>License Management</h1>
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
                  className="card-elevated-hover overflow-hidden"
                  onClick={() => navigate(`/admin/licenses/${license.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="mb-1">
                          {license.customers?.company_name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {license.customers?.contact_email}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {getStatusBadge(license.status)}
                          <Badge variant="info-soft" className="capitalize">
                            {license.plan_type || 'professional'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">License Key</span>
                          <Key className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="font-mono text-xs font-semibold tracking-wider">{license.license_key}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-medium text-muted-foreground">Document Usage</span>
                          <span className="text-2xl font-bold">
                            {license.remaining_documents.toLocaleString()}
                          </span>
                        </div>
                        <Progress 
                          value={usagePercent} 
                          className={`h-2 ${
                            usagePercent > 50 ? '[&>div]:bg-success' : 
                            usagePercent > 20 ? '[&>div]:bg-warning' : 
                            '[&>div]:bg-destructive'
                          }`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{usagePercent}% remaining</span>
                          <span>{license.total_documents.toLocaleString()} total</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-xs text-muted-foreground">
                          Expires {new Date(license.end_date).toLocaleDateString()}
                        </span>
                        {isExpiringSoon && (
                          <Badge variant="warning-soft" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Expiring Soon
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>

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
          <EmptyState
            icon={Key}
            title="No Licenses Yet"
            description="Create your first license to start tracking document volume and managing customer access."
            action={{
              label: "Create License",
              onClick: () => navigate('/admin/licenses/new')
            }}
          />
        )}
      </main>
    </div>
  );
};

export default LicensesIndex;