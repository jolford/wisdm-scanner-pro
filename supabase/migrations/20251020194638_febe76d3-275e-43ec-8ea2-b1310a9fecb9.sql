-- Check and fix any remaining SECURITY DEFINER functions without search_path

-- Ensure all SECURITY DEFINER functions have search_path set
-- Most are already fixed, but verify and set for any remaining ones

-- Fix is_system_admin if needed
ALTER FUNCTION public.is_system_admin(uuid)
SET search_path = public;

-- Fix is_tenant_admin if needed  
ALTER FUNCTION public.is_tenant_admin(uuid, uuid)
SET search_path = public;

-- Verify check_tenant_rate_limit
ALTER FUNCTION public.check_tenant_rate_limit(uuid, text)
SET search_path = public;

-- Verify get_next_job
ALTER FUNCTION public.get_next_job()
SET search_path = public;

-- Verify calculate_ai_cost
ALTER FUNCTION public.calculate_ai_cost(text, integer, integer, boolean)
SET search_path = public;

-- Verify update_tenant_usage
ALTER FUNCTION public.update_tenant_usage(uuid, text, numeric, integer, boolean)
SET search_path = public;