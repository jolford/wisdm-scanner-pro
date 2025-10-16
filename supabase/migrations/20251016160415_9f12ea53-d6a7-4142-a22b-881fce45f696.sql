-- Add check scanning mode to projects table
ALTER TABLE public.projects
ADD COLUMN enable_check_scanning boolean DEFAULT false;

COMMENT ON COLUMN public.projects.enable_check_scanning IS 'Enables dedicated MICR/check scanning mode with check-specific extraction fields';