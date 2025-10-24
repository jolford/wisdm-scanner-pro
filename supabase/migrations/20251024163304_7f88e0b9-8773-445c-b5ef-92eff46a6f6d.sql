-- Add SQL, ACCESS, and Oracle to default export types for projects table
ALTER TABLE public.projects 
ALTER COLUMN export_types 
SET DEFAULT ARRAY['csv'::text, 'json'::text, 'xml'::text, 'txt'::text, 'pdf'::text, 'images'::text, 'sql'::text, 'access'::text, 'oracle'::text];