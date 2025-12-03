-- Create enum for API key scopes
CREATE TYPE api_key_scope AS ENUM ('read', 'write', 'admin');

-- Create API keys table with proper security features
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Key identification (prefix is visible, hash is for validation)
  key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for identification (e.g., "wisdm_ak")
  key_hash TEXT NOT NULL, -- SHA-256 hash of full key
  
  -- Metadata
  name TEXT NOT NULL, -- Human-readable name for the key
  description TEXT,
  
  -- Scoping and permissions
  scope api_key_scope NOT NULL DEFAULT 'write',
  allowed_project_ids UUID[] DEFAULT NULL, -- NULL means all projects, array limits to specific projects
  
  -- Rate limiting
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,
  
  -- Key lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL means never expires
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_used_ip TEXT,
  usage_count BIGINT NOT NULL DEFAULT 0,
  
  -- Rotation tracking
  rotated_from_key_id UUID REFERENCES public.api_keys(id),
  rotated_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID,
  revocation_reason TEXT
);

-- Create API key usage log for rate limiting and audit
CREATE TABLE public.api_key_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  
  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_api_keys_customer ON public.api_keys(customer_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_key_usage_key_id ON public.api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_created ON public.api_key_usage(created_at DESC);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys
CREATE POLICY "System admins can manage all API keys"
ON public.api_keys FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their customer API keys"
ON public.api_keys FOR ALL
USING (is_tenant_admin(auth.uid(), customer_id))
WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

CREATE POLICY "Users can view API keys for their customer"
ON public.api_keys FOR SELECT
USING (has_customer(auth.uid(), customer_id));

-- RLS Policies for api_key_usage (read-only for users)
CREATE POLICY "System admins can view all API key usage"
ON public.api_key_usage FOR SELECT
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their API key usage"
ON public.api_key_usage FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.api_keys ak
    WHERE ak.id = api_key_usage.api_key_id
    AND is_tenant_admin(auth.uid(), ak.customer_id)
  )
);

CREATE POLICY "System can insert API key usage"
ON public.api_key_usage FOR INSERT
WITH CHECK (true);

-- Function to check API key rate limits
CREATE OR REPLACE FUNCTION public.check_api_key_rate_limit(_api_key_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _key RECORD;
  _minute_count INTEGER;
  _hour_count INTEGER;
  _day_count INTEGER;
  _result JSONB;
BEGIN
  -- Get key config
  SELECT * INTO _key FROM public.api_keys WHERE id = _api_key_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'key_not_found');
  END IF;
  
  -- Check if key is active
  IF NOT _key.is_active THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'key_inactive');
  END IF;
  
  -- Check if key is revoked
  IF _key.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'key_revoked');
  END IF;
  
  -- Check if key is expired
  IF _key.expires_at IS NOT NULL AND _key.expires_at < NOW() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'key_expired');
  END IF;
  
  -- Count requests in last minute
  SELECT COUNT(*) INTO _minute_count
  FROM public.api_key_usage
  WHERE api_key_id = _api_key_id
  AND created_at > NOW() - INTERVAL '1 minute';
  
  IF _minute_count >= _key.rate_limit_per_minute THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'rate_limit_minute',
      'limit', _key.rate_limit_per_minute,
      'current', _minute_count
    );
  END IF;
  
  -- Count requests in last hour
  SELECT COUNT(*) INTO _hour_count
  FROM public.api_key_usage
  WHERE api_key_id = _api_key_id
  AND created_at > NOW() - INTERVAL '1 hour';
  
  IF _hour_count >= _key.rate_limit_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'rate_limit_hour',
      'limit', _key.rate_limit_per_hour,
      'current', _hour_count
    );
  END IF;
  
  -- Count requests in last day
  SELECT COUNT(*) INTO _day_count
  FROM public.api_key_usage
  WHERE api_key_id = _api_key_id
  AND created_at > NOW() - INTERVAL '1 day';
  
  IF _day_count >= _key.rate_limit_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'rate_limit_day',
      'limit', _key.rate_limit_per_day,
      'current', _day_count
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'minute_remaining', _key.rate_limit_per_minute - _minute_count,
    'hour_remaining', _key.rate_limit_per_hour - _hour_count,
    'day_remaining', _key.rate_limit_per_day - _day_count
  );
END;
$$;

-- Function to validate and get API key details
CREATE OR REPLACE FUNCTION public.validate_api_key(_key_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _key RECORD;
  _rate_check JSONB;
BEGIN
  -- Find key by hash
  SELECT * INTO _key 
  FROM public.api_keys 
  WHERE key_hash = _key_hash;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_key');
  END IF;
  
  -- Check rate limits
  _rate_check := public.check_api_key_rate_limit(_key.id);
  
  IF NOT (_rate_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'reason', _rate_check->>'reason',
      'rate_limit', _rate_check
    );
  END IF;
  
  -- Update last used
  UPDATE public.api_keys
  SET 
    last_used_at = NOW(),
    usage_count = usage_count + 1
  WHERE id = _key.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'api_key_id', _key.id,
    'customer_id', _key.customer_id,
    'scope', _key.scope,
    'allowed_project_ids', _key.allowed_project_ids,
    'rate_limit', _rate_check
  );
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();