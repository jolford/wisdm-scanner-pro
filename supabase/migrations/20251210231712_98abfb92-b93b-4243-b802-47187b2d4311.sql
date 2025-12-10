-- Fix profiles table RLS - drop ALL existing then create new
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create restricted profile policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "System admins can view all profiles"
ON public.profiles FOR SELECT
USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_customers uc1
    JOIN user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = profiles.id
    AND is_tenant_admin(auth.uid(), uc1.customer_id)
  )
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix customers table RLS
DROP POLICY IF EXISTS "System admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Tenant admins can view own customer" ON public.customers;
DROP POLICY IF EXISTS "Users can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

CREATE POLICY "System admins can manage customers"
ON public.customers FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view own customer"
ON public.customers FOR SELECT
USING (is_tenant_admin(auth.uid(), id));

CREATE POLICY "Users can view their customers"
ON public.customers FOR SELECT
USING (has_customer(auth.uid(), id));