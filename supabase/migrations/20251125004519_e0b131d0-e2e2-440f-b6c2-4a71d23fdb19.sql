-- Add workflow_edges column to workflows table
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS workflow_edges JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN workflows.workflow_edges IS 'Array of edge objects connecting workflow nodes in sequence. Each edge has id, source (node id), target (node id), and optional label.';