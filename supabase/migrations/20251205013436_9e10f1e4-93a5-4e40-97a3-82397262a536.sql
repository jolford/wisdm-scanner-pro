
-- Fix profiles table: users should only see their own profile, admins can see all in their tenant
DROP POLICY IF EXISTS "Users can view profiles in their customer" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view profiles in their customer tenant
CREATE POLICY "Admins can view tenant profiles"
ON public.profiles
FOR SELECT
USING (
  is_admin_enhanced() AND EXISTS (
    SELECT 1 FROM public.user_customers uc1
    JOIN public.user_customers uc2 ON uc1.customer_id = uc2.customer_id
    WHERE uc1.user_id = auth.uid() AND uc2.user_id = profiles.id
  )
);

-- Fix customers table: only tenant admins can view full customer info
DROP POLICY IF EXISTS "Users can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers they belong to" ON public.customers;

-- Only admins can view customer contact information
CREATE POLICY "Admins can view customer details"
ON public.customers
FOR SELECT
USING (
  is_admin_enhanced() AND has_customer(auth.uid(), id)
);

-- Regular users can only see basic customer info (company name only via function)
CREATE POLICY "Users can view own customer basic info"
ON public.customers
FOR SELECT
USING (has_customer(auth.uid(), id));
