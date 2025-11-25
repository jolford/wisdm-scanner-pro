-- Create project_integrations junction table for project-level integration assignments
CREATE TABLE public.project_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  installed_integration_id UUID NOT NULL REFERENCES public.installed_integrations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(project_id, installed_integration_id)
);

-- Enable RLS
ALTER TABLE public.project_integrations ENABLE ROW LEVEL SECURITY;

-- System admins can manage all project integrations
CREATE POLICY "System admins can manage all project integrations"
  ON public.project_integrations
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Tenant admins can manage their project integrations
CREATE POLICY "Tenant admins can manage their project integrations"
  ON public.project_integrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_integrations.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_integrations.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

-- Users can view integrations for their projects
CREATE POLICY "Users can view project integrations"
  ON public.project_integrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_integrations.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_project_integrations_project_id ON public.project_integrations(project_id);
CREATE INDEX idx_project_integrations_integration_id ON public.project_integrations(installed_integration_id);