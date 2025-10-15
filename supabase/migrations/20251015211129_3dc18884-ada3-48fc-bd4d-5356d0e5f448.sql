-- Create storage bucket for documents (images and files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true);

-- RLS policies for documents bucket
CREATE POLICY "Users can view documents in their customer projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE d.file_url = storage.objects.name
      AND (
        d.uploaded_by = auth.uid() OR
        p.customer_id IS NULL OR
        has_customer(auth.uid(), p.customer_id)
      )
    )
  )
);

CREATE POLICY "Users can upload documents to their customer projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.file_url = storage.objects.name
      AND d.uploaded_by = auth.uid()
    )
  )
);

CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add redacted_file_url column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS redacted_file_url text,
ADD COLUMN IF NOT EXISTS redaction_metadata jsonb DEFAULT '{}'::jsonb;