-- Add signature reference storage to voter registry
ALTER TABLE public.voter_registry 
ADD COLUMN signature_reference_url text,
ADD COLUMN signature_reference_uploaded_at timestamp with time zone;

-- Add signature similarity tracking to documents
ALTER TABLE public.documents 
ADD COLUMN signature_similarity_score numeric,
ADD COLUMN signature_authentication_status text;

-- Create index for efficient signature lookup
CREATE INDEX idx_voter_registry_signature ON public.voter_registry(name_normalized) WHERE signature_reference_url IS NOT NULL;

COMMENT ON COLUMN public.voter_registry.signature_reference_url IS 'URL to reference signature image for comparison';
COMMENT ON COLUMN public.documents.signature_similarity_score IS 'AI-calculated similarity between petition and reference signature (0-100)';
COMMENT ON COLUMN public.documents.signature_authentication_status IS 'authenticated, suspicious, no_reference, failed';