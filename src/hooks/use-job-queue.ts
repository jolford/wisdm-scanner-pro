import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateJobParams {
  jobType: string;
  payload: any;
  customerId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export const useJobQueue = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const createJob = async ({
    jobType,
    payload,
    customerId,
    priority = 'normal',
  }: CreateJobParams): Promise<string | null> => {
    setIsSubmitting(true);
    
    try {
      // Check rate limits if customer specified
      if (customerId) {
        const { data: canCreate, error: limitError } = await supabase.rpc(
          'check_tenant_rate_limit',
          { _customer_id: customerId, _job_type: jobType }
        );

        if (limitError) {
          console.error('Rate limit check error:', limitError);
        } else if (!canCreate) {
          toast({
            title: 'Rate Limit Exceeded',
            description: 'Too many jobs queued. Please wait and try again.',
            variant: 'destructive',
          });
          return null;
        }
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create jobs',
          variant: 'destructive',
        });
        return null;
      }

      // Create job
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          job_type: jobType,
          payload,
          customer_id: customerId || null,
          user_id: user.id,
          priority,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Trigger job processor (fire and forget)
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

  const subscribeToJob = (jobId: string, onUpdate: (job: any) => void) => {
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          onUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    createJob,
    getJobStatus,
    subscribeToJob,
    isSubmitting,
  };
};
