-- Fix 1: Make tos_versions require authentication
DROP POLICY IF EXISTS "Anyone can view ToS versions" ON public.tos_versions;

CREATE POLICY "Authenticated users can view ToS versions"
ON public.tos_versions
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Make documents bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';