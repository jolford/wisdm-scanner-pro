-- Document Version History Table
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- Snapshot of document state
  file_url TEXT,
  file_name TEXT,
  extracted_metadata JSONB DEFAULT '{}'::jsonb,
  extracted_text TEXT,
  validation_status TEXT,
  confidence_score NUMERIC,
  field_confidence JSONB,
  line_items JSONB,
  word_bounding_boxes JSONB,
  classification_metadata JSONB,
  
  -- Change tracking
  change_type TEXT NOT NULL, -- 'field_change', 'status_change', 'file_replacement', 'metadata_update'
  change_summary TEXT,
  changed_fields JSONB DEFAULT '{}'::jsonb, -- Which specific fields changed
  
  -- Audit info
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(document_id, version_number)
);

-- Index for fast version lookups
CREATE INDEX idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX idx_document_versions_changed_at ON public.document_versions(changed_at DESC);

-- Function to create document version snapshot
CREATE OR REPLACE FUNCTION create_document_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  _version_number INTEGER;
  _change_type TEXT;
  _changed_fields JSONB := '{}'::jsonb;
BEGIN
  -- Determine version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO _version_number
  FROM public.document_versions
  WHERE document_id = NEW.id;
  
  -- Determine change type
  IF OLD.file_url IS DISTINCT FROM NEW.file_url THEN
    _change_type := 'file_replacement';
  ELSIF OLD.validation_status IS DISTINCT FROM NEW.validation_status THEN
    _change_type := 'status_change';
  ELSIF OLD.extracted_metadata IS DISTINCT FROM NEW.extracted_metadata THEN
    _change_type := 'field_change';
    _changed_fields := jsonb_build_object(
      'old', OLD.extracted_metadata,
      'new', NEW.extracted_metadata
    );
  ELSE
    _change_type := 'metadata_update';
  END IF;
  
  -- Create version snapshot
  INSERT INTO public.document_versions (
    document_id,
    version_number,
    file_url,
    file_name,
    extracted_metadata,
    extracted_text,
    validation_status,
    confidence_score,
    field_confidence,
    line_items,
    word_bounding_boxes,
    classification_metadata,
    change_type,
    changed_fields,
    changed_by
  ) VALUES (
    NEW.id,
    _version_number,
    OLD.file_url,
    OLD.file_name,
    OLD.extracted_metadata,
    OLD.extracted_text,
    OLD.validation_status::text,
    OLD.confidence_score,
    OLD.field_confidence,
    OLD.line_items,
    OLD.word_bounding_boxes,
    OLD.classification_metadata,
    _change_type,
    _changed_fields,
    auth.uid()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically create versions on document updates
CREATE TRIGGER document_version_tracking
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  WHEN (
    OLD.file_url IS DISTINCT FROM NEW.file_url OR
    OLD.extracted_metadata IS DISTINCT FROM NEW.extracted_metadata OR
    OLD.validation_status IS DISTINCT FROM NEW.validation_status OR
    OLD.extracted_text IS DISTINCT FROM NEW.extracted_text
  )
  EXECUTE FUNCTION create_document_version_snapshot();

-- Full-Text Search Support
-- Add tsvector columns for efficient full-text search
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON public.documents USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.file_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.extracted_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.extracted_metadata::text, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.validation_notes, '')), 'D');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically update search vector
CREATE TRIGGER document_search_vector_update
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_search_vector();

-- Update existing documents with search vectors
UPDATE public.documents
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(file_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(extracted_text, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(extracted_metadata::text, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(validation_notes, '')), 'D')
WHERE search_vector IS NULL;

-- RLS Policies for document_versions
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their documents"
  ON public.document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = document_versions.document_id
      AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()))
    )
  );

CREATE POLICY "System can manage document versions"
  ON public.document_versions
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Enhance batch_auto_rules with more trigger types
ALTER TABLE public.batch_auto_rules 
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'document_type',
  ADD COLUMN IF NOT EXISTS trigger_schedule TEXT; -- For time-based rules (cron format)

COMMENT ON COLUMN public.batch_auto_rules.trigger_type IS 'Type of trigger: document_type, project_selection, file_pattern, time_based';
COMMENT ON COLUMN public.batch_auto_rules.trigger_schedule IS 'Cron schedule for time-based rules (e.g., 0 9 * * 1-5 for weekdays at 9am)';