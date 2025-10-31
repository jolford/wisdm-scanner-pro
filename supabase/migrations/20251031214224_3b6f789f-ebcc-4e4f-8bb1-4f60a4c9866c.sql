-- Duplicate Detection Tables for Petition Processing
CREATE TABLE IF NOT EXISTS public.duplicate_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  duplicate_type TEXT NOT NULL CHECK (duplicate_type IN ('name', 'address', 'signature', 'combined')),
  duplicate_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  similarity_score NUMERIC NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  duplicate_fields JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Address Validation Results
CREATE TABLE IF NOT EXISTS public.address_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  original_address JSONB NOT NULL,
  normalized_address JSONB,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'corrected', 'unverified')),
  validation_provider TEXT DEFAULT 'internal',
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  validation_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Signature Comparison Results (enhanced)
CREATE TABLE IF NOT EXISTS public.signature_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  reference_signature_id UUID REFERENCES public.signature_references(id) ON DELETE SET NULL,
  similarity_score NUMERIC NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('accept', 'review', 'reject')),
  comparison_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_document ON public.duplicate_detections(document_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_batch ON public.duplicate_detections(batch_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_status ON public.duplicate_detections(status);
CREATE INDEX IF NOT EXISTS idx_address_validations_document ON public.address_validations(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_comparisons_document ON public.signature_comparisons(document_id);

-- RLS Policies
ALTER TABLE public.duplicate_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_comparisons ENABLE ROW LEVEL SECURITY;

-- Duplicate detections policies
CREATE POLICY "Users can view duplicate detections for their documents"
  ON public.duplicate_detections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN batches b ON b.id = d.batch_id
      JOIN projects p ON p.id = b.project_id
      WHERE d.id = duplicate_detections.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can insert duplicate detections"
  ON public.duplicate_detections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update duplicate status"
  ON public.duplicate_detections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN batches b ON b.id = d.batch_id
      JOIN projects p ON p.id = b.project_id
      WHERE d.id = duplicate_detections.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

-- Address validation policies
CREATE POLICY "Users can view address validations for their documents"
  ON public.address_validations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN batches b ON b.id = d.batch_id
      JOIN projects p ON p.id = b.project_id
      WHERE d.id = address_validations.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can insert address validations"
  ON public.address_validations FOR INSERT
  WITH CHECK (true);

-- Signature comparison policies
CREATE POLICY "Users can view signature comparisons for their documents"
  ON public.signature_comparisons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN batches b ON b.id = d.batch_id
      JOIN projects p ON p.id = b.project_id
      WHERE d.id = signature_comparisons.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can insert signature comparisons"
  ON public.signature_comparisons FOR INSERT
  WITH CHECK (true);