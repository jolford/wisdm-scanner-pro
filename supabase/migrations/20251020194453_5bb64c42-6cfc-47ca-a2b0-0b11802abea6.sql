-- Fix search_path for generate_license_key function
ALTER FUNCTION public.generate_license_key()
SET search_path = public;

-- Add rate limiting policy for error_logs to prevent abuse
CREATE POLICY "Rate limit error inserts"
ON public.error_logs FOR INSERT
WITH CHECK (
  -- Max 10 errors per user per minute (or unauthenticated)
  (
    SELECT COUNT(*) 
    FROM public.error_logs 
    WHERE (user_id = auth.uid() OR (user_id IS NULL AND auth.uid() IS NULL))
    AND created_at > NOW() - INTERVAL '1 minute'
  ) < 10
);