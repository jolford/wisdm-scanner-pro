-- Add document classification support
-- Add document_type enum for classification
CREATE TYPE document_type AS ENUM (
  'check',
  'invoice', 
  'purchase_order',
  'receipt',
  'contract',
  'legal_document',
  'form',
  'letter',
  'other'
);

-- Add classification fields to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS document_type document_type,
ADD COLUMN IF NOT EXISTS classification_confidence numeric,
ADD COLUMN IF NOT EXISTS classification_metadata jsonb DEFAULT '{}'::jsonb;

-- Add classification config to projects
COMMENT ON COLUMN projects.metadata IS 'Project metadata including classification settings: {classification: {enabled: boolean, auto_classify: boolean, types: string[]}}';

-- Create index for fast filtering by document type
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type) WHERE document_type IS NOT NULL;