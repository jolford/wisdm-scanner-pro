-- Drop existing conflicting policies first
DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own uploaded documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents from accessible projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Create proper RLS policies for documents bucket
-- Policy: Users can view documents they uploaded
CREATE POLICY "Users can view own uploaded documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view documents from projects they have access to
CREATE POLICY "Users can view documents from accessible projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.projects p ON d.project_id = p.id
    JOIN public.user_customers uc ON p.customer_id = uc.customer_id
    WHERE d.file_url LIKE '%' || storage.objects.name
    AND uc.user_id = auth.uid()
  )
);

-- Policy: Users can upload documents to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'documents' 
  AND public.is_admin_enhanced()
)
WITH CHECK (
  bucket_id = 'documents' 
  AND public.is_admin_enhanced()
);