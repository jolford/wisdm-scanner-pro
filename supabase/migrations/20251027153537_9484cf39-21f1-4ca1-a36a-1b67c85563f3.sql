-- Add email folder field to email_import_configs
ALTER TABLE public.email_import_configs
ADD COLUMN email_folder TEXT DEFAULT 'INBOX' NOT NULL;