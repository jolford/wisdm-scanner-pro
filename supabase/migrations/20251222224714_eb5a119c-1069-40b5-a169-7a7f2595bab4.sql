-- =========================
-- SECURITY ALERTS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT,
  details JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Only system admins can view security alerts
CREATE POLICY "security_alerts_admin_only" ON public.security_alerts
  FOR ALL USING (is_system_admin(auth.uid()) OR is_admin_enhanced());

-- =========================
-- DATABASE PERFORMANCE INDEXES
-- =========================

-- Jobs table - frequently filtered by status, customer_id, created_at
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_created ON public.jobs(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON public.jobs(scheduled_for) WHERE status = 'pending';

-- Documents table - frequently filtered
CREATE INDEX IF NOT EXISTS idx_documents_batch_status ON public.documents(batch_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_documents_project_created ON public.documents(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);

-- Batches table
CREATE INDEX IF NOT EXISTS idx_batches_project_status ON public.batches(project_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_customer_created ON public.batches(customer_id, created_at DESC);

-- Audit trail - frequently queried by date
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON public.audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON public.audit_trail(entity_type, entity_id);

-- Error logs - frequently queried by date
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);

-- API key usage - rate limiting queries
CREATE INDEX IF NOT EXISTS idx_api_key_usage_recent ON public.api_key_usage(api_key_id, created_at DESC);

-- =========================
-- SECURITY SCAN FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.run_security_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alerts jsonb := '[]'::jsonb;
  tables_without_rls INTEGER;
  admin_count INTEGER;
  stale_sessions INTEGER;
  expired_keys INTEGER;
BEGIN
  -- Check for tables without RLS (simplified check)
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
  );
  
  IF tables_without_rls > 0 THEN
    alerts := alerts || jsonb_build_object(
      'type', 'rls_missing',
      'severity', 'critical',
      'title', 'Tables without RLS policies',
      'count', tables_without_rls
    );
  END IF;
  
  -- Check for expired API keys still marked active
  SELECT COUNT(*) INTO expired_keys
  FROM public.api_keys
  WHERE is_active = true
  AND expires_at IS NOT NULL
  AND expires_at < now();
  
  IF expired_keys > 0 THEN
    alerts := alerts || jsonb_build_object(
      'type', 'expired_keys',
      'severity', 'warning',
      'title', 'Expired API keys still active',
      'count', expired_keys
    );
    
    -- Auto-fix: deactivate expired keys
    UPDATE public.api_keys
    SET is_active = false
    WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();
  END IF;
  
  -- Check admin count (alert if too many)
  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role IN ('admin', 'system_admin');
  
  IF admin_count > 10 THEN
    alerts := alerts || jsonb_build_object(
      'type', 'excessive_admins',
      'severity', 'warning',
      'title', 'High number of admin accounts',
      'count', admin_count
    );
  END IF;
  
  -- Insert alerts into security_alerts table
  INSERT INTO public.security_alerts (alert_type, severity, title, details)
  SELECT 
    elem->>'type',
    elem->>'severity',
    elem->>'title',
    elem
  FROM jsonb_array_elements(alerts) AS elem;
  
  RETURN jsonb_build_object(
    'scan_completed', now(),
    'alerts_found', jsonb_array_length(alerts),
    'alerts', alerts
  );
END;
$$;

-- =========================
-- RATE LIMITING FOR AUTH
-- =========================
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  attempts INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT now(),
  last_attempt_at TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(ip_address, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_ip ON public.auth_rate_limits(ip_address, endpoint);

-- Function to check/update rate limits
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(_ip_address TEXT, _endpoint TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit_record RECORD;
  _max_attempts INTEGER := 5;
  _window_minutes INTEGER := 15;
  _block_minutes INTEGER := 30;
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
      'retry_after_seconds', EXTRACT(EPOCH FROM (_limit_record.blocked_until - now()))::integer
    );
  END IF;
  
  -- Check if should be blocked
  IF _limit_record.attempts >= _max_attempts THEN
    UPDATE public.auth_rate_limits
    SET blocked_until = now() + (_block_minutes || ' minutes')::interval
    WHERE id = _limit_record.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'too_many_attempts',
      'blocked_until', now() + (_block_minutes || ' minutes')::interval,
      'retry_after_seconds', _block_minutes * 60
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'attempts', _limit_record.attempts,
    'remaining', _max_attempts - _limit_record.attempts
  );
END;
$$;

-- Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_auth_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.auth_rate_limits
  WHERE last_attempt_at < now() - interval '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;