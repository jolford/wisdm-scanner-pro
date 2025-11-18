-- Phase 2: Add encrypted credential columns

-- Add encrypted columns for email import configs
ALTER TABLE public.email_import_configs 
ADD COLUMN IF NOT EXISTS email_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Add encrypted columns for webhook configs  
ALTER TABLE public.webhook_configs
ADD COLUMN IF NOT EXISTS secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Create function to migrate plaintext to encrypted (run once manually)
CREATE OR REPLACE FUNCTION migrate_to_encrypted_credentials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- This function is a placeholder for manual migration
  -- The actual encryption must be done by calling the edge function
  -- which has access to the ENCRYPTION_KEY
  RAISE NOTICE 'Migration must be performed via edge function with encryption key access';
END;
$$;

COMMENT ON FUNCTION migrate_to_encrypted_credentials() IS 
'Placeholder for credential migration - actual migration done via edge function';

COMMENT ON COLUMN public.email_import_configs.email_password_encrypted IS 
'AES-256-GCM encrypted email password - replaces plaintext email_password';

COMMENT ON COLUMN public.webhook_configs.secret_encrypted IS 
'AES-256-GCM encrypted webhook secret - replaces plaintext secret';

COMMENT ON COLUMN public.email_import_configs.encryption_version IS 
'Encryption version for key rotation support';

COMMENT ON COLUMN public.webhook_configs.encryption_version IS 
'Encryption version for key rotation support';
