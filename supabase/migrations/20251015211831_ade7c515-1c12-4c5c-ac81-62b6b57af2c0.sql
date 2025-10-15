-- Create user_permissions table for granular access control
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_scan BOOLEAN DEFAULT true,
  can_validate BOOLEAN DEFAULT true,
  can_export BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to check user permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _permissions record;
BEGIN
  -- Admins have all permissions
  IF has_role(_user_id, 'admin'::app_role) THEN
    RETURN true;
  END IF;

  -- Get user permissions
  SELECT * INTO _permissions
  FROM public.user_permissions
  WHERE user_id = _user_id;

  -- If no permissions record, return true (default allow)
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Check specific permission
  CASE _permission
    WHEN 'can_scan' THEN
      RETURN _permissions.can_scan;
    WHEN 'can_validate' THEN
      RETURN _permissions.can_validate;
    WHEN 'can_export' THEN
      RETURN _permissions.can_export;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);