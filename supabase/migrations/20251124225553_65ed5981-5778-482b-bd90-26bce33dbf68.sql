-- Create security definer function to check customer access for integrations
CREATE OR REPLACE FUNCTION public.can_access_integration_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_customers
    WHERE user_id = auth.uid()
    AND customer_id = _customer_id
  )
$$;

-- Drop existing policies on installed_integrations
DROP POLICY IF EXISTS "System admins full access" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can view integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can install integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can delete integrations" ON public.installed_integrations;

-- Recreate policies using the security definer function
CREATE POLICY "System admins full access"
  ON public.installed_integrations
  FOR ALL
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Users can view integrations"
  ON public.installed_integrations
  FOR SELECT
  USING (can_access_integration_customer(customer_id));

CREATE POLICY "Users can install integrations"
  ON public.installed_integrations
  FOR INSERT
  WITH CHECK (
    can_access_integration_customer(customer_id)
    AND installed_by = auth.uid()
  );

CREATE POLICY "Users can delete integrations"
  ON public.installed_integrations
  FOR DELETE
  USING (can_access_integration_customer(customer_id));