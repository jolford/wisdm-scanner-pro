-- Self-Learning System: Track field corrections for continuous improvement
CREATE TABLE IF NOT EXISTS public.field_learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT NOT NULL,
  confidence_score DECIMAL(5,4),
  document_type TEXT,
  correction_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Confidence Scoring: Store confidence metrics for each extraction
CREATE TABLE IF NOT EXISTS public.extraction_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  extracted_value TEXT,
  confidence_score DECIMAL(5,4) NOT NULL,
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ML Templates: Store trained models and patterns per document type
CREATE TABLE IF NOT EXISTS public.ml_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  field_patterns JSONB NOT NULL,
  training_data_count INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,4),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, template_name)
);

-- Smart Field Detection: Auto-detected field regions and types
CREATE TABLE IF NOT EXISTS public.detected_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  bounding_box JSONB,
  confidence DECIMAL(5,4),
  auto_detected BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_field_learning_project ON public.field_learning_data(project_id);
CREATE INDEX idx_field_learning_field ON public.field_learning_data(field_name);
CREATE INDEX idx_extraction_confidence_doc ON public.extraction_confidence(document_id);
CREATE INDEX idx_ml_templates_project ON public.ml_document_templates(project_id);
CREATE INDEX idx_detected_fields_doc ON public.detected_fields(document_id);

-- RLS Policies
ALTER TABLE public.field_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_fields ENABLE ROW LEVEL SECURITY;

-- field_learning_data policies
CREATE POLICY "Users can view learning data for their projects"
  ON public.field_learning_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = field_learning_data.project_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can insert learning data for their projects"
  ON public.field_learning_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = field_learning_data.project_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

-- extraction_confidence policies
CREATE POLICY "Users can view confidence scores for their documents"
  ON public.extraction_confidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON b.id = d.batch_id
      JOIN public.projects p ON p.id = b.project_id
      WHERE d.id = extraction_confidence.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can insert confidence scores"
  ON public.extraction_confidence FOR INSERT
  WITH CHECK (true);

-- ml_document_templates policies
CREATE POLICY "Users can view ML templates for their projects"
  ON public.ml_document_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ml_document_templates.project_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage ML templates"
  ON public.ml_document_templates FOR ALL
  USING (is_admin_enhanced() OR is_system_admin(auth.uid()));

-- detected_fields policies
CREATE POLICY "Users can view detected fields for their documents"
  ON public.detected_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON b.id = d.batch_id
      JOIN public.projects p ON p.id = b.project_id
      WHERE d.id = detected_fields.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can insert detected fields"
  ON public.detected_fields FOR INSERT
  WITH CHECK (true);

-- Function to update ML template accuracy
CREATE OR REPLACE FUNCTION public.update_ml_template_accuracy(
  _template_id UUID,
  _correct_predictions INTEGER,
  _total_predictions INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ml_document_templates
  SET 
    accuracy_rate = (_correct_predictions::DECIMAL / _total_predictions::DECIMAL),
    training_data_count = training_data_count + _total_predictions,
    updated_at = now()
  WHERE id = _template_id;
END;
$$;