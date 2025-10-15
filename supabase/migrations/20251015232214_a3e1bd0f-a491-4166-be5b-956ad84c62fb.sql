-- Make documents bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'documents';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;

-- Create storage RLS policies for document access
-- Users can view their own uploaded documents
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT uploaded_by FROM public.documents 
    WHERE file_url LIKE '%' || name OR redacted_file_url LIKE '%' || name
  )
);

-- Users can upload documents
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT uploaded_by FROM public.documents 
    WHERE file_url LIKE '%' || name OR redacted_file_url LIKE '%' || name
  )
);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT uploaded_by FROM public.documents 
    WHERE file_url LIKE '%' || name OR redacted_file_url LIKE '%' || name
  )
);

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents' AND
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);