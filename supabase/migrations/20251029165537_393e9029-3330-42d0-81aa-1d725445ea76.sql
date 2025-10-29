-- Drop and recreate get_project_safe with enable_signature_verification field
DROP FUNCTION IF EXISTS public.get_project_safe(uuid);

CREATE OR REPLACE FUNCTION public.get_project_safe(project_id uuid)
 RETURNS TABLE(
   id uuid, 
   name text, 
   description text, 
   customer_id uuid, 
   extraction_fields jsonb, 
   queues jsonb, 
   metadata jsonb, 
   enable_check_scanning boolean,
   enable_signature_verification boolean,
   export_types text[], 
   created_at timestamp with time zone, 
   updated_at timestamp with time zone, 
   created_by uuid, 
   is_active boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      p.enable_signature_verification,
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
      p.enable_signature_verification,
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
$function$;