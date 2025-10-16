-- Bootstrap first system admin from existing admin users
-- This allows the first system_admin to be created

DO $$
DECLARE
  first_admin_user_id uuid;
BEGIN
  -- Find the first user with 'admin' role
  SELECT user_id INTO first_admin_user_id
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1;
  
  -- If we found an admin, also give them system_admin role
  IF first_admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_admin_user_id, 'system_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Promoted user % to system_admin', first_admin_user_id;
  END IF;
END $$;