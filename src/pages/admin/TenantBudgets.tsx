import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Users } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Customer {
  id: string;
  company_name: string;
}

interface TenantUsage {
  id: string;
  customer_id: string;
  budget_limit_usd: number | null;
  budget_alert_threshold: number;
  total_cost_usd: number;
  documents_processed: number;
}

export default function TenantBudgets() {
  const { loading: authLoading } = useRequireAuth(true);
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usage, setUsage] = useState<Record<string, TenantUsage>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load customers
    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('id, company_name')
      .order('company_name');

    if (customersError) {
      console.error('Error loading customers:', customersError);
      toast({
        title: 'Error',
        description: 'Failed to load customers',
        variant: 'destructive',
      });
      return;
    }

    setCustomers(customersData || []);

    // Load current month usage for all customers
    const periodStart = new Date();
    periodStart.setDate(1);

    const { data: usageData, error: usageError } = await supabase
      .from('tenant_usage')
      .select('*')
      .gte('period_start', periodStart.toISOString().split('T')[0]);

    if (usageError) {
      console.error('Error loading usage:', usageError);
    }

    const usageMap: Record<string, TenantUsage> = {};
    (usageData || []).forEach((u) => {
      usageMap[u.customer_id] = u;
    });

    setUsage(usageMap);
    setLoading(false);
  };

  const updateBudget = async (customerId: string, budgetLimit: number | null, alertThreshold: number) => {
    setSaving(customerId);

    const periodStart = new Date();
    periodStart.setDate(1);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(0);

    // Upsert tenant_usage with new budget
    const { error } = await supabase
      .from('tenant_usage')
      .upsert({
        customer_id: customerId,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        budget_limit_usd: budgetLimit,
        budget_alert_threshold: alertThreshold,
      }, {
        onConflict: 'customer_id,period_start,period_end'
      });

    if (error) {
      console.error('Error updating budget:', error);
      toast({
        title: 'Error',
        description: 'Failed to update budget',
        variant: 'destructive',
      });
      setSaving(null);
      return;
    }

    toast({
      title: 'Success',
      description: 'Budget updated successfully',
    });

    setSaving(null);
    loadData();
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="Tenant Budgets">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Tenant Budgets">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Tenant Budget Management</h1>
            <p className="text-muted-foreground">Set monthly spending limits and alert thresholds</p>
          </div>
        </div>

        <div className="grid gap-4">
          {customers.map((customer) => {
            const customerUsage = usage[customer.id];
            const currentBudget = customerUsage?.budget_limit_usd || null;
            const currentThreshold = customerUsage?.budget_alert_threshold || 0.80;
            const currentSpend = customerUsage?.total_cost_usd || 0;
            const docsProcessed = customerUsage?.documents_processed || 0;

            return (
              <Card key={customer.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {customer.company_name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Current month: ${currentSpend.toFixed(2)} spent • {docsProcessed} documents
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`budget-${customer.id}`}>
                      Monthly Budget Limit (USD)
                    </Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id={`budget-${customer.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Unlimited"
                        defaultValue={currentBudget || ''}
                        className="pl-10"
                        onBlur={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : null;
                          if (value !== currentBudget) {
                            updateBudget(customer.id, value, currentThreshold);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for unlimited
                    </p>
                  </div>

                  <div>
                    <Label htmlFor={`threshold-${customer.id}`}>
                      Alert Threshold (%)
                    </Label>
                    <Input
                      id={`threshold-${customer.id}`}
                      type="number"
                      step="5"
                      min="50"
                      max="100"
                      defaultValue={(currentThreshold * 100).toFixed(0)}
                      className="mt-1"
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) / 100;
                        if (value !== currentThreshold) {
                          updateBudget(customer.id, currentBudget, value);
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Warn when budget reaches this %
                    </p>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={() => updateBudget(customer.id, currentBudget, currentThreshold)}
                      disabled={saving === customer.id}
                      className="w-full"
                    >
                      {saving === customer.id ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>

                {currentBudget && currentSpend > 0 && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Budget usage:</span>
                      <span className={`font-medium ${
                        (currentSpend / currentBudget) >= 1 
                          ? 'text-red-500' 
                          : (currentSpend / currentBudget) >= currentThreshold 
                          ? 'text-yellow-500' 
                          : 'text-green-500'
                      }`}>
                        {((currentSpend / currentBudget) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
