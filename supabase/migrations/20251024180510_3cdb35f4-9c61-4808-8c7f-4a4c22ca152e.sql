-- 1) Helper to read JWT claims safely from the request
CREATE OR REPLACE FUNCTION public.jwt_claim(path text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb #>> string_to_array(path, '.')), 
    ''
  );
$$;

-- 2) Check if current user is admin via JWT app_metadata
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jwt_claim('app_metadata.role') = 'admin' 
    OR jwt_claim('app_metadata.role') = 'system_admin';
$$;

-- 3) Enhanced is_admin check combining JWT and database roles
CREATE OR REPLACE FUNCTION public.is_admin_enhanced()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin_jwt() 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'system_admin'::app_role);
$$;

COMMENT ON FUNCTION public.jwt_claim IS 'Safely extracts JWT claims from request context';
COMMENT ON FUNCTION public.is_admin_jwt IS 'Checks if user has admin role in JWT app_metadata';
COMMENT ON FUNCTION public.is_admin_enhanced IS 'Combined JWT and database admin check for backwards compatibility';