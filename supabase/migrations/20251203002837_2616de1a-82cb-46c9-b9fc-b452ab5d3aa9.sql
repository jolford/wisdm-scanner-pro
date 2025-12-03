-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view their documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to their projects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- Recreate secure RLS policies for documents bucket
-- SELECT policy - authenticated users can view documents in their customer's projects
CREATE POLICY "Authenticated users can view their documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_customers uc ON p.customer_id = uc.customer_id
    WHERE 
      p.id::text = split_part(storage.objects.name, '/', 1)
      AND uc.user_id = auth.uid()
  )
);

-- INSERT policy - authenticated users can upload to their customer's projects
CREATE POLICY "Authenticated users can upload to their projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_customers uc ON p.customer_id = uc.customer_id
    WHERE 
      p.id::text = split_part(name, '/', 1)
      AND uc.user_id = auth.uid()
  )
);

-- UPDATE policy - authenticated users can update documents in their projects
CREATE POLICY "Authenticated users can update their documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_customers uc ON p.customer_id = uc.customer_id
    WHERE 
      p.id::text = split_part(storage.objects.name, '/', 1)
      AND uc.user_id = auth.uid()
  )
);

-- DELETE policy - only admins can delete documents
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'system_admin')
  )
);
