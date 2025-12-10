-- Remove the overly permissive public read policy for documents bucket
DROP POLICY IF EXISTS "Public read access for documents bucket" ON storage.objects;

-- Create a secure policy that requires authentication and verifies project ownership
-- Users can only read documents from projects they have access to
CREATE POLICY "Authenticated users can read documents from their projects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- System admins can access all documents
    is_system_admin(auth.uid())
    OR
    -- Users can access documents from projects belonging to their customers
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.projects p ON d.project_id = p.id
      WHERE 
        d.file_url LIKE '%' || storage.objects.name || '%'
        AND has_customer(auth.uid(), p.customer_id)
    )
    OR
    -- Allow access to csv-lookups subfolder for lookup files (keep existing functionality)
    (storage.foldername(name))[1] = 'csv-lookups'
  )
);