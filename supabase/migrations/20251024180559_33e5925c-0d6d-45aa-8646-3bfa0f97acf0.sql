-- Create admin-only RPC for privileged operations
-- Example: Bulk batch operations that bypass normal RLS

CREATE OR REPLACE FUNCTION public.admin_bulk_delete_batches(batch_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  result jsonb;
BEGIN
  -- First check: is the caller an admin?
  IF NOT (is_admin_enhanced() OR is_system_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin access required' USING ERRCODE = '42501';
  END IF;

  -- Perform the privileged operation
  DELETE FROM public.batches
  WHERE id = ANY(batch_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'requested_count', array_length(batch_ids, 1)
  );
  
  RETURN result;
END;
$$;

-- Grant execute to authenticated users (function itself checks admin)
GRANT EXECUTE ON FUNCTION public.admin_bulk_delete_batches(uuid[]) TO authenticated;

-- Create admin-only RPC for user management
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  target_user_id uuid,
  new_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Admin check
  IF NOT (is_admin_enhanced() OR is_system_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin access required' USING ERRCODE = '42501';
  END IF;
  
  -- Prevent elevation to system_admin unless caller is system_admin
  IF new_role = 'system_admin'::app_role AND NOT is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: only system admins can assign system_admin role' USING ERRCODE = '42501';
  END IF;

  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  result := jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'role', new_role
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, app_role) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_delete_batches IS 'Admin-only function for bulk batch deletion with built-in permission check';
COMMENT ON FUNCTION public.admin_assign_role IS 'Admin-only function for role assignment with privilege escalation protection';