-- Add icon_url column to projects table
ALTER TABLE public.projects 
ADD COLUMN icon_url TEXT;

-- Create storage bucket for project icons
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-icons',
  'project-icons',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project icons
CREATE POLICY "Public can view project icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-icons');

CREATE POLICY "Authenticated users can upload project icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-icons' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update project icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-icons' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete project icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-icons' 
  AND auth.role() = 'authenticated'
);