-- Add word_bounding_boxes column to documents table for sensitive language highlighting
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS word_bounding_boxes jsonb DEFAULT '[]'::jsonb;