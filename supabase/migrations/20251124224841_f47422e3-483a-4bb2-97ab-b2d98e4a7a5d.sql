-- Fix RLS policies for installed_integrations table

-- Drop existing policies if any
DROP POLICY IF EXISTS "System admins can manage all integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Tenant admins can manage their integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can view their customer integrations" ON public.installed_integrations;
DROP POLICY IF EXISTS "Users can install integrations" ON public.installed_integrations;

-- System admins can manage all integrations
CREATE POLICY "System admins can manage all integrations"
  ON public.installed_integrations
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Tenant admins can manage their integrations
CREATE POLICY "Tenant admins can manage their integrations"
  ON public.installed_integrations
  FOR ALL
  USING (is_tenant_admin(auth.uid(), customer_id))
  WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

-- Users can view integrations for their customer
CREATE POLICY "Users can view their customer integrations"
  ON public.installed_integrations
  FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

-- Users can install integrations for their customer
CREATE POLICY "Users can install integrations"
  ON public.installed_integrations
  FOR INSERT
  WITH CHECK (
    has_customer(auth.uid(), customer_id) AND
    installed_by = auth.uid()
  );