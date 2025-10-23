-- Create documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for documents bucket
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view their own documents'
  ) THEN
    CREATE POLICY "Users can view their own documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update their own documents'
  ) THEN
    CREATE POLICY "Users can update their own documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'documents')
    WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their own documents'
  ) THEN
    CREATE POLICY "Users can delete their own documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'documents');
  END IF;
END $$;