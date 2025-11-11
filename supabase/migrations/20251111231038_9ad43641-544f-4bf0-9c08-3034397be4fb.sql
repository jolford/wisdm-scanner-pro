-- Add webhook_type column to webhook_configs table
ALTER TABLE public.webhook_configs 
ADD COLUMN IF NOT EXISTS webhook_type TEXT DEFAULT 'generic' CHECK (webhook_type IN ('generic', 'teams', 'slack'));

-- Add comment
COMMENT ON COLUMN public.webhook_configs.webhook_type IS 'Type of webhook: generic, teams, or slack';

-- Update existing webhooks to be generic
UPDATE public.webhook_configs SET webhook_type = 'generic' WHERE webhook_type IS NULL;