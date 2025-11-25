-- Make documents storage bucket public so public URLs work for the viewer
UPDATE storage.buckets
SET public = true
WHERE id = 'documents';