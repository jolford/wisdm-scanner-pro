-- Update default queues to rename "Validated" to "Quality Control"
ALTER TABLE public.projects 
ALTER COLUMN queues SET DEFAULT '[{"name": "Scan", "enabled": true}, {"name": "Validation", "enabled": true}, {"name": "Quality Control", "enabled": true}, {"name": "Export", "enabled": true}]'::jsonb;