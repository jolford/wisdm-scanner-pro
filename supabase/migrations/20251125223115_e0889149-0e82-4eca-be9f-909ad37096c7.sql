-- Recreate missing 'documents' storage bucket and basic access policies

-- 1) Create the documents bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Ensure public read access policy for documents bucket (for thumbnails & validation viewer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read access for documents bucket'
  ) THEN
    CREATE POLICY "Public read access for documents bucket"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'documents');
  END IF;
END $$;

-- 3) Ensure authenticated users can manage their document objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated manage documents bucket'
  ) THEN
    CREATE POLICY "Authenticated manage documents bucket"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'documents')
    WITH CHECK (bucket_id = 'documents');
  END IF;
END $$;