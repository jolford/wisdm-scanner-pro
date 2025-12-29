-- Remove the duplicate policies that allow public (unauthenticated) access
-- These are redundant with the authenticated versions and create security holes

-- Drop public policies on profiles
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_system_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_tenant_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

-- Drop public policies on customers
DROP POLICY IF EXISTS "customers_select_customer_members" ON public.customers;
DROP POLICY IF EXISTS "customers_select_tenant_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_update_tenant_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_manage_system_admin" ON public.customers;

-- Drop public policies on api_keys
DROP POLICY IF EXISTS "System admins can manage all API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Tenant admins can manage their customer API keys" ON public.api_keys;

-- Now recreate necessary policies with TO authenticated role only

-- Profiles: tenant admin can view profiles in their customer
CREATE POLICY "Tenant admins can view customer profiles"
ON public.profiles
FOR SELECT
TO authenticated
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

-- Customers: recreate with authenticated role
CREATE POLICY "Customer members can view their customers"
ON public.customers
FOR SELECT
TO authenticated
USING (has_customer(auth.uid(), id) OR is_tenant_admin(auth.uid(), id) OR is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can update their customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (is_tenant_admin(auth.uid(), id))
WITH CHECK (is_tenant_admin(auth.uid(), id));

CREATE POLICY "System admins can manage customers"
ON public.customers
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- API Keys: recreate with authenticated role
CREATE POLICY "System admins can manage all API keys"
ON public.api_keys
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their API keys"
ON public.api_keys
FOR ALL
TO authenticated
USING (is_tenant_admin(auth.uid(), customer_id))
WITH CHECK (is_tenant_admin(auth.uid(), customer_id));