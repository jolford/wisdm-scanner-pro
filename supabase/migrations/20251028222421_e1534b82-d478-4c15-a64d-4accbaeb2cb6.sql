-- Document Locking Table
CREATE TABLE public.document_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  session_id TEXT NOT NULL,
  UNIQUE(document_id)
);

-- Document Comments Table
CREATE TABLE public.document_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  flag_for_review BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Field Change History Table (for detailed audit trail)
CREATE TABLE public.field_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT NOT NULL, -- 'update', 'create', 'delete'
  validation_status TEXT, -- status at time of change
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Validation Analytics Table
CREATE TABLE public.validation_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type TEXT,
  user_id UUID,
  validation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validation_hour INTEGER NOT NULL DEFAULT EXTRACT(HOUR FROM now()),
  documents_validated INTEGER DEFAULT 0,
  documents_rejected INTEGER DEFAULT 0,
  avg_time_seconds INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  field_errors JSONB DEFAULT '{}', -- Track which fields had errors
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_locks
CREATE POLICY "Users can view locks on their customer documents"
  ON public.document_locks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = document_locks.document_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can create locks on documents they can edit"
  ON public.document_locks FOR INSERT
  WITH CHECK (
    locked_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = document_locks.document_id
      AND d.uploaded_by = auth.uid()
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can delete their own locks"
  ON public.document_locks FOR DELETE
  USING (locked_by = auth.uid());

-- RLS Policies for document_comments
CREATE POLICY "Users can view comments on their customer documents"
  ON public.document_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = document_comments.document_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can create comments on their customer documents"
  ON public.document_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = document_comments.document_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.document_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can resolve any comments"
  ON public.document_comments FOR UPDATE
  USING (
    is_system_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = document_comments.document_id
      AND p.customer_id IS NOT NULL
      AND is_tenant_admin(auth.uid(), p.customer_id)
    )
  );

-- RLS Policies for field_changes
CREATE POLICY "Users can view field changes on their customer documents"
  ON public.field_changes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.batches b ON d.batch_id = b.id
      JOIN public.projects p ON b.project_id = p.id
      WHERE d.id = field_changes.document_id
      AND (p.customer_id IS NULL OR has_customer(auth.uid(), p.customer_id))
    )
  );

CREATE POLICY "System can insert field changes"
  ON public.field_changes FOR INSERT
  WITH CHECK (true);

-- RLS Policies for validation_analytics
CREATE POLICY "System admins can view all analytics"
  ON public.validation_analytics FOR SELECT
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Tenant admins can view their analytics"
  ON public.validation_analytics FOR SELECT
  USING (is_tenant_admin(auth.uid(), customer_id));

CREATE POLICY "Users can view their customer analytics"
  ON public.validation_analytics FOR SELECT
  USING (has_customer(auth.uid(), customer_id));

CREATE POLICY "System can insert analytics"
  ON public.validation_analytics FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_document_locks_document_id ON public.document_locks(document_id);
CREATE INDEX idx_document_locks_expires_at ON public.document_locks(expires_at);
CREATE INDEX idx_document_comments_document_id ON public.document_comments(document_id);
CREATE INDEX idx_document_comments_flag_for_review ON public.document_comments(flag_for_review) WHERE flag_for_review = true;
CREATE INDEX idx_field_changes_document_id ON public.field_changes(document_id);
CREATE INDEX idx_field_changes_user_id ON public.field_changes(user_id);
CREATE INDEX idx_field_changes_created_at ON public.field_changes(created_at);
CREATE INDEX idx_validation_analytics_customer_project ON public.validation_analytics(customer_id, project_id, validation_date);
CREATE INDEX idx_validation_analytics_date ON public.validation_analytics(validation_date);

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.document_locks WHERE expires_at < now();
END;
$$;

-- Function to track field changes (to be called from app)
CREATE OR REPLACE FUNCTION public.track_field_change(
  _document_id UUID,
  _field_name TEXT,
  _old_value TEXT,
  _new_value TEXT,
  _change_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _change_id UUID;
  _validation_status TEXT;
BEGIN
  -- Get current validation status
  SELECT validation_status INTO _validation_status
  FROM public.documents
  WHERE id = _document_id;

  -- Insert field change record
  INSERT INTO public.field_changes (
    document_id,
    user_id,
    field_name,
    old_value,
    new_value,
    change_type,
    validation_status
  )
  VALUES (
    _document_id,
    auth.uid(),
    _field_name,
    _old_value,
    _new_value,
    _change_type,
    _validation_status
  )
  RETURNING id INTO _change_id;

  RETURN _change_id;
END;
$$;

-- Trigger to update updated_at on document_comments
CREATE TRIGGER update_document_comments_updated_at
  BEFORE UPDATE ON public.document_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();