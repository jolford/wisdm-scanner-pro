-- Add line_items column to documents table for storing extracted table data
ALTER TABLE public.documents
ADD COLUMN line_items JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.documents.line_items IS 'Array of line item objects extracted from invoice/receipt tables. Each item contains fields defined in project table extraction config.';

-- Add index for querying line items
CREATE INDEX idx_documents_line_items ON public.documents USING GIN (line_items);