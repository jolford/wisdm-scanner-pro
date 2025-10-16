import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface JobStatusMonitorProps {
  customerId?: string;
  showMetrics?: boolean;
}

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export const JobStatusMonitor = ({ customerId, showMetrics = true }: JobStatusMonitorProps) => {
  const [stats, setStats] = useState<JobStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadRecentJobs();

    // Subscribe to job updates
    const channel = supabase
      .channel('job-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: customerId ? `customer_id=eq.${customerId}` : undefined,
        },
        () => {
          loadStats();
          loadRecentJobs();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadStats();
      loadRecentJobs();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [customerId]);

  const loadStats = async () => {
    let query = supabase
      .from('jobs')
      .select('status');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading job stats:', error);
      return;
    }

    const newStats = data.reduce((acc, job) => {
      acc[job.status as keyof JobStats]++;
      return acc;
    }, { pending: 0, processing: 0, completed: 0, failed: 0 });

    setStats(newStats);
    setLoading(false);
  };

  const loadRecentJobs = async () => {
    let query = supabase
      .from('jobs')
      .select('id, job_type, status, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading recent jobs:', error);
      return;
    }

    setRecentJobs(data || []);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const totalJobs = stats.pending + stats.processing + stats.completed + stats.failed;
  const activeJobs = stats.pending + stats.processing;
  const completionRate = totalJobs > 0 
    ? Math.round((stats.completed / totalJobs) * 100) 
    : 0;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showMetrics && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Job Queue Status</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.processing}</div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Completion Rate</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          {activeJobs > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {activeJobs} job{activeJobs !== 1 ? 's' : ''} currently active
              </div>
            </div>
          )}
        </Card>
      )}

      {recentJobs.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Jobs</h3>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <div className="font-medium text-sm">{job.job_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Badge variant={getStatusVariant(job.status)}>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
