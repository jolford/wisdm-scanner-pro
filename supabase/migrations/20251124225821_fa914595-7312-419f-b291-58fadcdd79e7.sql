-- Drop existing policies first
DROP POLICY IF EXISTS "System admins full access" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can view integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can install integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can delete integrations" ON public.installed_integrations;

-- Now drop the function
DROP FUNCTION IF EXISTS public.can_access_integration_customer(_customer_id uuid);

-- Recreate policies using the existing has_customer function
CREATE POLICY "System admins full access"
  ON public.installed_integrations
  FOR ALL
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Users can view integrations"
  ON public.installed_integrations
  FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

CREATE POLICY "Users can install integrations"
  ON public.installed_integrations
  FOR INSERT
  WITH CHECK (
    has_customer(auth.uid(), customer_id)
    AND installed_by = auth.uid()
  );

CREATE POLICY "Users can delete integrations"
  ON public.installed_integrations
  FOR DELETE
  USING (has_customer(auth.uid(), customer_id));