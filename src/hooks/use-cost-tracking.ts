import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TenantUsage {
  id: string;
  customer_id: string;
  total_cost_usd: number;
  documents_processed: number;
  budget_limit_usd: number | null;
}

interface CostAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
}

export const useCostTracking = (customerId?: string) => {
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return;
    }

    loadData();

    const channel = supabase
      .channel('cost-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_usage',
          filter: `customer_id=eq.${customerId}`,
        },
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cost_alerts',
          filter: `customer_id=eq.${customerId}`,
        },
        () => loadAlerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  const loadData = async () => {
    if (!customerId) return;

    const periodStart = new Date();
    periodStart.setDate(1);

    const { data, error } = await supabase
      .from('tenant_usage')
      .select('*')
      .eq('customer_id', customerId)
      .gte('period_start', periodStart.toISOString().split('T')[0])
      .maybeSingle();

    if (error) {
      console.error('Error loading usage:', error);
    }

    setUsage(data);
    loadAlerts();
    setLoading(false);
  };

  const loadAlerts = async () => {
    if (!customerId) return;

    const { data, error } = await supabase
      .from('cost_alerts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error loading alerts:', error);
      return;
    }

    setAlerts(data || []);
  };

  const isApproachingBudget = () => {
    if (!usage?.budget_limit_usd) return false;
    const percentage = (usage.total_cost_usd / usage.budget_limit_usd) * 100;
    return percentage >= 80;
  };

  const isBudgetExceeded = () => {
    if (!usage?.budget_limit_usd) return false;
    return usage.total_cost_usd >= usage.budget_limit_usd;
  };

  return {
    usage,
    alerts,
    loading,
    isApproachingBudget: isApproachingBudget(),
    isBudgetExceeded: isBudgetExceeded(),
    refresh: loadData,
  };
};
