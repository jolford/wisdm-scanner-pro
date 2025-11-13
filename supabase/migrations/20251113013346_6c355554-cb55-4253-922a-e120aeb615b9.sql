-- Add index for faster lookups of documents with PII
CREATE INDEX IF NOT EXISTS idx_documents_pii_detected ON public.documents(pii_detected) WHERE pii_detected = true;

-- Create audit log table for tracking when users view unredacted originals (compliance)
CREATE TABLE IF NOT EXISTS public.redaction_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,
  CONSTRAINT fk_redaction_audit_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on audit log
ALTER TABLE public.redaction_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can see all audit logs
CREATE POLICY "Admins can view all redaction audit logs"
ON public.redaction_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'system_admin')
  )
);

-- Users can only see their own audit logs
CREATE POLICY "Users can view their own redaction audit logs"
ON public.redaction_audit_log
FOR SELECT
USING (user_id = auth.uid());

-- System can insert audit logs
CREATE POLICY "System can insert redaction audit logs"
ON public.redaction_audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add indexes for audit log queries
CREATE INDEX idx_redaction_audit_document ON public.redaction_audit_log(document_id);
CREATE INDEX idx_redaction_audit_user ON public.redaction_audit_log(user_id);
CREATE INDEX idx_redaction_audit_viewed_at ON public.redaction_audit_log(viewed_at DESC);

COMMENT ON TABLE public.redaction_audit_log IS 'Audit trail for when users view unredacted versions of documents containing PII';