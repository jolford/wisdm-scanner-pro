-- =====================================================
-- Performance Indexes on commonly filtered columns
-- =====================================================

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(validation_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_batch_id ON public.documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);

-- Batches table indexes
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_customer_id ON public.batches(customer_id);
CREATE INDEX IF NOT EXISTS idx_batches_project_id ON public.batches(project_id);

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_for ON public.jobs(scheduled_for);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON public.audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_customer_id ON public.audit_trail(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity_type ON public.audit_trail(entity_type);

-- Error logs indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);

-- API key usage indexes
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON public.api_key_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON public.api_key_usage(api_key_id);

-- License usage indexes
CREATE INDEX IF NOT EXISTS idx_license_usage_license_id ON public.license_usage(license_id);
CREATE INDEX IF NOT EXISTS idx_license_usage_used_at ON public.license_usage(used_at DESC);

-- =====================================================
-- Security scan admin notification table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.security_scan_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_result JSONB NOT NULL,
  alerts_count INTEGER NOT NULL DEFAULT 0,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.security_scan_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view security notifications
CREATE POLICY "Admins can view security notifications"
  ON public.security_scan_notifications
  FOR SELECT
  USING (public.is_admin_enhanced());

-- Only system can insert notifications (via edge function)
CREATE POLICY "System can insert security notifications"
  ON public.security_scan_notifications
  FOR INSERT
  WITH CHECK (true);

-- Admins can acknowledge notifications
CREATE POLICY "Admins can update security notifications"
  ON public.security_scan_notifications
  FOR UPDATE
  USING (public.is_admin_enhanced());

-- =====================================================
-- Enhanced auth rate limiting with exponential backoff
-- =====================================================

-- Add exponential backoff tracking
ALTER TABLE public.auth_rate_limits 
  ADD COLUMN IF NOT EXISTS lockout_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_lockout_at TIMESTAMP WITH TIME ZONE;

-- Function to check rate limit with exponential backoff
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit_enhanced(
  _ip_address TEXT,
  _endpoint TEXT,
  _email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit_record RECORD;
  _base_attempts INTEGER := 5;
  _window_minutes INTEGER := 15;
  _base_block_minutes INTEGER := 5;
  _max_block_minutes INTEGER := 1440; -- 24 hours max
  _actual_block_minutes INTEGER;
BEGIN
  -- Get or create rate limit record
  INSERT INTO public.auth_rate_limits (ip_address, endpoint)
  VALUES (_ip_address, _endpoint)
  ON CONFLICT (ip_address, endpoint) DO UPDATE
  SET 
    attempts = CASE 
      WHEN auth_rate_limits.first_attempt_at < now() - (_window_minutes || ' minutes')::interval 
      THEN 1
      ELSE auth_rate_limits.attempts + 1
    END,
    first_attempt_at = CASE 
      WHEN auth_rate_limits.first_attempt_at < now() - (_window_minutes || ' minutes')::interval 
      THEN now()
      ELSE auth_rate_limits.first_attempt_at
    END,
    last_attempt_at = now()
  RETURNING * INTO _limit_record;
  
  -- Check if currently blocked
  IF _limit_record.blocked_until IS NOT NULL AND _limit_record.blocked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'blocked_until', _limit_record.blocked_until,
      'retry_after_seconds', EXTRACT(EPOCH FROM (_limit_record.blocked_until - now()))::integer,
      'lockout_count', _limit_record.lockout_count
    );
  END IF;
  
  -- Check if should be blocked (with exponential backoff)
  IF _limit_record.attempts >= _base_attempts THEN
    -- Calculate block duration with exponential backoff
    _actual_block_minutes := LEAST(
      _base_block_minutes * POWER(2, COALESCE(_limit_record.lockout_count, 0)),
      _max_block_minutes
    );
    
    UPDATE public.auth_rate_limits
    SET 
      blocked_until = now() + (_actual_block_minutes || ' minutes')::interval,
      lockout_count = COALESCE(lockout_count, 0) + 1,
      last_lockout_at = now()
    WHERE id = _limit_record.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'too_many_attempts',
      'blocked_until', now() + (_actual_block_minutes || ' minutes')::interval,
      'retry_after_seconds', _actual_block_minutes * 60,
      'lockout_count', COALESCE(_limit_record.lockout_count, 0) + 1
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'attempts', _limit_record.attempts,
    'remaining', _base_attempts - _limit_record.attempts
  );
END;
$$;

-- Function to reset rate limit on successful auth
CREATE OR REPLACE FUNCTION public.reset_auth_rate_limit(_ip_address TEXT, _endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_rate_limits
  WHERE ip_address = _ip_address AND endpoint = _endpoint;
END;
$$;