/**
 * AI Cost Tracking Admin Page
 * 
 * Monitors and manages AI processing costs across all tenants/customers in the system.
 * Provides budget oversight, usage tracking, and alerting for cost management.
 * 
 * Features:
 * - Real-time cost tracking per customer/tenant
 * - Budget limit configuration and monitoring
 * - Automated budget alert system (warnings at 80%, critical at 100%)
 * - Document processing statistics (successful vs failed)
 * - Average cost per document calculations
 * - Period-based reporting (current month, last month, all time)
 * - Active budget alerts dashboard
 * - Visual progress indicators for budget usage
 * 
 * Data Sources:
 * - tenant_usage: Monthly usage and cost data per customer
 * - cost_alerts: Budget warning and exceeded notifications
 * - customers: Customer organization information
 * 
 * Budget Alert Thresholds:
 * - Warning: 80% of budget (orange badge)
 * - Exceeded: 100%+ of budget (destructive badge)
 * - Healthy: < 80% of budget (default badge)
 * 
 * @requires useRequireAuth - Admin-only access
 * @requires AdminLayout - Consistent admin page structure
 */

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TenantUsage {
  id: string;
  customer_id: string;
  period_start: string;
  period_end: string;
  documents_processed: number;
  documents_failed: number;
  ai_cost_usd: number;
  total_cost_usd: number;
  budget_limit_usd: number | null;
  budget_alert_threshold: number;
}

interface CustomerData {
  id: string;
  company_name: string;
}

interface CostAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  customer: {
    company_name: string;
  };
}

const CostTracking = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [tenantUsage, setTenantUsage] = useState<TenantUsage[]>([]);
  const [costAlerts, setCostAlerts] = useState<CostAlert[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'last' | 'all'>('current');
  const [totalStats, setTotalStats] = useState({
    totalSpend: 0,
    totalDocuments: 0,
    avgCostPerDoc: 0,
    activeAlerts: 0,
  });

  useEffect(() => {
    if (!loading && isAdmin) {
      loadData();
    }
  }, [loading, isAdmin, selectedPeriod]);

  const loadData = async () => {
    try {
      // Load customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name');
      
      setCustomers(customersData || []);

      // Load tenant usage based on selected period
      let usageQuery = supabase
        .from('tenant_usage')
        .select('*')
        .order('total_cost_usd', { ascending: false });

      if (selectedPeriod === 'current') {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        usageQuery = usageQuery.gte('period_start', currentMonth.toISOString().split('T')[0]);
      } else if (selectedPeriod === 'last') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setDate(1);
        const lastMonthEnd = new Date(lastMonth);
        lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
        lastMonthEnd.setDate(0);
        usageQuery = usageQuery
          .gte('period_start', lastMonth.toISOString().split('T')[0])
          .lte('period_end', lastMonthEnd.toISOString().split('T')[0]);
      }

      const { data: usageData } = await usageQuery;
      setTenantUsage(usageData || []);

      // Load cost alerts (unacknowledged only)
      const { data: alertsData } = await supabase
        .from('cost_alerts')
        .select(`
          *,
          customer:customers(company_name)
        `)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(10);

      setCostAlerts((alertsData as any) || []);

      // Calculate totals
      const totalSpend = (usageData || []).reduce((sum, u) => sum + Number(u.total_cost_usd || 0), 0);
      const totalDocs = (usageData || []).reduce((sum, u) => sum + (u.documents_processed || 0), 0);
      
      setTotalStats({
        totalSpend,
        totalDocuments: totalDocs,
        avgCostPerDoc: totalDocs > 0 ? totalSpend / totalDocs : 0,
        activeAlerts: alertsData?.length || 0,
      });
    } catch (error) {
      console.error('Error loading cost tracking data:', error);
    }
  };

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.company_name || 'Unknown';
  };

  const getBudgetPercentage = (usage: TenantUsage) => {
    if (!usage.budget_limit_usd || usage.budget_limit_usd === 0) return 0;
    return (Number(usage.total_cost_usd) / Number(usage.budget_limit_usd)) * 100;
  };

  const getBudgetStatus = (percentage: number) => {
    if (percentage >= 100) return { color: 'destructive', label: 'Exceeded' };
    if (percentage >= 80) return { color: 'orange', label: 'Warning' };
    return { color: 'default', label: 'Healthy' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout title="AI Cost Tracking" description="Monitor AI usage, costs, and budget alerts">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex justify-end">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">${totalStats.totalSpend.toFixed(2)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documents Processed</p>
                <p className="text-2xl font-bold">{totalStats.totalDocuments.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Cost/Document</p>
                <p className="text-2xl font-bold">${totalStats.avgCostPerDoc.toFixed(4)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{totalStats.activeAlerts}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Active Alerts */}
        {costAlerts.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Active Budget Alerts</h3>
            <div className="space-y-3">
              {costAlerts.map((alert) => (
                <Alert
                  key={alert.id}
                  className={
                    alert.severity === 'critical'
                      ? 'border-destructive'
                      : alert.severity === 'warning'
                      ? 'border-orange-500'
                      : ''
                  }
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{alert.customer?.company_name}</p>
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                        {alert.alert_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </Card>
        )}

        {/* Customer Usage Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Usage & Budgets</h3>
          <div className="space-y-4">
            {tenantUsage.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No usage data for selected period</p>
            ) : (
              tenantUsage.map((usage) => {
                const budgetPct = getBudgetPercentage(usage);
                const status = getBudgetStatus(budgetPct);
                
                return (
                  <div key={usage.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{getCustomerName(usage.customer_id)}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={status.color as any}>{status.label}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">AI Cost</p>
                        <p className="text-lg font-bold">${Number(usage.ai_cost_usd).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Documents</p>
                        <p className="text-lg font-bold">{usage.documents_processed.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Failed</p>
                        <p className="text-lg font-bold text-destructive">{usage.documents_failed}</p>
                      </div>
                    </div>

                    {usage.budget_limit_usd && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Budget: ${Number(usage.total_cost_usd).toFixed(2)} / ${Number(usage.budget_limit_usd).toFixed(2)}</span>
                          <span className="font-medium">{budgetPct.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(budgetPct, 100)} className="h-2" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default CostTracking;
