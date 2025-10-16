-- Create job status enum
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying');

-- Create job priority enum
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Create jobs table for async processing
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'ocr_document', 'export_batch', etc.
  status job_status NOT NULL DEFAULT 'pending',
  priority job_priority NOT NULL DEFAULT 'normal',
  
  -- Tenant info
  customer_id UUID REFERENCES public.customers(id),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Job data
  payload JSONB NOT NULL, -- job-specific data
  result JSONB, -- job result when completed
  error_message TEXT,
  
  -- Processing tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient job processing
CREATE INDEX idx_jobs_status_priority ON public.jobs(status, priority DESC, scheduled_for);
CREATE INDEX idx_jobs_customer ON public.jobs(customer_id, status);
CREATE INDEX idx_jobs_user ON public.jobs(user_id);
CREATE INDEX idx_jobs_created ON public.jobs(created_at);

-- Create tenant resource limits table
CREATE TABLE public.tenant_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) UNIQUE NOT NULL,
  
  -- Rate limits
  max_concurrent_jobs INTEGER DEFAULT 5,
  max_jobs_per_minute INTEGER DEFAULT 20,
  max_jobs_per_hour INTEGER DEFAULT 500,
  
  -- Priority settings
  default_priority job_priority DEFAULT 'normal',
  allow_high_priority BOOLEAN DEFAULT false,
  
  -- Resource quotas
  max_daily_documents INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job metrics table for monitoring
CREATE TABLE public.job_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id),
  job_type TEXT NOT NULL,
  
  -- Metrics
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  
  -- Time window
  metric_date DATE NOT NULL,
  metric_hour INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(customer_id, job_type, metric_date, metric_hour)
);

-- Enable RLS on new tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs
CREATE POLICY "Users can view their own jobs"
  ON public.jobs FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create jobs in their customer"
  ON public.jobs FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND 
    (customer_id IS NULL OR has_customer(auth.uid(), customer_id))
  );

CREATE POLICY "System can update jobs"
  ON public.jobs FOR UPDATE
  USING (true); -- Edge function will handle with service role

CREATE POLICY "Admins can manage all jobs"
  ON public.jobs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for tenant_limits
CREATE POLICY "Users can view their customer limits"
  ON public.tenant_limits FOR SELECT
  USING (has_customer(auth.uid(), customer_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage limits"
  ON public.tenant_limits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for job_metrics
CREATE POLICY "Users can view their customer metrics"
  ON public.job_metrics FOR SELECT
  USING (has_customer(auth.uid(), customer_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert metrics"
  ON public.job_metrics FOR INSERT
  WITH CHECK (true);

-- Function to check tenant rate limits
CREATE OR REPLACE FUNCTION check_tenant_rate_limit(
  _customer_id UUID,
  _job_type TEXT DEFAULT 'ocr_document'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limits RECORD;
  _current_jobs INTEGER;
  _jobs_last_minute INTEGER;
  _jobs_last_hour INTEGER;
BEGIN
  -- Get tenant limits
  SELECT * INTO _limits
  FROM tenant_limits
  WHERE customer_id = _customer_id;
  
  -- If no limits configured, allow (for testing)
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  -- Check concurrent jobs
  SELECT COUNT(*) INTO _current_jobs
  FROM jobs
  WHERE customer_id = _customer_id
    AND status IN ('pending', 'processing');
  
  IF _current_jobs >= _limits.max_concurrent_jobs THEN
    RETURN FALSE;
  END IF;
  
  -- Check jobs per minute
  SELECT COUNT(*) INTO _jobs_last_minute
  FROM jobs
  WHERE customer_id = _customer_id
    AND created_at > NOW() - INTERVAL '1 minute';
  
  IF _jobs_last_minute >= _limits.max_jobs_per_minute THEN
    RETURN FALSE;
  END IF;
  
  -- Check jobs per hour
  SELECT COUNT(*) INTO _jobs_last_hour
  FROM jobs
  WHERE customer_id = _customer_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF _jobs_last_hour >= _limits.max_jobs_per_hour THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to get next job for processing (fair-share scheduling)
CREATE OR REPLACE FUNCTION get_next_job()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job_id UUID;
  _customer_with_least_active UUID;
BEGIN
  -- Find customer with least active jobs (fair-share)
  SELECT customer_id INTO _customer_with_least_active
  FROM (
    SELECT 
      customer_id,
      COUNT(*) FILTER (WHERE status = 'processing') as active_count
    FROM jobs
    WHERE status IN ('pending', 'processing')
      AND scheduled_for <= NOW()
    GROUP BY customer_id
    ORDER BY active_count ASC, RANDOM()
    LIMIT 1
  ) AS customer_load;
  
  -- Get highest priority pending job for that customer
  SELECT id INTO _job_id
  FROM jobs
  WHERE status = 'pending'
    AND scheduled_for <= NOW()
    AND (customer_id = _customer_with_least_active OR _customer_with_least_active IS NULL)
    AND attempts < max_attempts
  ORDER BY 
    priority DESC,
    created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- Mark as processing
  IF _job_id IS NOT NULL THEN
    UPDATE jobs
    SET 
      status = 'processing',
      started_at = NOW(),
      updated_at = NOW()
    WHERE id = _job_id;
  END IF;
  
  RETURN _job_id;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_limits_updated_at
  BEFORE UPDATE ON public.tenant_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add default limits for existing customers
INSERT INTO tenant_limits (customer_id, max_concurrent_jobs, max_jobs_per_minute, max_jobs_per_hour)
SELECT id, 5, 20, 500
FROM customers
ON CONFLICT (customer_id) DO NOTHING;