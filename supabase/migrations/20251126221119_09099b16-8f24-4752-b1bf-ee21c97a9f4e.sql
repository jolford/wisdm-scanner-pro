-- Create custom_scripts table for storing customer scripts
CREATE TABLE IF NOT EXISTS public.custom_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  script_language TEXT NOT NULL CHECK (script_language IN ('javascript', 'typescript', 'python', 'powershell', 'vbscript')),
  script_code TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('workflow', 'manual', 'scheduled')),
  schedule_cron TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_custom_scripts_customer_id ON public.custom_scripts(customer_id);
CREATE INDEX idx_custom_scripts_project_id ON public.custom_scripts(project_id);
CREATE INDEX idx_custom_scripts_trigger_type ON public.custom_scripts(trigger_type);
CREATE INDEX idx_custom_scripts_active ON public.custom_scripts(is_active) WHERE is_active = true;

-- Create script_execution_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.script_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.custom_scripts(id) ON DELETE CASCADE,
  executed_by UUID,
  execution_context JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
  output TEXT,
  error_message TEXT,
  execution_duration_ms INTEGER,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for logs
CREATE INDEX idx_script_logs_script_id ON public.script_execution_logs(script_id);
CREATE INDEX idx_script_logs_executed_at ON public.script_execution_logs(executed_at DESC);

-- Enable RLS
ALTER TABLE public.custom_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_scripts
CREATE POLICY "Users can view scripts for their customer"
  ON public.custom_scripts FOR SELECT
  TO authenticated
  USING (
    has_customer(auth.uid(), customer_id) OR is_admin_enhanced()
  );

CREATE POLICY "Admins can manage all scripts"
  ON public.custom_scripts FOR ALL
  TO authenticated
  USING (is_admin_enhanced())
  WITH CHECK (is_admin_enhanced());

-- RLS policies for script_execution_logs
CREATE POLICY "Users can view logs for their customer scripts"
  ON public.script_execution_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_scripts
      WHERE custom_scripts.id = script_execution_logs.script_id
      AND (has_customer(auth.uid(), custom_scripts.customer_id) OR is_admin_enhanced())
    )
  );

CREATE POLICY "System can insert execution logs"
  ON public.script_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update trigger for updated_at
CREATE TRIGGER update_custom_scripts_updated_at
  BEFORE UPDATE ON public.custom_scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();