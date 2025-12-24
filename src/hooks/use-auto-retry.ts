import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FailedJob {
  id: string;
  jobType: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  lastAttempt: string;
  nextRetry: string | null;
}

interface UseAutoRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  enabled?: boolean;
}

/**
 * Auto-retry hook for failed jobs with exponential backoff
 */
export function useAutoRetry({
  maxRetries = 3,
  baseDelay = 5000,
  maxDelay = 60000,
  enabled = true,
}: UseAutoRetryOptions = {}) {
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { toast } = useToast();

  // Calculate exponential backoff delay
  const getRetryDelay = useCallback((retryCount: number) => {
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }, [baseDelay, maxDelay]);

  // Load failed jobs and subscribe to changes
  useEffect(() => {
    if (!enabled) return;

    const loadFailedJobs = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_type, error_message, attempts, created_at, updated_at')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load failed jobs:', error);
        return;
      }

      const jobs: FailedJob[] = (data || [])
        .filter((job) => (job.attempts || 0) < maxRetries)
        .map((job) => ({
          id: job.id,
          jobType: job.job_type,
          errorMessage: job.error_message || 'Unknown error',
          retryCount: job.attempts || 0,
          maxRetries,
          lastAttempt: job.updated_at,
          nextRetry: null,
        }));

      setFailedJobs(jobs);

      // Schedule retries for each job
      jobs.forEach(scheduleRetry);
    };

    loadFailedJobs();

    // Subscribe to job failures
    const channel = supabase
      .channel('failed-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: 'status=eq.failed',
        },
        (payload) => {
          const job = payload.new as any;
          if ((job.attempts || 0) < maxRetries) {
            const failedJob: FailedJob = {
              id: job.id,
              jobType: job.job_type,
              errorMessage: job.error_message || 'Unknown error',
              retryCount: job.attempts || 0,
              maxRetries,
              lastAttempt: job.updated_at,
              nextRetry: null,
            };
            
            setFailedJobs((prev) => {
              const exists = prev.find((j) => j.id === job.id);
              if (exists) {
                return prev.map((j) => j.id === job.id ? failedJob : j);
              }
              return [...prev, failedJob];
            });

            scheduleRetry(failedJob);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clear all retry timeouts
      retryTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      retryTimeouts.current.clear();
    };
  }, [enabled, maxRetries]);

  const scheduleRetry = useCallback((job: FailedJob) => {
    // Clear existing timeout if any
    const existingTimeout = retryTimeouts.current.get(job.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const delay = getRetryDelay(job.retryCount);
    const nextRetry = new Date(Date.now() + delay).toISOString();

    setFailedJobs((prev) =>
      prev.map((j) => j.id === job.id ? { ...j, nextRetry } : j)
    );

    const timeout = setTimeout(() => {
      retryJob(job.id);
    }, delay);

    retryTimeouts.current.set(job.id, timeout);
  }, [getRetryDelay]);

  const retryJob = useCallback(async (jobId: string) => {
    setIsRetrying(true);

    try {
      // Get current attempts count
      const { data: jobData } = await supabase
        .from('jobs')
        .select('attempts')
        .eq('id', jobId)
        .single();

      // Reset job status to pending for reprocessing
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'pending',
          error_message: null,
          attempts: (jobData?.attempts || 0) + 1,
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Trigger job processor
      await supabase.functions.invoke('job-processor');

      // Remove from failed jobs list
      setFailedJobs((prev) => prev.filter((j) => j.id !== jobId));
      retryTimeouts.current.delete(jobId);

      toast({
        title: 'Job Retried',
        description: 'The failed job has been queued for retry.',
      });
    } catch (error) {
      console.error('Failed to retry job:', error);
      toast({
        title: 'Retry Failed',
        description: 'Could not retry the job. Will try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsRetrying(false);
    }
  }, [toast]);

  const cancelRetry = useCallback((jobId: string) => {
    const timeout = retryTimeouts.current.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeouts.current.delete(jobId);
    }
    setFailedJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, []);

  const retryAll = useCallback(async () => {
    const jobIds = failedJobs.map((j) => j.id);
    for (const id of jobIds) {
      await retryJob(id);
    }
  }, [failedJobs, retryJob]);

  return {
    failedJobs,
    isRetrying,
    retryJob,
    cancelRetry,
    retryAll,
    failedCount: failedJobs.length,
  };
}
