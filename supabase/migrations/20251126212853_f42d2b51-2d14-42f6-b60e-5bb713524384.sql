-- Add export_started_at timestamp to batches table
ALTER TABLE public.batches 
ADD COLUMN IF NOT EXISTS export_started_at timestamp with time zone;

-- Add index for efficient timeout queries
CREATE INDEX IF NOT EXISTS idx_batches_export_started_at 
ON public.batches(export_started_at) 
WHERE export_started_at IS NOT NULL;