-- Enable RLS on auth_rate_limits table
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow the security definer functions to manage rate limits (no direct user access needed)
-- This table is managed entirely by the check_auth_rate_limit function which uses SECURITY DEFINER