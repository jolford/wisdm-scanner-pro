-- Fix 1: Remove public access to service_health and restrict to admins
DROP POLICY IF EXISTS "Anyone can view service health" ON public.service_health;

CREATE POLICY "Only admins can view service health" 
ON public.service_health 
FOR SELECT 
USING (
  is_admin_enhanced() OR is_system_admin(auth.uid())
);

-- Fix 2: Add RLS policies for auth_rate_limits table
-- This table should only be accessible by system/edge functions via service role
-- Regular users should never access it directly

CREATE POLICY "Service role can manage rate limits" 
ON public.auth_rate_limits 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');