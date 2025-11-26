-- Add project option to display fields above document viewer
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS display_fields_above BOOLEAN NOT NULL DEFAULT false;