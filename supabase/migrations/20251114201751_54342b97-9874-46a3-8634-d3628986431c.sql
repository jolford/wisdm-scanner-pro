
-- Create a public storage bucket for white-label branding assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'white-label',
  'white-label',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
);

-- Create RLS policies for white-label bucket
CREATE POLICY "Public can view white-label assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'white-label');

CREATE POLICY "Admins can upload white-label assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'white-label' 
  AND (
    is_system_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
);

CREATE POLICY "Admins can update white-label assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'white-label' 
  AND (
    is_system_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
);

CREATE POLICY "Admins can delete white-label assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'white-label' 
  AND (
    is_system_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
);
