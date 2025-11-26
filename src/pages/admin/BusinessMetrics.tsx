import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { TrendingUp, DollarSign, Users, FileText, Target, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BusinessMetrics {
  mrr: number;
  arr: number;
  totalCustomers: number;
  activeCustomers: number;
  totalLicenses: number;
  activeLicenses: number;
  totalDocuments: number;
  documentsThisMonth: number;
  averageRevenuePerCustomer: number;
  churnRate: number;
  growthRate: number;
}

export default function BusinessMetrics() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [user, period]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - parseInt(period));

      // Get customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, created_at');

      // Get licenses
      const { data: licenses } = await supabase
        .from('licenses')
        .select('id, status, total_documents');

      // Get documents
      const { data: allDocs } = await supabase
        .from('documents')
        .select('id, created_at');

      const { data: recentDocs } = await supabase
        .from('documents')
        .select('id')
        .gte('created_at', periodStart.toISOString());

      const totalCustomers = customers?.length || 0;
      const activeLicenses = licenses?.filter(l => l.status === 'active') || [];
      const totalLicenses = licenses?.length || 0;
      
      // Calculate MRR from active licenses (using avg per document * total documents)
      const avgRevenuePerDoc = 0.50; // Estimated $0.50 per document
      const mrr = activeLicenses.reduce((sum, l) => sum + ((l.total_documents || 0) * avgRevenuePerDoc), 0) / 12;
      const arr = mrr * 12;

      // Calculate growth
      const oldCustomers = customers?.filter(c => 
        new Date(c.created_at) < periodStart
      ).length || 0;
      const growthRate = oldCustomers > 0 
        ? ((totalCustomers - oldCustomers) / oldCustomers) * 100 
        : 0;

      setMetrics({
        mrr,
        arr,
        totalCustomers,
        activeCustomers: activeLicenses.length,
        totalLicenses,
        activeLicenses: activeLicenses.length,
        totalDocuments: allDocs?.length || 0,
        documentsThisMonth: recentDocs?.length || 0,
        averageRevenuePerCustomer: totalCustomers > 0 ? mrr / totalCustomers : 0,
        churnRate: 0, // Calculate based on canceled licenses
        growthRate,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatNumber = (value: number) => 
    new Intl.NumberFormat('en-US').format(Math.round(value));

  if (loading) {
    return (
      <AdminLayout title="Business Metrics" description="Key business performance indicators">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Business Metrics" description="Key performance indicators and revenue analytics">
      <div className="space-y-6">
        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              How Business Metrics Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This dashboard tracks key performance indicators (KPIs) calculated from your actual system data:
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <strong className="text-foreground">MRR (Monthly Recurring Revenue):</strong>
                <p className="text-muted-foreground">Estimated revenue per month based on active licenses × avg document processing cost</p>
              </div>
              <div>
                <strong className="text-foreground">ARR (Annual Recurring Revenue):</strong>
                <p className="text-muted-foreground">MRR × 12 - projects your yearly revenue</p>
              </div>
              <div>
                <strong className="text-foreground">Active Customers:</strong>
                <p className="text-muted-foreground">Customers with at least one active license</p>
              </div>
              <div>
                <strong className="text-foreground">Growth Rate:</strong>
                <p className="text-muted-foreground">Customer growth % over the selected time period</p>
              </div>
              <div>
                <strong className="text-foreground">ARPC (Avg Revenue Per Customer):</strong>
                <p className="text-muted-foreground">MRR divided by total customers</p>
              </div>
              <div>
                <strong className="text-foreground">Documents Processed:</strong>
                <p className="text-muted-foreground">Total documents processed in the selected period</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              💡 <strong>Note:</strong> Revenue calculations use estimated document processing costs. Update the avgRevenuePerDoc constant in the code to match your actual pricing.
            </p>
          </CardContent>
        </Card>
        
        {/* Period Selector */}
        <div className="flex justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Revenue Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics?.mrr || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {metrics?.activeLicenses || 0} active licenses
              </p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Recurring Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics?.arr || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Projected annual revenue
              </p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Revenue Per Customer</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(metrics?.averageRevenuePerCustomer || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per customer monthly
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Customer Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalCustomers || 0}</div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={(metrics?.activeCustomers || 0) / (metrics?.totalCustomers || 1) * 100} className="h-2" />
                <span className="text-xs text-muted-foreground">
                  {metrics?.activeCustomers || 0} active
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.growthRate.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Customer growth over period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents Processed</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metrics?.totalDocuments || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(metrics?.documentsThisMonth || 0)} this period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* License Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>License Distribution</CardTitle>
            <CardDescription>Active vs total licenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Active Licenses</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics?.activeLicenses || 0} / {metrics?.totalLicenses || 0}
                  </span>
                </div>
                <Progress 
                  value={(metrics?.activeLicenses || 0) / (metrics?.totalLicenses || 1) * 100} 
                  className="h-3"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {metrics?.activeLicenses || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {(metrics?.totalLicenses || 0) - (metrics?.activeLicenses || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {((metrics?.activeLicenses || 0) / (metrics?.totalLicenses || 1) * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Utilization</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Valuation */}
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <TrendingUp className="h-5 w-5" />
              Estimated Business Valuation
            </CardTitle>
            <CardDescription>Based on ARR and growth rate using standard SaaS multiples</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const arr = metrics?.arr || 0;
                const growthRate = metrics?.growthRate || 0;
                
                // Determine valuation multiple based on growth rate
                let lowMultiple = 1;
                let highMultiple = 3;
                let category = "Low Growth";
                
                if (growthRate >= 100) {
                  lowMultiple = 10;
                  highMultiple = 20;
                  category = "Very High Growth";
                } else if (growthRate >= 50) {
                  lowMultiple = 6;
                  highMultiple = 10;
                  category = "High Growth";
                } else if (growthRate >= 20) {
                  lowMultiple = 3;
                  highMultiple = 6;
                  category = "Medium Growth";
                }
                
                const lowValuation = arr * lowMultiple;
                const highValuation = arr * highMultiple;
                const midValuation = (lowValuation + highValuation) / 2;
                
                return (
                  <>
                    <div className="text-center space-y-2">
                      <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(midValuation)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estimated Value (Midpoint)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Range: {formatCurrency(lowValuation)} - {formatCurrency(highValuation)}
                      </p>
                    </div>
                    
                    <div className="border-t pt-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ARR:</span>
                        <span className="font-medium">{formatCurrency(arr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Growth Category:</span>
                        <span className="font-medium">{category} ({growthRate.toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valuation Multiple:</span>
                        <span className="font-medium">{lowMultiple}x - {highMultiple}x ARR</span>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4 text-xs text-muted-foreground space-y-2">
                      <p><strong>How this works:</strong> SaaS companies are typically valued at multiples of Annual Recurring Revenue (ARR).</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Low growth (0-20%): 1-3x ARR</li>
                        <li>Medium growth (20-50%): 3-6x ARR</li>
                        <li>High growth (50-100%): 6-10x ARR</li>
                        <li>Very high growth (100%+): 10-20x ARR</li>
                      </ul>
                      <p className="pt-2"><strong>Note:</strong> Actual valuation depends on many factors including profitability, market conditions, competitive position, and customer retention. This is an estimate only.</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Key Takeaways */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Business Health Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>✓ <strong>{formatCurrency(metrics?.arr || 0)}</strong> projected annual recurring revenue</p>
              <p>✓ <strong>{metrics?.totalCustomers || 0}</strong> total customers with <strong>{metrics?.growthRate.toFixed(1)}%</strong> growth</p>
              <p>✓ <strong>{formatNumber(metrics?.totalDocuments || 0)}</strong> documents processed lifetime</p>
              <p>✓ <strong>{formatCurrency(metrics?.averageRevenuePerCustomer || 0)}</strong> average revenue per customer</p>
              <p>✓ <strong>{((metrics?.activeLicenses || 0) / (metrics?.totalLicenses || 1) * 100).toFixed(0)}%</strong> license utilization rate</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
