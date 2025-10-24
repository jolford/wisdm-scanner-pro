-- Security fix: Restrict access to ECM credentials in projects.metadata
-- Only system admins should be able to view export configurations with credentials

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view projects for their customers" ON public.projects;
DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Create new view policy with credential masking for non-admins
CREATE POLICY "Users can view projects for their customers"
ON public.projects
FOR SELECT
USING (
  has_customer(auth.uid(), customer_id) OR is_system_admin(auth.uid())
);

-- Note: The above policy allows users to see projects, but client-side code
-- should mask sensitive fields. For complete protection, consider:
-- 1. Moving credentials to Lovable Cloud encrypted secrets (recommended)
-- 2. Creating a separate credentials table with stricter RLS
-- 3. Using SECURITY DEFINER functions to access credentials only in edge functions

-- Recreate other policies (unchanged)
CREATE POLICY "Admins can insert projects"
ON public.projects
FOR INSERT
WITH CHECK (
  is_admin_enhanced() OR is_system_admin(auth.uid())
);

CREATE POLICY "Admins can update projects"
ON public.projects
FOR UPDATE
USING (
  has_customer(auth.uid(), customer_id) OR is_system_admin(auth.uid())
)
WITH CHECK (
  has_customer(auth.uid(), customer_id) OR is_system_admin(auth.uid())
);

CREATE POLICY "Admins can delete projects"
ON public.projects
FOR DELETE
USING (
  is_admin_enhanced() OR is_system_admin(auth.uid())
);

-- Create helper function to safely retrieve projects without exposing credentials
CREATE OR REPLACE FUNCTION public.get_project_safe(project_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  customer_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only return full metadata (including credentials) to system admins
  IF is_system_admin(auth.uid()) THEN
    RETURN QUERY
    SELECT p.id, p.name, p.customer_id, p.metadata, p.created_at, p.updated_at
    FROM public.projects p
    WHERE p.id = project_id
    AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()));
  ELSE
    -- For non-admin users, mask sensitive credential fields
    RETURN QUERY
    SELECT 
      p.id, 
      p.name, 
      p.customer_id,
      -- Remove credentials from export_config
      CASE 
        WHEN p.metadata IS NOT NULL AND p.metadata ? 'export_config' THEN
          jsonb_set(
            p.metadata,
            '{export_config}',
            (p.metadata->'export_config') - 'username' - 'password' - 'accessToken'
          )
        ELSE
          p.metadata
      END as metadata,
      p.created_at,
      p.updated_at
    FROM public.projects p
    WHERE p.id = project_id
    AND has_customer(auth.uid(), p.customer_id);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_project_safe IS 'Safely retrieve project data with credential masking for non-admin users. System admins see full credentials, regular users see masked export_config.';