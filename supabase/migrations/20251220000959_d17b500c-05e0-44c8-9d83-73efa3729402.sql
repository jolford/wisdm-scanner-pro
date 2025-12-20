-- Drop any conflicting policies first
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their assigned customers only" ON public.customers;
DROP POLICY IF EXISTS "Tenant admins can update their customer" ON public.customers;
DROP POLICY IF EXISTS "System admins can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can view script execution logs" ON public.script_execution_logs;

-- Recreate profiles policies
-- Users can only view their own profile
CREATE POLICY "Users can view own profile only"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- System admins can view all profiles
CREATE POLICY "System admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

-- Tenant admins can view profiles within their tenant only
CREATE POLICY "Tenant admins can view tenant profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_customers uc1
    JOIN public.user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = profiles.id
    AND public.is_tenant_admin(auth.uid(), uc1.customer_id)
  )
);

-- Recreate customer policies
-- System admins can view all customers
CREATE POLICY "System admins can view all customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

-- Users can only view customers they are assigned to
CREATE POLICY "Users can view their assigned customers only"
ON public.customers FOR SELECT
TO authenticated
USING (
  public.has_customer(auth.uid(), id)
);

-- Tenant admins can manage their own customer record only
CREATE POLICY "Tenant admins can update their customer"
ON public.customers FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), id)
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), id)
);

-- System admins can manage all customers
CREATE POLICY "System admins can manage all customers"
ON public.customers FOR ALL
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- Recreate script execution logs policy - admins only
CREATE POLICY "Admins can view script execution logs"
ON public.script_execution_logs FOR SELECT
TO authenticated
USING (
  public.is_system_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.custom_scripts cs
    WHERE cs.id = script_execution_logs.script_id
    AND public.is_tenant_admin(auth.uid(), cs.customer_id)
  )
);