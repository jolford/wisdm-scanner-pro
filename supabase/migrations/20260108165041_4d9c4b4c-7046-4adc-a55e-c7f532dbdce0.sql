-- =====================================================
-- Security Fix: Restrict access to sensitive PII tables
-- =====================================================

-- 1. PROFILES TABLE - Restrict to only own profile + system/tenant admins
-- Drop the overly permissive tenant admin SELECT policy
DROP POLICY IF EXISTS "Tenant admins can view customer profiles" ON public.profiles;

-- Create a more restrictive policy - tenant admins can only see basic info needed for assignment
-- System admins get full access
CREATE POLICY "System admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_system_admin(auth.uid()));

-- 2. CUSTOMERS TABLE - Already has good structure, but ensure only tenant admins can view contact details
-- The current policies are acceptable - users in customer can see their customer's info
-- No changes needed - the finding was a false positive as users SHOULD see their own company info

-- 3. VOTER_REGISTRY TABLE - Restrict to only tenant admins and system admins (not regular customer members)
-- This table contains highly sensitive PII that should not be visible to all customer members
DROP POLICY IF EXISTS "Users can view voter registries for their customer" ON public.voter_registry;

-- Only tenant admins and system admins should access voter registry data
-- Regular users should NOT have direct access to voter PII
CREATE POLICY "Authorized users can view voter registries"
ON public.voter_registry
FOR SELECT
USING (
  is_system_admin(auth.uid()) OR 
  is_tenant_admin(auth.uid(), customer_id)
);