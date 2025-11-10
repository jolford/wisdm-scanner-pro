-- Drop existing policies if they exist
DROP POLICY IF EXISTS "System admins can manage all zone templates" ON public.zone_templates;
DROP POLICY IF EXISTS "Tenant admins can manage their zone templates" ON public.zone_templates;
DROP POLICY IF EXISTS "Users can view zone templates for their customer projects" ON public.zone_templates;
DROP POLICY IF EXISTS "Users can create zone templates in their customer projects" ON public.zone_templates;
DROP POLICY IF EXISTS "System admins can manage all zone definitions" ON public.zone_definitions;
DROP POLICY IF EXISTS "Tenant admins can manage their zone definitions" ON public.zone_definitions;
DROP POLICY IF EXISTS "Users can view zone definitions for their customer templates" ON public.zone_definitions;
DROP POLICY IF EXISTS "Users can create zone definitions for their templates" ON public.zone_definitions;

-- Recreate policies for zone_templates
CREATE POLICY "System admins can manage all zone templates"
  ON public.zone_templates
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their zone templates"
  ON public.zone_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = zone_templates.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = zone_templates.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

CREATE POLICY "Users can view zone templates for their customer projects"
  ON public.zone_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = zone_templates.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can create zone templates in their customer projects"
  ON public.zone_templates
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = zone_templates.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

-- Recreate policies for zone_definitions
CREATE POLICY "System admins can manage all zone definitions"
  ON public.zone_definitions
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their zone definitions"
  ON public.zone_definitions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.zone_templates zt
      JOIN public.projects p ON p.id = zt.project_id
      WHERE zt.id = zone_definitions.template_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.zone_templates zt
      JOIN public.projects p ON p.id = zt.project_id
      WHERE zt.id = zone_definitions.template_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

CREATE POLICY "Users can view zone definitions for their customer templates"
  ON public.zone_definitions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.zone_templates zt
      JOIN public.projects p ON p.id = zt.project_id
      WHERE zt.id = zone_definitions.template_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can create zone definitions for their templates"
  ON public.zone_definitions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.zone_templates zt
      JOIN public.projects p ON p.id = zt.project_id
      WHERE zt.id = zone_definitions.template_id
      AND zt.created_by = auth.uid()
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );