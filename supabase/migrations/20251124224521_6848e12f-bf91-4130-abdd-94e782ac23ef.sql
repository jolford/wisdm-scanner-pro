-- Create workflows table
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  workflow_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- System admins can manage all workflows
CREATE POLICY "System admins can manage all workflows"
  ON public.workflows
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Tenant admins can manage their workflows
CREATE POLICY "Tenant admins can manage workflows"
  ON public.workflows
  FOR ALL
  USING (is_tenant_admin(auth.uid(), customer_id))
  WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

-- Users can view workflows for their customer
CREATE POLICY "Users can view workflows in their customer"
  ON public.workflows
  FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

-- Create index
CREATE INDEX idx_workflows_project_id ON public.workflows(project_id);
CREATE INDEX idx_workflows_customer_id ON public.workflows(customer_id);