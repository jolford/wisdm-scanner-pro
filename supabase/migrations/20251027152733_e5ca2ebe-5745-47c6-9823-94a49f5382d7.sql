-- Create email import configurations table
CREATE TABLE IF NOT EXISTS public.email_import_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Email settings
  email_host TEXT NOT NULL,
  email_port INTEGER NOT NULL DEFAULT 993,
  email_username TEXT NOT NULL,
  email_password TEXT NOT NULL,
  use_ssl BOOLEAN DEFAULT true,
  
  -- Import settings
  is_active BOOLEAN DEFAULT true,
  auto_create_batch BOOLEAN DEFAULT true,
  batch_name_template TEXT DEFAULT 'Email Import {date}',
  delete_after_import BOOLEAN DEFAULT false,
  mark_as_read BOOLEAN DEFAULT true,
  
  -- Status
  last_check_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT
);

-- Create email import logs table
CREATE TABLE IF NOT EXISTS public.email_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.email_import_configs(id) ON DELETE SET NULL,
  email_subject TEXT NOT NULL,
  email_from TEXT NOT NULL,
  email_date TIMESTAMP WITH TIME ZONE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.email_import_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_import_configs
CREATE POLICY "System admins can manage all email configs"
  ON public.email_import_configs
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their email configs"
  ON public.email_import_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = email_import_configs.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = email_import_configs.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

CREATE POLICY "Users can view email configs for their projects"
  ON public.email_import_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = email_import_configs.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

-- RLS Policies for email_import_logs
CREATE POLICY "System admins can view all email logs"
  ON public.email_import_logs
  FOR SELECT
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their email logs"
  ON public.email_import_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_import_configs c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = email_import_logs.config_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

-- Create indexes
CREATE INDEX idx_email_import_configs_project ON public.email_import_configs(project_id);
CREATE INDEX idx_email_import_configs_active ON public.email_import_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_email_import_logs_config ON public.email_import_logs(config_id);
CREATE INDEX idx_email_import_logs_status ON public.email_import_logs(status);

-- Create trigger for updated_at
CREATE TRIGGER update_email_import_configs_updated_at
  BEFORE UPDATE ON public.email_import_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();