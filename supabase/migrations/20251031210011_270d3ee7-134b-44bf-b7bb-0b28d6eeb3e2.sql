-- Make csv-lookups folder in documents bucket publicly readable
CREATE POLICY "Public read access for csv-lookups"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'csv-lookups'
);