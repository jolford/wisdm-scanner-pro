// React hooks for state management and side effects
import { useEffect, useState } from 'react';

// Backend integration for database access
import { supabase } from '@/integrations/supabase/client';

// UI components from shadcn/ui
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

// Icon imports for visual indicators
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Props for the CostTracker component
 * @property customerId - The ID of the customer whose costs to track
 */
interface CostTrackerProps {
  customerId: string;
}

/**
 * Usage data structure representing monthly cost/usage for a customer
 * Tracks documents processed, AI costs, storage costs, and budget limits
 */
interface Usage {
  id: string;
  customer_id: string;
  period_start: string;           // Start of billing period
  period_end: string;             // End of billing period
  documents_processed: number;    // Count of successfully processed documents
  documents_failed: number;       // Count of failed document processing attempts
  ai_cost_usd: number;           // Cost of AI processing (OCR, extraction)
  storage_cost_usd: number;      // Cost of file storage
  total_cost_usd: number;        // Total cost for the period
  budget_limit_usd: number | null; // Optional budget cap for alerts
}

/**
 * Cost alert structure for budget warnings and overages
 * Alerts are triggered when spending exceeds thresholds
 */
interface CostAlert {
  id: string;
  alert_type: string;             // Type: 'budget_warning' or 'budget_exceeded'
  severity: string;               // Severity: 'warning' or 'critical'
  message: string;                // User-friendly alert message
  current_spend_usd: number;      // Current spending amount
  budget_limit_usd: number;       // Budget limit that was exceeded
  usage_percentage: number;       // Percentage of budget used
  acknowledged: boolean;          // Whether user has acknowledged alert
  created_at: string;            // When alert was created
}

/**
 * CostTracker Component
 * Displays real-time cost tracking, usage statistics, and budget alerts for a customer
 * Features:
 * - Monthly cost breakdown (AI processing, storage)
 * - Document processing statistics
 * - Budget usage tracking with visual progress bar
 * - Active cost alerts with acknowledgment capability
 * - Real-time updates via Supabase subscriptions
 * - Monthly cost projections based on current usage
 */
export const CostTracker = ({ customerId }: CostTrackerProps) => {
  // State management
  const [usage, setUsage] = useState<Usage | null>(null);        // Current month's usage data
  const [alerts, setAlerts] = useState<CostAlert[]>([]);         // Active unacknowledged alerts
  const [loading, setLoading] = useState(true);                  // Loading state

  // Initialize component: load data and set up real-time subscriptions
  useEffect(() => {
    // Load initial data
    loadUsageData();
    loadAlerts();

    // Subscribe to real-time updates from Supabase
    // This ensures the UI updates immediately when costs change or alerts are created
    const channel = supabase
      .channel('cost-updates')
      // Listen for any changes to tenant_usage table for this customer
      .on(
        'postgres_changes',
        {
          event: '*',                    // All events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'tenant_usage',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          loadUsageData();  // Reload usage when it changes
        }
      )
      // Listen for new cost alerts for this customer
      .on(
        'postgres_changes',
        {
          event: 'INSERT',              // Only new alerts
          schema: 'public',
          table: 'cost_alerts',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          loadAlerts();     // Reload alerts when new ones are created
        }
      )
      .subscribe();

    // Cleanup: unsubscribe from real-time updates when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  /**
   * Load usage data for the current billing period (month)
   * Fetches cost and document processing statistics from the database
   */
  const loadUsageData = async () => {
    // Calculate the start of the current month (billing period)
    const periodStart = new Date();
    periodStart.setDate(1);           // First day of month
    periodStart.setHours(0, 0, 0, 0); // Midnight

    // Query for this month's usage data
    const { data, error } = await supabase
      .from('tenant_usage')
      .select('*')
      .eq('customer_id', customerId)
      .gte('period_start', periodStart.toISOString().split('T')[0])
      .single();  // Expect exactly one record per customer per period

    // PGRST116 = "no rows returned" - this is OK if it's a new month
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading usage:', error);
    }

    setUsage(data);
    setLoading(false);
  };

  /**
   * Load active (unacknowledged) cost alerts for this customer
   * Only shows alerts that haven't been acknowledged yet
   */
  const loadAlerts = async () => {
    const { data, error } = await supabase
      .from('cost_alerts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('acknowledged', false)          // Only unacknowledged alerts
      .order('created_at', { ascending: false });  // Newest first

    if (error) {
      console.error('Error loading alerts:', error);
      return;
    }

    setAlerts(data || []);
  };

  /**
   * Mark an alert as acknowledged by the current user
   * Updates the database and refreshes the alerts list
   * @param alertId - The ID of the alert to acknowledge
   */
  const acknowledgeAlert = async (alertId: string) => {
    // Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update alert in database
    const { error } = await supabase
      .from('cost_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      })
      .eq('id', alertId);

    if (error) {
      console.error('Error acknowledging alert:', error);
      return;
    }

    // Refresh alerts list to remove the acknowledged one
    loadAlerts();
  };

  // Loading state: show skeleton placeholder while data loads
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-8 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  // No data state: show message if no usage data exists
  if (!usage) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">No usage data available</p>
      </Card>
    );
  }

  // Calculate budget usage percentage (capped at 100%)
  const budgetUsagePercent = usage.budget_limit_usd
    ? Math.min((usage.total_cost_usd / usage.budget_limit_usd) * 100, 100)
    : 0;

  // Calculate average cost per document for cost efficiency metrics
  const avgCostPerDoc = usage.documents_processed > 0
    ? usage.ai_cost_usd / usage.documents_processed
    : 0;

  return (
    <div className="space-y-4">
      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.severity === 'critical' ? 'destructive' : 'default'}
              className="border-l-4"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{alert.alert_type === 'budget_warning' ? 'Budget Warning' : 'Budget Exceeded'}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  Acknowledge
                </Button>
              </AlertTitle>
              <AlertDescription>
                {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Cost Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Monthly Cost Tracking</h3>
          <Badge variant="outline" className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {new Date(usage.period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">
              ${usage.total_cost_usd.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">Total Spend</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">
              {usage.documents_processed}
            </div>
            <div className="text-sm text-muted-foreground">Documents</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500">
              ${avgCostPerDoc.toFixed(4)}
            </div>
            <div className="text-sm text-muted-foreground">Avg/Doc</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {usage.documents_failed}
            </div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>

        {usage.budget_limit_usd && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Budget Usage
              </span>
              <span className="font-medium">
                ${usage.total_cost_usd.toFixed(2)} / ${usage.budget_limit_usd.toFixed(2)}
              </span>
            </div>
            <Progress 
              value={budgetUsagePercent} 
              className="h-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{budgetUsagePercent.toFixed(1)}% used</span>
              <span>${(usage.budget_limit_usd - usage.total_cost_usd).toFixed(2)} remaining</span>
            </div>
          </div>
        )}

        {!usage.budget_limit_usd && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              No budget limit set - unlimited spending enabled
            </span>
          </div>
        )}
      </Card>

      {/* Cost Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <div className="font-medium">AI Processing (OCR)</div>
              <div className="text-sm text-muted-foreground">
                Lovable AI - Gemini 2.5 Flash
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-500">
                ${usage.ai_cost_usd.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">
                {usage.documents_processed} docs
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <div className="font-medium">Storage</div>
              <div className="text-sm text-muted-foreground">
                Lovable Cloud Storage
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-blue-500">
                ${usage.storage_cost_usd.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">
                Included in plan
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Projections */}
      {usage.documents_processed > 0 && usage.budget_limit_usd && (
        <Card className="p-6 bg-muted/30">
          <h3 className="text-lg font-semibold mb-4">Monthly Projection</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Current daily rate:</span>
              <span className="font-medium">
                ${((usage.total_cost_usd / new Date().getDate()) * 30).toFixed(2)}/month
              </span>
            </div>
            <div className="flex justify-between">
              <span>Projected month-end:</span>
              <span className="font-medium">
                ${(usage.total_cost_usd / new Date().getDate() * 30).toFixed(2)}
              </span>
            </div>
            {(usage.total_cost_usd / new Date().getDate() * 30) > usage.budget_limit_usd && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  At current rate, you'll exceed budget by $
                  {((usage.total_cost_usd / new Date().getDate() * 30) - usage.budget_limit_usd).toFixed(2)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
