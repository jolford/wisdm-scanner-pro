-- Create enum for license tiers
CREATE TYPE public.license_tier AS ENUM ('starter', 'professional', 'business', 'enterprise');

-- Add plan_type column to licenses table
ALTER TABLE public.licenses 
ADD COLUMN plan_type public.license_tier NOT NULL DEFAULT 'starter';

-- Add comment for documentation
COMMENT ON COLUMN public.licenses.plan_type IS 'License tier: starter, professional, business, or enterprise based on pricing guide';