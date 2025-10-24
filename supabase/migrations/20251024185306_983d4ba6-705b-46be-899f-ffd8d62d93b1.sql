-- Update get_project_safe to allow tenant admins to see their own ECM credentials
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
  -- Return full metadata (including credentials) to system admins and tenant admins
  IF is_system_admin(auth.uid()) OR 
     EXISTS (
       SELECT 1 FROM public.projects p 
       WHERE p.id = project_id 
       AND p.customer_id IS NOT NULL 
       AND is_tenant_admin(auth.uid(), p.customer_id)
     ) THEN
    RETURN QUERY
    SELECT p.id, p.name, p.customer_id, p.metadata, p.created_at, p.updated_at
    FROM public.projects p
    WHERE p.id = project_id
    AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()));
  ELSE
    -- For regular users, mask sensitive credential fields
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

COMMENT ON FUNCTION public.get_project_safe IS 'Safely retrieve project data with credential masking. System admins and tenant admins see full credentials, regular users see masked export_config.';