-- Fix search path for delete_expired_cache function
CREATE OR REPLACE FUNCTION delete_expired_cache()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.document_cache WHERE expires_at < now();
END;
$$;