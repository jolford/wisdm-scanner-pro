-- Fix overly-broad auth-only policies by using a RESTRICTIVE auth gate + PERMISSIVE scoped access

-- =========================
-- PROFILES
-- =========================
DROP POLICY IF EXISTS "profiles_require_auth" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_system_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_tenant_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

-- Gate: must be authenticated for any operation
CREATE POLICY "profiles_require_auth"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own profile
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- System admins can view all profiles
CREATE POLICY "profiles_select_system_admin"
ON public.profiles
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Tenant admins can view profiles for users in their customer
CREATE POLICY "profiles_select_tenant_admin"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_customers uc_admin
    JOIN user_customers uc_target ON uc_admin.customer_id = uc_target.customer_id
    WHERE uc_admin.user_id = auth.uid()
      AND uc_target.user_id = profiles.id
      AND is_tenant_admin(auth.uid(), uc_admin.customer_id)
  )
);

-- Users can update their own profile
CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- =========================
-- CUSTOMERS
-- =========================
DROP POLICY IF EXISTS "customers_require_auth" ON public.customers;

-- Keep existing scoped policies, but gate all ops behind auth without widening access
CREATE POLICY "customers_require_auth"
ON public.customers
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Optional: allow customer members to read only their own customer row
-- (This is what prevents 'any authenticated user' from harvesting the whole customers table)
DROP POLICY IF EXISTS "customers_select_customer_members" ON public.customers;
CREATE POLICY "customers_select_customer_members"
ON public.customers
FOR SELECT
USING (has_customer(auth.uid(), id) OR is_tenant_admin(auth.uid(), id) OR is_system_admin(auth.uid()));


-- =========================
-- SSO_CONFIGS
-- =========================
DROP POLICY IF EXISTS "sso_configs_require_auth" ON public.sso_configs;

-- Gate: must be authenticated, but do NOT grant access by itself
CREATE POLICY "sso_configs_require_auth"
ON public.sso_configs
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure scoped access exists (tenant admins for that customer, or system admin)
DROP POLICY IF EXISTS "sso_configs_select_admins" ON public.sso_configs;
CREATE POLICY "sso_configs_select_admins"
ON public.sso_configs
FOR SELECT
USING (is_system_admin(auth.uid()) OR is_tenant_admin(auth.uid(), customer_id));
