-- Add AB 1466 compliance configuration to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS enable_ab1466_redaction boolean DEFAULT false;

-- Add AB 1466 specific columns to documents for tracking
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS ab1466_violations_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ab1466_violation_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ab1466_redaction_applied boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ab1466_detected_terms jsonb DEFAULT null;

-- Create index for AB 1466 violation tracking
CREATE INDEX IF NOT EXISTS idx_documents_ab1466_violations ON public.documents (ab1466_violations_detected) WHERE ab1466_violations_detected = true;

COMMENT ON COLUMN public.projects.enable_ab1466_redaction IS 'Enable automatic redaction of restrictive covenant language per California AB 1466';
COMMENT ON COLUMN public.documents.ab1466_violations_detected IS 'Whether restrictive covenant language was detected in this document';
COMMENT ON COLUMN public.documents.ab1466_violation_count IS 'Number of AB 1466 violations detected';
COMMENT ON COLUMN public.documents.ab1466_redaction_applied IS 'Whether automatic AB 1466 redaction was applied to this document';
COMMENT ON COLUMN public.documents.ab1466_detected_terms IS 'Array of detected restrictive covenant terms with locations';