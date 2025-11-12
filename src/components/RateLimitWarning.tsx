import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantLimits {
  max_concurrent_jobs: number;
  max_jobs_per_minute: number;
  max_jobs_per_hour: number;
}

interface UsageStats {
  current_jobs: number;
  jobs_last_minute: number;
  jobs_last_hour: number;
}

export function RateLimitWarning({ customerId }: { customerId?: string }) {
  const [limits, setLimits] = useState<TenantLimits | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!customerId) return;

    const checkLimits = async () => {
      try {
        // Fetch tenant limits
        const { data: limitsData, error: limitsError } = await supabase
          .from('tenant_limits')
          .select('max_concurrent_jobs, max_jobs_per_minute, max_jobs_per_hour')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (limitsError) {
          console.error('Error fetching tenant limits:', limitsError);
          return;
        }

        if (!limitsData) {
          // No limits configured - user has unlimited access
          return;
        }

        setLimits(limitsData);

        // Fetch current usage
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Current concurrent jobs
        const { count: currentJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .in('status', ['pending', 'processing']);

        // Jobs in last minute
        const { count: jobsLastMinute } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .gte('created_at', oneMinuteAgo.toISOString());

        // Jobs in last hour
        const { count: jobsLastHour } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .gte('created_at', oneHourAgo.toISOString());

        const usageStats = {
          current_jobs: currentJobs || 0,
          jobs_last_minute: jobsLastMinute || 0,
          jobs_last_hour: jobsLastHour || 0,
        };

        setUsage(usageStats);

        // Calculate usage percentages
        const concurrentPct = (usageStats.current_jobs / limitsData.max_concurrent_jobs) * 100;
        const minutePct = (usageStats.jobs_last_minute / limitsData.max_jobs_per_minute) * 100;
        const hourPct = (usageStats.jobs_last_hour / limitsData.max_jobs_per_hour) * 100;

        // Show warning if approaching limits (80% threshold)
        const approachingLimit = concurrentPct >= 80 || minutePct >= 80 || hourPct >= 80;
        setShowWarning(approachingLimit);

        // Show critical toast if exceeding limits
        if (concurrentPct >= 100 || minutePct >= 100 || hourPct >= 100) {
          toast({
            variant: "destructive",
            title: "Rate Limit Reached",
            description: "You've reached your job processing rate limit. New jobs may be delayed or rejected.",
          });
        }
      } catch (error) {
        console.error('Error checking rate limits:', error);
      }
    };

    // Check immediately
    checkLimits();

    // Check every 30 seconds
    const interval = setInterval(checkLimits, 30000);

    return () => clearInterval(interval);
  }, [customerId, toast]);

  if (!limits || !usage || !showWarning) {
    return null;
  }

  const concurrentPct = (usage.current_jobs / limits.max_concurrent_jobs) * 100;
  const minutePct = (usage.jobs_last_minute / limits.max_jobs_per_minute) * 100;
  const hourPct = (usage.jobs_last_hour / limits.max_jobs_per_hour) * 100;

  const atLimit = concurrentPct >= 100 || minutePct >= 100 || hourPct >= 100;
  const warnings = [];

  if (concurrentPct >= 80) {
    warnings.push(`${usage.current_jobs}/${limits.max_concurrent_jobs} concurrent jobs`);
  }
  if (minutePct >= 80) {
    warnings.push(`${usage.jobs_last_minute}/${limits.max_jobs_per_minute} jobs/minute`);
  }
  if (hourPct >= 80) {
    warnings.push(`${usage.jobs_last_hour}/${limits.max_jobs_per_hour} jobs/hour`);
  }

  return (
    <Alert variant={atLimit ? "destructive" : "default"} className="mb-4">
      {atLimit ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Info className="h-4 w-4" />
      )}
      <AlertTitle>
        {atLimit ? "Rate Limit Reached" : "Approaching Rate Limit"}
      </AlertTitle>
      <AlertDescription>
        {warnings.join(", ")}. 
        {atLimit 
          ? " New jobs may be delayed or rejected until current jobs complete."
          : " Consider spacing out job submissions to avoid rate limiting."}
      </AlertDescription>
    </Alert>
  );
}
