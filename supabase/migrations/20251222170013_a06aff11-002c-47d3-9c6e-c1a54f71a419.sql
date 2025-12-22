-- Tighten RLS for profiles and customers to eliminate public/overbroad access

-- =========================
-- public.profiles
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop overly-permissive / duplicate policies (some were created for role 'public')
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;

-- Recreate minimal, explicit policies (authenticated users only)
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_select_system_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "profiles_select_tenant_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_customers uc_admin
    JOIN public.user_customers uc_target
      ON uc_admin.customer_id = uc_target.customer_id
    WHERE uc_admin.user_id = auth.uid()
      AND uc_target.user_id = public.profiles.id
      AND is_tenant_admin(auth.uid(), uc_admin.customer_id)
  )
);

-- =========================
-- public.customers
-- =========================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop policies that allow non-admin users to read customer contact info
DROP POLICY IF EXISTS "Users can view own customer basic info" ON public.customers;
DROP POLICY IF EXISTS "Users can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their assigned customers only" ON public.customers;
DROP POLICY IF EXISTS "Tenant admins can view and update their customer" ON public.customers;
DROP POLICY IF EXISTS "Tenant admins can view own customer" ON public.customers;
DROP POLICY IF EXISTS "Admins can view customer details" ON public.customers;
DROP POLICY IF EXISTS "customer_restricted_view" ON public.customers;
DROP POLICY IF EXISTS "System admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "System admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "System admins can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Tenant admins can update their customer" ON public.customers;

-- Recreate strict policies: only system admins + tenant admins can read/manage
CREATE POLICY "customers_manage_system_admin"
ON public.customers
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "customers_select_tenant_admin"
ON public.customers
FOR SELECT
TO authenticated
USING (is_tenant_admin(auth.uid(), id));

CREATE POLICY "customers_update_tenant_admin"
ON public.customers
FOR UPDATE
TO authenticated
USING (is_tenant_admin(auth.uid(), id))
WITH CHECK (is_tenant_admin(auth.uid(), id));
