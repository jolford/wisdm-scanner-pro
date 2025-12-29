-- Fix 1: Profiles table - Block anonymous access, require authentication
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate with explicit authentication requirement (profiles.id = auth.uid())
CREATE POLICY "Authenticated users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (is_admin_enhanced() OR is_system_admin(auth.uid()));

-- Fix 2: Customers table - Block anonymous access, require authentication
DROP POLICY IF EXISTS "Users can view customers they belong to" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;

CREATE POLICY "Authenticated users can view their associated customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  id IN (SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid())
  OR is_admin_enhanced() 
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Admins can manage all customers" 
ON public.customers 
FOR ALL 
TO authenticated
USING (is_admin_enhanced() OR is_system_admin(auth.uid()))
WITH CHECK (is_admin_enhanced() OR is_system_admin(auth.uid()));

-- Fix 3: API Keys table - Block anonymous access, restrict to customer owners and admins
DROP POLICY IF EXISTS "Users can view API keys for their customer" ON public.api_keys;
DROP POLICY IF EXISTS "Users can manage API keys for their customer" ON public.api_keys;

CREATE POLICY "Authenticated users can view their customer API keys" 
ON public.api_keys 
FOR SELECT 
TO authenticated
USING (
  customer_id IN (SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid())
  OR is_admin_enhanced() 
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Authenticated users can manage their customer API keys" 
ON public.api_keys 
FOR ALL 
TO authenticated
USING (
  customer_id IN (SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid())
  OR is_admin_enhanced() 
  OR is_system_admin(auth.uid())
)
WITH CHECK (
  customer_id IN (SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid())
  OR is_admin_enhanced() 
  OR is_system_admin(auth.uid())
);