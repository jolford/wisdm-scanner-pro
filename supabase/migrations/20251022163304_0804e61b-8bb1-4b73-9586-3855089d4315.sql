-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Rate limit error inserts" ON public.error_logs;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

-- Create simple insert policy for authenticated and anonymous users
CREATE POLICY "Allow error log inserts"
ON public.error_logs
FOR INSERT
TO public
WITH CHECK (true);

-- Keep admin view policies
-- System admins and tenant admins can already view via existing SELECT policies