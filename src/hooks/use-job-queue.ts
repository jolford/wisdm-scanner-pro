// React hooks
import { useState } from 'react';

// Supabase client and toast notifications
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Parameters for creating a job in the queue
 */
interface CreateJobParams {
  jobType: string;            // Type of job (e.g., 'ocr_document', 'export_batch')
  payload: any;               // Job-specific data/parameters
  customerId?: string;        // Optional customer ID for multi-tenant rate limiting
  priority?: 'low' | 'normal' | 'high' | 'urgent';  // Job priority for queue ordering
}

/**
 * useJobQueue Hook
 * Custom hook for creating and managing background jobs in the job queue system
 * 
 * Features:
 * - Creates jobs with priority and customer tracking
 * - Enforces rate limits per customer (if applicable)
 * - Automatically triggers the job processor
 * - Provides job status checking
 * - Real-time job updates via Supabase subscriptions
 * 
 * The job queue allows expensive operations (OCR, exports, etc.) to run
 * asynchronously without blocking the user interface.
 */
export const useJobQueue = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);  // Track job submission state
  const { toast } = useToast();

  /**
   * Create a new job in the queue
   * 
   * Process:
   * 1. Check rate limits (if customer specified)
   * 2. Verify user is authenticated
   * 3. Insert job into database
   * 4. Trigger the job processor edge function
   * 
   * @param params - Job creation parameters
   * @returns Job ID if successful, null if failed
   */
  const createJob = async ({
    jobType,
    payload,
    customerId,
    priority = 'normal',
  }: CreateJobParams): Promise<string | null> => {
    setIsSubmitting(true);
    
    try {
      // Check tenant rate limits if customer is specified
      // This prevents any single customer from overwhelming the system
      if (customerId) {
        const { data: canCreate, error: limitError } = await supabase.rpc(
          'check_tenant_rate_limit',
          { _customer_id: customerId, _job_type: jobType }
        );

        if (limitError) {
          console.error('Rate limit check error:', limitError);
        } else if (!canCreate) {
          // Rate limit exceeded - notify user
          toast({
            title: 'Rate Limit Exceeded',
            description: 'Too many jobs queued. Please wait and try again.',
            variant: 'destructive',
          });
          return null;
        }
      }

      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create jobs',
          variant: 'destructive',
        });
        return null;
      }

      // Insert job into the jobs table
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          job_type: jobType,
          payload,
          customer_id: customerId || null,
          user_id: user.id,
          priority,
          status: 'pending',  // Initial status
        })
        .select('id')
        .single();

      if (error) throw error;

      // Trigger the job processor edge function (fire and forget)
      // The processor will pick up the job and begin processing
      supabase.functions
        .invoke('job-processor')
        .catch(err => console.error('Failed to trigger processor:', err));

      return job.id;

    } catch (error: any) {
      console.error('Error creating job:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to queue job',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Get the current status of a job
   * @param jobId - The ID of the job to check
   * @returns Job status data or null if not found/error
   */
  const getJobStatus = async (jobId: string) => {
    const { data, error } = await supabase
      .from('jobs')
      .select('status, result, error_message, completed_at')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching job status:', error);
      return null;
    }

    return data;
  };

  /**
   * Subscribe to real-time updates for a specific job
   * Useful for tracking job progress and getting notified when it completes
   * 
   * @param jobId - The ID of the job to monitor
   * @param onUpdate - Callback function called when job is updated
   * @returns Cleanup function to unsubscribe
   */
  const subscribeToJob = (jobId: string, onUpdate: (job: any) => void) => {
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',            // Only listen for updates
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,  // Only this specific job
        },
        (payload) => {
          onUpdate(payload.new);      // Call callback with updated job data
        }
      )
      .subscribe();

    // Return cleanup function
    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Return all functions and state for use in components
  return {
    createJob,
    getJobStatus,
    subscribeToJob,
    isSubmitting,
  };
};
