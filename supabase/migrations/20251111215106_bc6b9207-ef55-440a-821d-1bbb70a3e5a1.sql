-- Create fax import configurations table
CREATE TABLE public.fax_import_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  twilio_phone_number TEXT NOT NULL,
  auto_create_batch BOOLEAN DEFAULT true,
  batch_name_template TEXT DEFAULT 'Fax Import {date}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create fax import logs table
CREATE TABLE public.fax_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES public.fax_import_configs(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  twilio_sid TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  num_pages INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  media_url TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Add indexes
CREATE INDEX idx_fax_configs_project ON public.fax_import_configs(project_id);
CREATE INDEX idx_fax_configs_customer ON public.fax_import_configs(customer_id);
CREATE INDEX idx_fax_logs_config ON public.fax_logs(config_id);
CREATE INDEX idx_fax_logs_batch ON public.fax_logs(batch_id);
CREATE INDEX idx_fax_logs_twilio_sid ON public.fax_logs(twilio_sid);

-- RLS Policies for fax_import_configs
ALTER TABLE public.fax_import_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can manage all fax configs"
  ON public.fax_import_configs
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their fax configs"
  ON public.fax_import_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = fax_import_configs.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = fax_import_configs.project_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

CREATE POLICY "Users can view fax configs for their projects"
  ON public.fax_import_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = fax_import_configs.project_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

-- RLS Policies for fax_logs
ALTER TABLE public.fax_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view all fax logs"
  ON public.fax_logs
  FOR SELECT
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their fax logs"
  ON public.fax_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fax_import_configs c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = fax_logs.config_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

CREATE POLICY "System can insert fax logs"
  ON public.fax_logs
  FOR INSERT
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_fax_configs_updated_at
  BEFORE UPDATE ON public.fax_import_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();