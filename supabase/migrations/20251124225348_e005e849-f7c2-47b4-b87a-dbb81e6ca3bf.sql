-- Fix installed_integrations RLS policies to avoid auth.users access issues
-- Drop all existing policies
DROP POLICY IF EXISTS "System admins can manage all integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Tenant admins can manage their integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can view their customer integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can install integrations" ON public.installed_integrations;

-- System admins can manage everything
CREATE POLICY "System admins full access"
  ON public.installed_integrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'system_admin'
    )
  );

-- Users can view integrations for their customer
CREATE POLICY "Users can view integrations"
  ON public.installed_integrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_customers
      WHERE user_id = auth.uid()
      AND user_customers.customer_id = installed_integrations.customer_id
    )
  );

-- Users can install integrations for their customer
CREATE POLICY "Users can install integrations"
  ON public.installed_integrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_customers
      WHERE user_id = auth.uid()
      AND user_customers.customer_id = installed_integrations.customer_id
    )
    AND installed_by = auth.uid()
  );

-- Users can uninstall integrations for their customer
CREATE POLICY "Users can delete integrations"
  ON public.installed_integrations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_customers
      WHERE user_id = auth.uid()
      AND user_customers.customer_id = installed_integrations.customer_id
    )
  );