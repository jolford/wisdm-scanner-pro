-- Create enum for batch status
CREATE TYPE public.batch_status AS ENUM ('new', 'scanning', 'indexing', 'validation', 'complete', 'exported', 'error');

-- Create enum for document class types
CREATE TYPE public.document_class_type AS ENUM ('invoice', 'receipt', 'form', 'contract', 'id_card', 'check', 'other');

-- Create enum for validation status
CREATE TYPE public.validation_status AS ENUM ('pending', 'validated', 'rejected', 'needs_review');

-- Create document_classes table (templates)
CREATE TABLE public.document_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_type document_class_type NOT NULL DEFAULT 'other',
  description TEXT,
  extraction_zones JSONB DEFAULT '[]'::jsonb,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  barcode_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create batches table
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  status batch_status DEFAULT 'new',
  priority INTEGER DEFAULT 0,
  total_documents INTEGER DEFAULT 0,
  processed_documents INTEGER DEFAULT 0,
  validated_documents INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Update documents table to support batch processing
ALTER TABLE public.documents 
  ADD COLUMN batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN document_class_id UUID REFERENCES public.document_classes(id) ON DELETE SET NULL,
  ADD COLUMN validation_status validation_status DEFAULT 'pending',
  ADD COLUMN validated_by UUID REFERENCES auth.users(id),
  ADD COLUMN validated_at TIMESTAMPTZ,
  ADD COLUMN page_number INTEGER DEFAULT 1,
  ADD COLUMN confidence_score NUMERIC(5,2),
  ADD COLUMN needs_review BOOLEAN DEFAULT false,
  ADD COLUMN validation_notes TEXT;

-- Create indexes for performance
CREATE INDEX idx_batches_project_id ON public.batches(project_id);
CREATE INDEX idx_batches_status ON public.batches(status);
CREATE INDEX idx_batches_created_by ON public.batches(created_by);
CREATE INDEX idx_document_classes_project_id ON public.document_classes(project_id);
CREATE INDEX idx_documents_batch_id ON public.documents(batch_id);
CREATE INDEX idx_documents_validation_status ON public.documents(validation_status);
CREATE INDEX idx_documents_document_class_id ON public.documents(document_class_id);

-- Add triggers for updated_at
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_classes_updated_at
  BEFORE UPDATE ON public.document_classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for batches
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batches in their projects"
  ON public.batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = batches.project_id AND is_active = true
    )
  );

CREATE POLICY "Users can create batches"
  ON public.batches FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their batches"
  ON public.batches FOR UPDATE
  USING (created_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Admins can manage all batches"
  ON public.batches FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for document_classes
ALTER TABLE public.document_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document classes"
  ON public.document_classes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage document classes"
  ON public.document_classes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));