-- Create release_notes table for managing version releases
CREATE TABLE IF NOT EXISTS public.release_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  version_name TEXT NOT NULL,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  is_latest BOOLEAN NOT NULL DEFAULT false,
  description TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]',
  features JSONB NOT NULL DEFAULT '[]',
  technical_info JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view published release notes"
  ON public.release_notes FOR SELECT
  USING (status = 'published');

CREATE POLICY "System admins can manage all release notes"
  ON public.release_notes FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_release_notes_updated_at
  BEFORE UPDATE ON public.release_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_release_notes_version ON public.release_notes(version);
CREATE INDEX idx_release_notes_status ON public.release_notes(status);
CREATE INDEX idx_release_notes_latest ON public.release_notes(is_latest) WHERE is_latest = true;
CREATE INDEX idx_release_notes_date ON public.release_notes(release_date DESC);

-- Insert existing release notes
INSERT INTO public.release_notes (version, version_name, release_date, is_latest, description, highlights, features, created_by) VALUES
(
  '2.2.0',
  'Phase 2: Automation & Advanced Validation',
  '2024-11-10',
  true,
  'Enhanced automation capabilities with intelligent duplicate detection, customizable validation rules, and scheduled batch processing',
  '[
    {"title": "Duplicate Detection", "description": "Intelligent similarity scoring with Jaro-Winkler and Levenshtein algorithms"},
    {"title": "Validation Rules", "description": "Custom field-level validation with regex, range, and lookup rules"},
    {"title": "Scheduled Processing", "description": "Automated batch processing on daily, weekly, or monthly schedules"}
  ]'::jsonb,
  '[
    {
      "section": "Duplicate Detection System",
      "items": [
        "Real-time duplicate detection across batches",
        "Similarity scoring with configurable thresholds (90%+ critical, 70%+ warning)",
        "Review dashboard with confirm/dismiss workflow",
        "Name similarity using Jaro-Winkler algorithm",
        "Address similarity using Levenshtein distance",
        "Matching field highlights and detailed comparison"
      ]
    },
    {
      "section": "Field-Level Validation Rules",
      "items": [
        "Custom validation rules per project and document type",
        "Multiple rule types: regex, range, required, lookup, format, custom",
        "Severity levels: error, warning, info",
        "Active/inactive rule toggling",
        "JSON-based rule configuration with visual editor",
        "Per-field custom error messages"
      ]
    },
    {
      "section": "Scheduled Batch Processing",
      "items": [
        "Automated batch processing at specific times",
        "Daily, weekly, and monthly scheduling options",
        "Project-based schedule configuration",
        "Last run tracking and next run calculation",
        "Export type selection per schedule",
        "Active/inactive schedule management"
      ]
    }
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
),
(
  '2.1.0',
  'Phase 1: Quality Assurance & Monitoring',
  '2024-11-05',
  false,
  'Comprehensive quality monitoring and alerting system for document processing workflows',
  '[
    {"title": "Webhook Notifications", "description": "Real-time HTTP webhooks for batch and validation events"},
    {"title": "Confidence Dashboard", "description": "Visual confidence score distribution analytics"},
    {"title": "Exception Queue", "description": "Centralized queue for validation failures"}
  ]'::jsonb,
  '[
    {
      "section": "Webhook Notification System",
      "items": [
        "Real-time HTTP webhooks for batch and validation events",
        "HMAC-SHA256 signature verification for security",
        "Retry logic with exponential backoff (3 attempts)",
        "Custom headers and authentication support",
        "Webhook health monitoring and testing",
        "Detailed delivery logs and response tracking"
      ]
    },
    {
      "section": "Confidence Scoring Dashboard",
      "items": [
        "Visual confidence score distribution analytics",
        "Low-confidence document identification",
        "Field-level confidence tracking",
        "Batch-level confidence aggregation",
        "Filtering by confidence thresholds",
        "Trend analysis over time"
      ]
    },
    {
      "section": "Exception Handling Workflow",
      "items": [
        "Centralized queue for validation failures",
        "Exception severity levels (low, medium, high, critical)",
        "Assignment and resolution workflow",
        "Detailed exception descriptions and context",
        "Status management (pending, in-progress, resolved, dismissed)",
        "Resolution tracking with notes"
      ]
    }
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
),
(
  '2.0.0',
  'Zonal OCR Extraction System',
  '2024-10-25',
  false,
  'Comprehensive zone-based document extraction system enabling users to define fixed regions on documents for data extraction',
  '[
    {"title": "Zone Templates", "description": "Visual zone editor with drag-and-draw interface"},
    {"title": "Anchor Positioning", "description": "Anchor text detection for position stability"},
    {"title": "Barcode Detection", "description": "Multi-format support with confidence scoring"}
  ]'::jsonb,
  '[
    {
      "section": "Zone Template Management",
      "items": [
        "Visual zone editor with drag-and-draw interface",
        "Reusable templates for different document types",
        "Field type configuration (text, number, date, currency)",
        "Validation pattern support with regex",
        "Template activation and management"
      ]
    },
    {
      "section": "Anchor-Based Positioning",
      "items": [
        "Anchor text detection for position stability",
        "Zones relative to document content, not fixed coordinates",
        "Automatic fallback to absolute positioning",
        "Resilient to document layout variations"
      ]
    },
    {
      "section": "Barcode Detection",
      "items": [
        "Multi-format support (QR, Code 128, Code 39, EAN, UPC)",
        "Confidence scoring for each detection",
        "Position and value extraction",
        "Built-in testing tool"
      ]
    }
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);