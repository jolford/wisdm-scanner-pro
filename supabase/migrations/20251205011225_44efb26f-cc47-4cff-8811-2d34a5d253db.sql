-- Drop the public policy that exposes release notes to anyone
DROP POLICY IF EXISTS "Anyone can view published release notes" ON public.release_notes;

-- Create new policy requiring authentication to view release notes
CREATE POLICY "Authenticated users can view published release notes"
ON public.release_notes
FOR SELECT
TO authenticated
USING (status = 'published');