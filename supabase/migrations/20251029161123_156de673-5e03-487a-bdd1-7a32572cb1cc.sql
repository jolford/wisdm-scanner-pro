-- Add signature verification flag to projects
ALTER TABLE public.projects 
ADD COLUMN enable_signature_verification boolean DEFAULT false;

COMMENT ON COLUMN public.projects.enable_signature_verification IS 'Enable signature validation for documents in this project';