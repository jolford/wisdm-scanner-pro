import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TenantMetrics {
  customerId: string;
  customerName: string;
  documentsProcessed: number;
  documentsThisMonth: number;
  storageUsedMB: number;
  storageQuotaMB: number;
  apiCallsThisMonth: number;
  apiCallsLimit: number;
  monthlySpendUSD: number;
  budgetLimitUSD: number;
  activeUsers: number;
  lastActivityAt?: Date;
}

interface TenantUsageMeteringProps {
  customerId?: string;
  showAllTenants?: boolean;
  className?: string;
}

export function TenantUsageMetering({
  customerId,
  showAllTenants = false,
  className
}: TenantUsageMeteringProps) {
  const [metrics, setMetrics] = useState<TenantMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(customerId || null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Load tenant usage data
      let query = supabase
        .from('tenant_usage')
        .select(`
          *,
          customers (
            id,
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      if (customerId && !showAllTenants) {
        query = query.eq('customer_id', customerId);
      }

      const { data: usageData } = await query;

      if (!usageData) {
        setMetrics([]);
        return;
      }

      // Aggregate by customer
      const customerMetrics = new Map<string, TenantMetrics>();

      for (const usage of usageData) {
        const customer = usage.customers as any;
        if (!customer) continue;

        const existing = customerMetrics.get(customer.id);
        
        if (!existing) {
          // Calculate storage from documents_processed estimate (1MB per doc avg)
          const estimatedStorageMB = (usage.documents_processed || 0) * 1;
          // Estimate API calls from processing count
          const estimatedApiCalls = (usage.documents_processed || 0) * 3;
          
          customerMetrics.set(customer.id, {
            customerId: customer.id,
            customerName: customer.company_name,
            documentsProcessed: usage.documents_processed || 0,
            documentsThisMonth: usage.documents_processed || 0,
            storageUsedMB: estimatedStorageMB,
            storageQuotaMB: 5000,
            apiCallsThisMonth: estimatedApiCalls,
            apiCallsLimit: 10000,
            monthlySpendUSD: usage.ai_cost_usd || 0,
            budgetLimitUSD: usage.budget_limit_usd || 1000,
            activeUsers: 1,
            lastActivityAt: usage.updated_at ? new Date(usage.updated_at) : undefined
          });
        }
      }

      setMetrics(Array.from(customerMetrics.values()));
    } catch (error) {
      console.error('Failed to load tenant metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId, showAllTenants]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 75) return 'text-amber-500';
    return 'text-green-500';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentMetrics = selectedTenant
    ? metrics.find(m => m.customerId === selectedTenant)
    : metrics[0];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage & Metering
          </CardTitle>
          {showAllTenants && metrics.length > 1 && (
            <Badge variant="outline">{metrics.length} tenants</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAllTenants && metrics.length > 1 && (
          <>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {metrics.map((tenant) => {
                  const budgetUsage = getUsagePercentage(
                    tenant.monthlySpendUSD,
                    tenant.budgetLimitUSD
                  );

                  return (
                    <Button
                      key={tenant.customerId}
                      variant={selectedTenant === tenant.customerId ? "secondary" : "ghost"}
                      className="w-full justify-between h-auto py-2"
                      onClick={() => setSelectedTenant(tenant.customerId)}
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm">{tenant.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(tenant.documentsThisMonth)} docs this month
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className={cn("text-sm font-medium", getUsageColor(budgetUsage))}>
                          {formatCurrency(tenant.monthlySpendUSD)}
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
            <Separator />
          </>
        )}

        {currentMetrics && (
          <div className="space-y-4">
            {/* Budget Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Monthly Spend</span>
                </div>
                <span className={cn(
                  "font-medium",
                  getUsageColor(getUsagePercentage(
                    currentMetrics.monthlySpendUSD,
                    currentMetrics.budgetLimitUSD
                  ))
                )}>
                  {formatCurrency(currentMetrics.monthlySpendUSD)} / {formatCurrency(currentMetrics.budgetLimitUSD)}
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  currentMetrics.monthlySpendUSD,
                  currentMetrics.budgetLimitUSD
                )}
                className="h-2"
              />
            </div>

            {/* API Calls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>API Calls</span>
                </div>
                <span className={cn(
                  "font-medium",
                  getUsageColor(getUsagePercentage(
                    currentMetrics.apiCallsThisMonth,
                    currentMetrics.apiCallsLimit
                  ))
                )}>
                  {formatNumber(currentMetrics.apiCallsThisMonth)} / {formatNumber(currentMetrics.apiCallsLimit)}
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  currentMetrics.apiCallsThisMonth,
                  currentMetrics.apiCallsLimit
                )}
                className="h-2"
              />
            </div>

            {/* Storage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Storage</span>
                </div>
                <span className={cn(
                  "font-medium",
                  getUsageColor(getUsagePercentage(
                    currentMetrics.storageUsedMB,
                    currentMetrics.storageQuotaMB
                  ))
                )}>
                  {currentMetrics.storageUsedMB.toFixed(0)} MB / {currentMetrics.storageQuotaMB.toFixed(0)} MB
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  currentMetrics.storageUsedMB,
                  currentMetrics.storageQuotaMB
                )}
                className="h-2"
              />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatNumber(currentMetrics.documentsThisMonth)}
                </div>
                <div className="text-xs text-muted-foreground">Documents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {currentMetrics.activeUsers}
                </div>
                <div className="text-xs text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {currentMetrics.documentsThisMonth > 0
                    ? `$${(currentMetrics.monthlySpendUSD / currentMetrics.documentsThisMonth).toFixed(2)}`
                    : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Per Doc</div>
              </div>
            </div>

            {/* Warning if approaching limit */}
            {getUsagePercentage(currentMetrics.monthlySpendUSD, currentMetrics.budgetLimitUSD) >= 80 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Approaching budget limit. Consider upgrading your plan.</span>
              </div>
            )}
          </div>
        )}

        {!currentMetrics && (
          <div className="text-center py-8 text-muted-foreground">
            No usage data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
