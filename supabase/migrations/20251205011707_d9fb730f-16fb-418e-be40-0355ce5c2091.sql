-- Drop the overly permissive INSERT policies on error_logs
DROP POLICY IF EXISTS "Allow error log inserts" ON public.error_logs;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

-- Create a secure policy that only allows authenticated users to insert their own error logs
CREATE POLICY "Authenticated users can insert their own error logs"
ON public.error_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);