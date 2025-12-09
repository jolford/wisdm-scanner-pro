-- Script Agents table - tracks installed agents per customer
CREATE TABLE public.script_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  machine_name TEXT,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  last_ip_address TEXT,
  supported_languages TEXT[] DEFAULT ARRAY['powershell', 'python', 'vbscript', 'batch'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Script Jobs table - queue of pending script executions
CREATE TABLE public.script_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.script_agents(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  
  -- Script details
  script_name TEXT NOT NULL,
  script_language TEXT NOT NULL CHECK (script_language IN ('powershell', 'python', 'vbscript', 'batch', 'javascript')),
  script_content TEXT NOT NULL,
  script_parameters JSONB DEFAULT '{}',
  
  -- Trigger info
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('workflow', 'scheduled', 'manual', 'document_event')),
  trigger_event TEXT,
  
  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,
  assigned_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  result_data JSONB,
  error_message TEXT,
  
  -- Metadata
  timeout_seconds INTEGER DEFAULT 300,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Script Templates - reusable script definitions
CREATE TABLE public.script_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  script_language TEXT NOT NULL CHECK (script_language IN ('powershell', 'python', 'vbscript', 'batch', 'javascript')),
  script_content TEXT NOT NULL,
  default_parameters JSONB DEFAULT '{}',
  
  -- Scheduling
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_cron TEXT,
  
  -- Trigger configuration
  trigger_on_document_upload BOOLEAN DEFAULT false,
  trigger_on_validation_complete BOOLEAN DEFAULT false,
  trigger_on_batch_export BOOLEAN DEFAULT false,
  trigger_on_batch_complete BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.script_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for script_agents (admin only)
CREATE POLICY "Admins can manage script agents" ON public.script_agents
  FOR ALL USING (
    is_admin_enhanced() 
    AND has_customer(auth.uid(), customer_id)
  );

-- RLS Policies for script_jobs
CREATE POLICY "Users can view script jobs in their customer" ON public.script_jobs
  FOR SELECT USING (has_customer(auth.uid(), customer_id));

CREATE POLICY "Admins can manage script jobs" ON public.script_jobs
  FOR ALL USING (
    is_admin_enhanced() 
    AND has_customer(auth.uid(), customer_id)
  );

-- RLS Policies for script_templates
CREATE POLICY "Users can view script templates in their customer" ON public.script_templates
  FOR SELECT USING (has_customer(auth.uid(), customer_id));

CREATE POLICY "Admins can manage script templates" ON public.script_templates
  FOR ALL USING (
    is_admin_enhanced() 
    AND has_customer(auth.uid(), customer_id)
  );

-- Indexes for performance
CREATE INDEX idx_script_jobs_status ON public.script_jobs(status);
CREATE INDEX idx_script_jobs_customer ON public.script_jobs(customer_id);
CREATE INDEX idx_script_jobs_agent ON public.script_jobs(agent_id);
CREATE INDEX idx_script_agents_customer ON public.script_agents(customer_id);
CREATE INDEX idx_script_templates_customer ON public.script_templates(customer_id);

-- Triggers for updated_at
CREATE TRIGGER update_script_agents_updated_at
  BEFORE UPDATE ON public.script_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_script_jobs_updated_at
  BEFORE UPDATE ON public.script_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_script_templates_updated_at
  BEFORE UPDATE ON public.script_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();