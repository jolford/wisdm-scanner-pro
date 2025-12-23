-- =====================================================
-- MONITORING & OBSERVABILITY ENHANCEMENTS
-- =====================================================

-- 1. Add severity level to error_logs table
ALTER TABLE public.error_logs 
ADD COLUMN IF NOT EXISTS severity text DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'));

ALTER TABLE public.error_logs
ADD COLUMN IF NOT EXISTS alert_sent boolean DEFAULT false;

ALTER TABLE public.error_logs
ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;

ALTER TABLE public.error_logs
ADD COLUMN IF NOT EXISTS resolved_by uuid;

-- 2. Create alerting thresholds configuration table
CREATE TABLE IF NOT EXISTS public.alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  threshold_type text NOT NULL, -- 'error_rate', 'job_failure_rate', 'response_time', 'ai_cost'
  threshold_value numeric NOT NULL,
  comparison_operator text NOT NULL DEFAULT 'greater_than' CHECK (comparison_operator IN ('greater_than', 'less_than', 'equals')),
  time_window_minutes integer DEFAULT 60,
  alert_channels text[] DEFAULT ARRAY['email'],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(customer_id, threshold_type)
);

-- RLS for alert_thresholds
ALTER TABLE public.alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can manage all thresholds" ON public.alert_thresholds
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their thresholds" ON public.alert_thresholds
  FOR ALL USING (is_tenant_admin(auth.uid(), customer_id))
  WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

CREATE POLICY "Users can view their customer thresholds" ON public.alert_thresholds
  FOR SELECT USING (has_customer(auth.uid(), customer_id));

-- 3. Add response time tracking to job_metrics
ALTER TABLE public.job_metrics
ADD COLUMN IF NOT EXISTS min_processing_time_ms integer;

ALTER TABLE public.job_metrics
ADD COLUMN IF NOT EXISTS max_processing_time_ms integer;

ALTER TABLE public.job_metrics
ADD COLUMN IF NOT EXISTS p95_processing_time_ms integer;

ALTER TABLE public.job_metrics
ADD COLUMN IF NOT EXISTS api_calls_count integer DEFAULT 0;

ALTER TABLE public.job_metrics
ADD COLUMN IF NOT EXISTS api_errors_count integer DEFAULT 0;

-- 4. Create service health status table
CREATE TABLE IF NOT EXISTS public.service_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  last_check_at timestamp with time zone DEFAULT now(),
  response_time_ms integer,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  consecutive_failures integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS for service_health
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service health" ON public.service_health
  FOR SELECT USING (true);

CREATE POLICY "System can update service health" ON public.service_health
  FOR ALL USING (is_system_admin(auth.uid()) OR auth.uid() IS NULL)
  WITH CHECK (true);

-- 5. Create function to check alert thresholds
CREATE OR REPLACE FUNCTION public.check_alert_thresholds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  alerts jsonb := '[]'::jsonb;
  threshold RECORD;
  current_value numeric;
  should_alert boolean;
BEGIN
  FOR threshold IN 
    SELECT * FROM public.alert_thresholds WHERE is_active = true
  LOOP
    should_alert := false;
    
    -- Calculate current value based on threshold type
    CASE threshold.threshold_type
      WHEN 'error_rate' THEN
        SELECT COUNT(*)::numeric / GREATEST(threshold.time_window_minutes, 1)
        INTO current_value
        FROM public.error_logs
        WHERE created_at > NOW() - (threshold.time_window_minutes || ' minutes')::interval
          AND severity IN ('error', 'critical')
          AND (threshold.customer_id IS NULL OR user_id IN (
            SELECT user_id FROM user_customers WHERE customer_id = threshold.customer_id
          ));
          
      WHEN 'job_failure_rate' THEN
        SELECT CASE WHEN total > 0 THEN (failed::numeric / total * 100) ELSE 0 END
        INTO current_value
        FROM (
          SELECT 
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) as total
          FROM public.jobs
          WHERE created_at > NOW() - (threshold.time_window_minutes || ' minutes')::interval
            AND (threshold.customer_id IS NULL OR customer_id = threshold.customer_id)
        ) counts;
        
      WHEN 'response_time' THEN
        SELECT COALESCE(AVG(avg_processing_time_ms), 0)
        INTO current_value
        FROM public.job_metrics
        WHERE created_at > NOW() - (threshold.time_window_minutes || ' minutes')::interval
          AND (threshold.customer_id IS NULL OR customer_id = threshold.customer_id);
          
      ELSE
        current_value := 0;
    END CASE;
    
    -- Check if threshold is exceeded
    CASE threshold.comparison_operator
      WHEN 'greater_than' THEN
        should_alert := current_value > threshold.threshold_value;
      WHEN 'less_than' THEN
        should_alert := current_value < threshold.threshold_value;
      WHEN 'equals' THEN
        should_alert := current_value = threshold.threshold_value;
    END CASE;
    
    IF should_alert THEN
      alerts := alerts || jsonb_build_object(
        'threshold_id', threshold.id,
        'threshold_type', threshold.threshold_type,
        'current_value', current_value,
        'threshold_value', threshold.threshold_value,
        'customer_id', threshold.customer_id
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'checked_at', NOW(),
    'alerts_triggered', jsonb_array_length(alerts),
    'alerts', alerts
  );
END;
$$;

-- 6. Create comprehensive health check function
CREATE OR REPLACE FUNCTION public.get_comprehensive_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  health_status jsonb;
  db_health jsonb;
  job_health jsonb;
  storage_health jsonb;
  auth_health jsonb;
BEGIN
  -- Database health
  SELECT jsonb_build_object(
    'status', 'healthy',
    'connection', true,
    'tables_count', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'checked_at', NOW()
  ) INTO db_health;
  
  -- Job processing health
  SELECT jsonb_build_object(
    'status', CASE 
      WHEN stuck_count > 5 THEN 'unhealthy'
      WHEN stuck_count > 0 OR failed_rate > 20 THEN 'degraded'
      ELSE 'healthy'
    END,
    'pending_jobs', pending_count,
    'processing_jobs', processing_count,
    'stuck_jobs', stuck_count,
    'failed_rate_24h', failed_rate
  ) INTO job_health
  FROM (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
      COUNT(*) FILTER (WHERE status = 'processing' AND started_at < NOW() - INTERVAL '30 minutes') as stuck_count,
      CASE WHEN COUNT(*) > 0 
        THEN (COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours')::numeric / 
              GREATEST(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 1) * 100)
        ELSE 0 
      END as failed_rate
    FROM public.jobs
  ) job_stats;
  
  -- Authentication health (check recent rate limits)
  SELECT jsonb_build_object(
    'status', CASE 
      WHEN blocked_count > 10 THEN 'degraded'
      ELSE 'healthy'
    END,
    'active_rate_limits', blocked_count,
    'recent_attempts', attempt_count
  ) INTO auth_health
  FROM (
    SELECT 
      COUNT(*) FILTER (WHERE blocked_until > NOW()) as blocked_count,
      COUNT(*) FILTER (WHERE last_attempt_at > NOW() - INTERVAL '1 hour') as attempt_count
    FROM public.auth_rate_limits
  ) rate_stats;
  
  -- Aggregate overall status
  health_status := jsonb_build_object(
    'overall_status', CASE 
      WHEN (job_health->>'status') = 'unhealthy' THEN 'unhealthy'
      WHEN (job_health->>'status') = 'degraded' OR (auth_health->>'status') = 'degraded' THEN 'degraded'
      ELSE 'healthy'
    END,
    'timestamp', NOW(),
    'services', jsonb_build_object(
      'database', db_health,
      'job_processing', job_health,
      'authentication', auth_health
    )
  );
  
  RETURN health_status;
END;
$$;

-- Add indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_alert_sent ON public.error_logs(alert_sent) WHERE alert_sent = false;
CREATE INDEX IF NOT EXISTS idx_service_health_status ON public.service_health(status);