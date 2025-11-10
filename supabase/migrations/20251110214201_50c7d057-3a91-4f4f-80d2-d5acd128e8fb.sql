-- Webhook configurations table
CREATE TABLE public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT, -- For signature verification
  is_active BOOLEAN NOT NULL DEFAULT true,
  events JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of event types
  headers JSONB DEFAULT '{}'::jsonb, -- Custom headers
  retry_config JSONB DEFAULT '{"max_retries": 3, "retry_delay_seconds": 60}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMPTZ
);

-- Webhook delivery logs
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID NOT NULL REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document exceptions table
CREATE TABLE public.document_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  exception_type TEXT NOT NULL, -- 'validation_failed', 'low_confidence', 'duplicate', 'fraud', etc.
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_review', 'resolved', 'ignored'
  assigned_to UUID,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_webhook_configs_customer ON public.webhook_configs(customer_id);
CREATE INDEX idx_webhook_configs_active ON public.webhook_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_webhook_logs_config ON public.webhook_logs(webhook_config_id);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_document_exceptions_document ON public.document_exceptions(document_id);
CREATE INDEX idx_document_exceptions_batch ON public.document_exceptions(batch_id);
CREATE INDEX idx_document_exceptions_status ON public.document_exceptions(status);
CREATE INDEX idx_document_exceptions_severity ON public.document_exceptions(severity);

-- Enable RLS
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_configs
CREATE POLICY "System admins can manage all webhook configs"
  ON public.webhook_configs FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their webhook configs"
  ON public.webhook_configs FOR ALL
  USING (is_tenant_admin(auth.uid(), customer_id))
  WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

CREATE POLICY "Users can view their customer webhook configs"
  ON public.webhook_configs FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

-- RLS Policies for webhook_logs
CREATE POLICY "System admins can view all webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.webhook_configs wc
    WHERE wc.id = webhook_logs.webhook_config_id
    AND is_tenant_admin(auth.uid(), wc.customer_id)
  ));

CREATE POLICY "System can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for document_exceptions
CREATE POLICY "System admins can manage all exceptions"
  ON public.document_exceptions FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their exceptions"
  ON public.document_exceptions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.projects p ON p.id = b.project_id
    WHERE b.id = document_exceptions.batch_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.projects p ON p.id = b.project_id
    WHERE b.id = document_exceptions.batch_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  ));

CREATE POLICY "Users can view exceptions for their documents"
  ON public.document_exceptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.batches b ON b.id = d.batch_id
    JOIN public.projects p ON p.id = b.project_id
    WHERE d.id = document_exceptions.document_id
    AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
  ));

CREATE POLICY "Users can update exception status"
  ON public.document_exceptions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.batches b ON b.id = d.batch_id
    JOIN public.projects p ON p.id = b.project_id
    WHERE d.id = document_exceptions.document_id
    AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
  ));

-- Triggers for updated_at
CREATE TRIGGER update_webhook_configs_updated_at
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_exceptions_updated_at
  BEFORE UPDATE ON public.document_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to trigger webhooks
CREATE OR REPLACE FUNCTION public.trigger_webhook(_customer_id UUID, _event_type TEXT, _payload JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call webhook sender edge function for each active webhook
  PERFORM net.http_post(
    url := 'https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/send-webhook',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'customer_id', _customer_id,
      'event_type', _event_type,
      'payload', _payload
    )
  );
END;
$$;