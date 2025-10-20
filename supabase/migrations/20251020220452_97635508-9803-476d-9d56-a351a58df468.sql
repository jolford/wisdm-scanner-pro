-- Create table for tracking Terms of Service acceptances
CREATE TABLE public.tos_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tos_version TEXT NOT NULL,
  privacy_policy_version TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure one record per user per version
  UNIQUE(user_id, tos_version, privacy_policy_version)
);

-- Enable RLS
ALTER TABLE public.tos_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can view their own acceptances
CREATE POLICY "Users can view their own ToS acceptances"
  ON public.tos_acceptances
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert ToS acceptances during signup
CREATE POLICY "System can insert ToS acceptances"
  ON public.tos_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all acceptances for compliance
CREATE POLICY "Admins can view all ToS acceptances"
  ON public.tos_acceptances
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_tos_acceptances_user_id ON public.tos_acceptances(user_id);
CREATE INDEX idx_tos_acceptances_accepted_at ON public.tos_acceptances(accepted_at);

-- Create table for ToS versions
CREATE TABLE public.tos_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tos_version TEXT NOT NULL UNIQUE,
  privacy_policy_version TEXT NOT NULL,
  effective_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on versions table
ALTER TABLE public.tos_versions ENABLE ROW LEVEL SECURITY;

-- Everyone can view ToS versions
CREATE POLICY "Anyone can view ToS versions"
  ON public.tos_versions
  FOR SELECT
  USING (true);

-- Only admins can manage ToS versions
CREATE POLICY "Admins can manage ToS versions"
  ON public.tos_versions
  FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Create trigger to ensure only one current version
CREATE OR REPLACE FUNCTION public.ensure_one_current_tos_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_current = true THEN
    -- Set all other versions to not current
    UPDATE public.tos_versions
    SET is_current = false
    WHERE id != NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_one_current_tos_version
  BEFORE INSERT OR UPDATE ON public.tos_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_one_current_tos_version();

-- Insert the current version
INSERT INTO public.tos_versions (tos_version, privacy_policy_version, effective_date, is_current)
VALUES ('1.0', '1.0', CURRENT_DATE, true);

-- Add comments for documentation
COMMENT ON TABLE public.tos_acceptances IS 'Tracks user acceptance of Terms of Service and Privacy Policy for legal compliance';
COMMENT ON TABLE public.tos_versions IS 'Maintains version history of Terms of Service and Privacy Policy documents';