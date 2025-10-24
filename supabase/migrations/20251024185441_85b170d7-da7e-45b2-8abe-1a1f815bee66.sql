-- Update get_project_safe to return all project fields
DROP FUNCTION IF EXISTS public.get_project_safe(uuid);

CREATE OR REPLACE FUNCTION public.get_project_safe(project_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  customer_id UUID,
  extraction_fields JSONB,
  queues JSONB,
  metadata JSONB,
  enable_check_scanning BOOLEAN,
  export_types TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  is_active BOOLEAN
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
    SELECT 
      p.id, 
      p.name, 
      p.description,
      p.customer_id, 
      p.extraction_fields,
      p.queues,
      p.metadata, 
      p.enable_check_scanning,
      p.export_types,
      p.created_at, 
      p.updated_at,
      p.created_by,
      p.is_active
    FROM public.projects p
    WHERE p.id = project_id
    AND (has_customer(auth.uid(), p.customer_id) OR is_system_admin(auth.uid()));
  ELSE
    -- For regular users, mask sensitive credential fields in metadata
    RETURN QUERY
    SELECT 
      p.id, 
      p.name, 
      p.description,
      p.customer_id,
      p.extraction_fields,
      p.queues,
      -- Remove credentials from export_config in metadata
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
      p.enable_check_scanning,
      p.export_types,
      p.created_at,
      p.updated_at,
      p.created_by,
      p.is_active
    FROM public.projects p
    WHERE p.id = project_id
    AND has_customer(auth.uid(), p.customer_id);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_project_safe IS 'Safely retrieve complete project data with credential masking. System admins and tenant admins see full credentials, regular users see masked export_config.';