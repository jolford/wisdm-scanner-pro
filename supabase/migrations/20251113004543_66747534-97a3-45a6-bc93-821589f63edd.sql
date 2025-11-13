-- Add PII detection fields to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS detected_pii_regions JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the fields
COMMENT ON COLUMN public.documents.pii_detected IS 'Flag indicating if PII (Personally Identifiable Information) was detected in the document';
COMMENT ON COLUMN public.documents.detected_pii_regions IS 'Array of detected PII regions with pattern type, matched text, and bounding boxes';

-- Create index for faster PII queries
CREATE INDEX IF NOT EXISTS idx_documents_pii_detected ON public.documents(pii_detected) WHERE pii_detected = TRUE;