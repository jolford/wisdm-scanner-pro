-- Create validation_rules table for field-level validation
CREATE TABLE IF NOT EXISTS public.validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_class_id UUID REFERENCES public.document_classes(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('regex', 'range', 'required', 'custom', 'lookup', 'format')),
  rule_config JSONB NOT NULL DEFAULT '{}',
  error_message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.validation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for validation_rules
CREATE POLICY "System admins can manage all validation rules"
  ON public.validation_rules FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their validation rules"
  ON public.validation_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = validation_rules.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = validation_rules.project_id
    AND p.customer_id IS NOT NULL
    AND is_tenant_admin(auth.uid(), p.customer_id)
  ));

CREATE POLICY "Users can view validation rules for their projects"
  ON public.validation_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = validation_rules.project_id
    AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_validation_rules_updated_at
  BEFORE UPDATE ON public.validation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_validation_rules_project ON public.validation_rules(project_id);
CREATE INDEX idx_validation_rules_field ON public.validation_rules(field_name);
CREATE INDEX idx_validation_rules_active ON public.validation_rules(is_active) WHERE is_active = true;