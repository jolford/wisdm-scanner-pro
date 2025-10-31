-- Create fraud_detections table for Phase 2 fraud heuristics
CREATE TABLE IF NOT EXISTS public.fraud_detections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  fraud_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fraud_detections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view fraud detections for their documents"
  ON public.fraud_detections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON b.id = d.batch_id
      JOIN public.projects p ON p.id = b.project_id
      WHERE d.id = fraud_detections.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can create fraud detections"
  ON public.fraud_detections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update fraud detections for their documents"
  ON public.fraud_detections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON b.id = d.batch_id
      JOIN public.projects p ON p.id = b.project_id
      WHERE d.id = fraud_detections.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

-- Create index for performance
CREATE INDEX idx_fraud_detections_document_id ON public.fraud_detections(document_id);
CREATE INDEX idx_fraud_detections_batch_id ON public.fraud_detections(batch_id);
CREATE INDEX idx_fraud_detections_status ON public.fraud_detections(status);

-- Trigger for updated_at
CREATE TRIGGER update_fraud_detections_updated_at
  BEFORE UPDATE ON public.fraud_detections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();