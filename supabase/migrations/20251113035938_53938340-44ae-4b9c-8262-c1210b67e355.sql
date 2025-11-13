-- Add PII detection toggle to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS detect_pii BOOLEAN DEFAULT false;

COMMENT ON COLUMN projects.detect_pii IS 'Enable automatic PII (personally identifiable information) detection and redaction for this project';

-- Update existing projects to have PII detection disabled by default
UPDATE projects SET detect_pii = false WHERE detect_pii IS NULL;