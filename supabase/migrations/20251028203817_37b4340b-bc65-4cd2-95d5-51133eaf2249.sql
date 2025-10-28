-- Batch Templates for reusable configurations
CREATE TABLE public.batch_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  extraction_config JSONB, -- Field mappings, OCR settings
  validation_rules JSONB, -- Validation lookup tables, confidence thresholds
  export_settings JSONB, -- Default export configuration
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auto-routing rules for smart document assignment
CREATE TABLE public.batch_auto_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.batch_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0, -- Higher priority rules evaluated first
  conditions JSONB NOT NULL, -- { "document_type": "invoice", "keywords": ["urgent"], "metadata": {...} }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document processing cache for performance
CREATE TABLE public.document_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL UNIQUE,
  cached_data JSONB NOT NULL, -- Extracted text, metadata, thumbnails
  signed_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Field confidence tracking for smart validation
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS field_confidence JSONB, -- { "fieldName": 0.95, "otherField": 0.87 }
ADD COLUMN IF NOT EXISTS validation_suggestions JSONB, -- AI-generated suggestions
ADD COLUMN IF NOT EXISTS processing_priority INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.batch_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_auto_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batch_templates
CREATE POLICY "Users can view templates in their customer"
  ON public.batch_templates FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

CREATE POLICY "System admins can manage all templates"
  ON public.batch_templates FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage templates"
  ON public.batch_templates FOR ALL
  USING (is_tenant_admin(auth.uid(), customer_id))
  WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

-- RLS Policies for batch_auto_rules
CREATE POLICY "Users can view auto rules in their customer"
  ON public.batch_auto_rules FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

CREATE POLICY "System admins can manage all auto rules"
  ON public.batch_auto_rules FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage auto rules"
  ON public.batch_auto_rules FOR ALL
  USING (is_tenant_admin(auth.uid(), customer_id))
  WITH CHECK (is_tenant_admin(auth.uid(), customer_id));

-- RLS Policies for document_cache
CREATE POLICY "Users can access cache for their documents"
  ON public.document_cache FOR SELECT
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE has_customer(auth.uid(), p.customer_id)
    )
  );

CREATE POLICY "System can manage cache"
  ON public.document_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_batch_templates_customer ON public.batch_templates(customer_id);
CREATE INDEX idx_batch_templates_active ON public.batch_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_batch_auto_rules_template ON public.batch_auto_rules(template_id);
CREATE INDEX idx_batch_auto_rules_priority ON public.batch_auto_rules(priority DESC);
CREATE INDEX idx_document_cache_document ON public.document_cache(document_id);
CREATE INDEX idx_document_cache_key ON public.document_cache(cache_key);
CREATE INDEX idx_document_cache_expires ON public.document_cache(expires_at);
CREATE INDEX idx_documents_priority ON public.documents(processing_priority DESC);

-- Function to auto-delete expired cache entries
CREATE OR REPLACE FUNCTION delete_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.document_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE TRIGGER update_batch_templates_updated_at
  BEFORE UPDATE ON public.batch_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batch_auto_rules_updated_at
  BEFORE UPDATE ON public.batch_auto_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();