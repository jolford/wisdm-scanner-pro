-- Add export types and queues configuration to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS export_types TEXT[] DEFAULT ARRAY['csv', 'json', 'xml', 'txt', 'pdf', 'images'],
ADD COLUMN IF NOT EXISTS queues JSONB DEFAULT '[{"name": "Scan", "enabled": true}, {"name": "Validation", "enabled": true}, {"name": "Validated", "enabled": true}, {"name": "Export", "enabled": true}]'::jsonb;

-- Add comment to explain the columns
COMMENT ON COLUMN public.projects.export_types IS 'Array of allowed export formats: csv, json, xml, txt, pdf, images';
COMMENT ON COLUMN public.projects.queues IS 'Configuration of available queues for the project';