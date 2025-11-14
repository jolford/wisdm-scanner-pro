# Release Notes - Version 2.2.1

## 🎯 Latest Updates (v2.2.1)

### Enhanced Medical Form OCR Processing
Significantly improved OCR accuracy for medical forms, healthcare documents, and patient release forms.

**Medical Form Detection:**
- **Intelligent Form Recognition**
  - Automatic detection of medical/healthcare forms based on field names
  - Specialized processing for medical terminology and structures
  - Enhanced handling of patient information fields
  - Optimized for common medical form layouts

**Dual-Mode Extraction:**
- **Text + Image Processing**
  - Processes both PDF text extraction and page images simultaneously
  - Captures handwritten values missed by text-only extraction
  - Handles typed information in form fields
  - Extracts check boxes and hand-marked selections
  
- **Smart Blank Field Detection**
  - Distinguishes between blank fields (underscores/lines) and actual data
  - Returns empty strings for unfilled fields instead of placeholder text
  - Accurately identifies pre-printed form content vs. filled information
  
**Medical-Specific Extraction:**
- **Field-Aware Processing**
  - Patient name extraction with proper formatting
  - Date parsing for birth dates, service dates, authorization dates
  - Address extraction with proper structure
  - Phone number formatting and validation
  - Medical record number detection
  - Insurance information capture
  - Checkbox list handling (e.g., "Information To Be Released")

**Technical Improvements:**
- First page image rendering at optimal resolution (1600px max)
- Image downscaling for efficient processing
- Combined text + visual data sent to AI for comprehensive analysis
- Medical form-specific prompts and extraction rules

---

## 🎯 Major Features (v2.2.0)

### Phase 2: Automation & Advanced Validation
Enhanced automation capabilities with intelligent duplicate detection, customizable validation rules, and scheduled batch processing.

**Duplicate Detection System:**
- **UI Dashboard** (`src/pages/admin/DuplicateDetections.tsx`)
  - Real-time duplicate detection across batches
  - Similarity scoring with configurable thresholds
  - Visual indicators for match confidence (90%+ = critical, 70%+ = warning)
  - Review and manage potential duplicates
  - Confirm or dismiss duplicate detections
  - Cross-batch duplicate tracking
  - Matching field highlights

- **Edge Function** (`supabase/functions/detect-duplicates/`)
  - Name similarity using Jaro-Winkler algorithm
  - Address similarity using Levenshtein distance
  - Configurable similarity thresholds
  - Same-batch and cross-batch detection
  - Automatic duplicate logging

**Field-Level Validation Rules:**
- **Validation Configuration** (`src/pages/admin/ValidationRules.tsx`)
  - Create custom validation rules per project
  - Multiple rule types:
    - Regex pattern matching
    - Numeric range validation
    - Required field enforcement
    - Database lookup validation
    - Date/time format validation
    - Custom logic execution
  - Severity levels (error, warning, info)
  - Active/inactive rule toggling
  - Per-field error messages
  - JSON-based rule configuration

**Scheduled Batch Processing:**
- **Schedule Manager** (`src/pages/admin/ScheduledBatches.tsx`)
  - Automated batch processing at specific times
  - Flexible scheduling:
    - Daily at specific time
    - Weekly on specific day and time
    - Monthly on specific date and time
  - Project-based schedule configuration
  - Active/inactive schedule management
  - Last run tracking and next run calculation
  - Export type selection per schedule

**Database Schema:**
- `validation_rules` table - Stores field validation configurations
- `scheduled_exports` table - Manages batch processing schedules
- Comprehensive RLS policies for multi-tenant security
- Indexes for efficient rule and schedule lookups

---

### Phase 1: Quality Assurance & Monitoring Foundation
Comprehensive quality monitoring and alerting system for document processing workflows.

**Webhook Notification System:**
- **Webhook Configuration** (`src/pages/admin/WebhookConfig.tsx`)
  - Configure real-time HTTP webhooks
  - Event-based triggering (batch complete, validation failed, etc.)
  - Custom headers and authentication
  - HMAC signature verification
  - Retry logic with exponential backoff
  - Webhook health monitoring
  - Test webhook functionality

- **Edge Function** (`supabase/functions/send-webhook/`)
  - Automatic webhook delivery
  - Configurable retry attempts (max 3)
  - Exponential backoff (1s, 2s, 4s)
  - HMAC-SHA256 signature generation
  - Detailed logging of all attempts
  - Response status tracking

**Confidence Scoring Dashboard:**
- **Analytics Interface** (`src/pages/admin/ConfidenceDashboard.tsx`)
  - Visual confidence score distribution
  - Low-confidence document identification
  - Field-level confidence tracking
  - Batch-level confidence aggregation
  - Filtering by confidence thresholds
  - Export confidence reports
  - Trend analysis over time

**Exception Handling Workflow:**
- **Exception Queue** (`src/pages/admin/ExceptionQueue.tsx`)
  - Centralized queue for failed validations
  - Exception severity levels (low, medium, high, critical)
  - Assignment and resolution workflow
  - Detailed exception descriptions
  - Resolution tracking and notes
  - Status management (pending, in-progress, resolved, dismissed)
  - Batch and document context linking

**Database Schema:**
- `webhook_configs` table - Stores webhook configurations
- `webhook_logs` table - Tracks all webhook delivery attempts
- `document_exceptions` table - Manages validation exceptions
- Enhanced RLS policies for secure multi-tenant operations
- Database trigger for automatic webhook invocation

---

### Zonal OCR Extraction System
A comprehensive zone-based document extraction system has been implemented, enabling users to define fixed regions on documents for data extraction without relying solely on AI.

**Key Components:**
- **Zone Template Manager** (`src/components/zonal/ZoneTemplateManager.tsx`)
  - Create and manage reusable zone templates for different document types
  - Upload sample documents to define extraction zones
  - Visual zone editor with drag-and-draw interface
  - Edit, delete, and toggle active/inactive zone templates
  - Template-based batch processing

- **Zone Template Editor** (`src/components/zonal/ZoneTemplateEditor.tsx`)
  - Interactive canvas-based zone definition using Fabric.js v6
  - Draw rectangular zones on sample documents
  - Configure zone properties:
    - Field name and type (text, number, date, currency)
    - Position and dimensions
    - Validation patterns (regex)
    - Anchor text for position stability
  - Visual zone listing with detailed properties
  - Real-time zone preview and editing

**Database Schema:**
- `zone_templates` table - Stores template metadata
- `zone_definitions` table - Stores individual zone configurations with:
  - Field names and types
  - X, Y coordinates and dimensions
  - Sort order for extraction sequence
  - Validation patterns and flags
  - Anchor text and offsets
  - Project associations

---

### Regex Pattern Validation
Advanced field validation using regular expressions has been integrated into the zonal extraction system.

**Features:**
- **Pre-built Pattern Library** (`src/lib/regex-patterns.ts`)
  - Date formats (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
  - Currency and numbers (USD, decimals, percentages)
  - Identification (SSN, ZIP codes, phone numbers)
  - Business formats (invoice numbers, PO numbers, account numbers)
  - Contact info (email, addresses, state codes)
  - Time formats (12hr, 24hr)
  - Names and company names

- **Validation Functions:**
  - `validatePattern()` - Test values against patterns
  - `getPatternMatch()` - Extract matching portions
  - Configurable regex flags (case insensitive, global, etc.)

- **UI Integration:**
  - Dropdown selector with 20+ common patterns
  - Custom pattern input option
  - Pattern preview showing regex syntax
  - Flag configuration (i, g, gi options)
  - Visual indicators for zones with validation

---

### Anchor-Based Zone Positioning
Revolutionary anchor text system to make zones resilient to document variations and shifts.

**Core Technology:**
- **Anchor Text Detection** (`src/lib/zone-anchor.ts`)
  - Find anchor text in OCR word bounding boxes
  - Exact, partial, and fuzzy text matching
  - Multi-word anchor sequences
  - Configurable search radius (default 100px)

- **Smart Positioning:**
  - `findAnchorText()` - Locate anchor text with multiple matching strategies
  - `calculateZonePosition()` - Compute zone position relative to anchor
  - `calculateZonePositions()` - Batch zone position calculation
  - `extractTextFromZone()` - Extract text from calculated zones
  - Automatic fallback to absolute positioning if anchor not found

- **User Benefits:**
  - Zones stay accurate even if document layout shifts slightly
  - More reliable extraction across document variations
  - Reduced false extractions from misaligned zones
  - Visual anchor indicators in zone list

**Database Schema Updates:**
```sql
ALTER TABLE zone_definitions ADD COLUMN:
- anchor_text (text) - Text to search for as anchor
- anchor_offset_x (integer) - Horizontal offset from anchor
- anchor_offset_y (integer) - Vertical offset from anchor  
- anchor_search_radius (integer) - Search area in pixels
```

---

### Barcode Detection & Testing Tool
New barcode detection capabilities with comprehensive testing interface.

**Features:**
- **Barcode Test Tool** (`src/components/admin/BarcodeTestTool.tsx`)
  - Upload test documents (images or PDFs)
  - Real-time barcode detection
  - Image preview before testing
  - Detailed extraction results

- **Detection Edge Function** (`supabase/functions/detect-barcodes/`)
  - Powered by Lovable AI (Gemini 2.5 Flash)
  - Multi-format support:
    - QR Codes
    - Code 128
    - Code 39
    - EAN-13
    - UPC-A
    - And more standard formats
  - Returns for each barcode:
    - Type and format
    - Decoded value
    - Confidence score (0-1)
    - Position coordinates (x, y, width, height)

- **Results Display:**
  - Count of detected barcodes
  - Individual barcode cards showing:
    - Format badge
    - Type classification
    - Extracted value (monospace, copyable)
    - Confidence percentage
    - Position information
  - Success/info notifications

**Technical Implementation:**
- Uses Lovable AI vision model for barcode analysis
- Temporary file storage for testing
- Automatic cleanup after detection
- CORS-enabled edge function
- Error handling with detailed logging

---

## 🔧 Technical Improvements

### Fabric.js v6 Migration
Updated canvas manipulation to use Fabric.js v6 API:
- Modern ES6 imports (`Canvas as FabricCanvas`, `Rect`, `FabricImage`)
- Updated rendering and object manipulation methods
- Improved performance and stability
- Better TypeScript support

### Database Enhancements
- Added comprehensive indexes for zone queries
- Foreign key relationships for data integrity
- RLS policies for multi-tenant security
- Optimized queries for template loading

### UI/UX Improvements
- Fixed Select dropdown transparency issues
- Added `bg-background` and `z-50` to all dropdowns
- Removed empty string values from Select components (Radix UI requirement)
- Improved form validation and error messages
- Better visual hierarchy in zone editor
- Responsive layout for zone template manager

### Security Fixes
- Fixed empty value Select items causing runtime errors
- Updated pattern flags to use proper default values
- Improved RLS policies for zone templates
- Secure file upload and temporary storage handling

---

## 📊 Database Schema Changes

### New Tables (Phase 2)
1. **validation_rules**
   - id (uuid, primary key)
   - project_id (uuid, foreign key)
   - document_class_id (uuid, foreign key, nullable)
   - field_name (text)
   - rule_type (text: regex, range, required, custom, lookup, format)
   - rule_config (jsonb)
   - error_message (text)
   - severity (text: error, warning, info)
   - is_active (boolean)
   - created_by (uuid)
   - created_at, updated_at (timestamps)

2. **scheduled_exports** (extends existing table)
   - id (uuid, primary key)
   - project_id (uuid, foreign key)
   - customer_id (uuid, foreign key)
   - name (text)
   - frequency (text: daily, weekly, monthly)
   - time_of_day (time)
   - day_of_week (integer, 0-6, nullable)
   - day_of_month (integer, 1-31, nullable)
   - export_types (text array)
   - is_active (boolean)
   - last_run_at, next_run_at (timestamps, nullable)
   - created_by (uuid)
   - created_at, updated_at (timestamps)

### New Tables (Phase 1)
1. **webhook_configs**
   - id (uuid, primary key)
   - customer_id (uuid, foreign key)
   - name (text)
   - url (text)
   - secret (text)
   - events (text array)
   - headers (jsonb)
   - retry_config (jsonb)
   - is_active (boolean)
   - last_triggered_at (timestamp, nullable)
   - created_by (uuid)
   - created_at, updated_at (timestamps)

2. **webhook_logs**
   - id (uuid, primary key)
   - webhook_config_id (uuid, foreign key)
   - event_type (text)
   - payload (jsonb)
   - response_status (integer, nullable)
   - response_body (text, nullable)
   - error_message (text, nullable)
   - attempt_number (integer)
   - delivered_at (timestamp, nullable)
   - created_at (timestamp)

3. **document_exceptions** (extended)
   - id (uuid, primary key)
   - document_id (uuid, foreign key)
   - batch_id (uuid, foreign key)
   - exception_type (text)
   - severity (text: low, medium, high, critical)
   - description (text)
   - details (jsonb)
   - status (text: pending, in-progress, resolved, dismissed)
   - assigned_to (uuid, nullable)
   - resolved_by (uuid, nullable)
   - resolved_at (timestamp, nullable)
   - resolution_notes (text, nullable)
   - created_at, updated_at (timestamps)

### Existing Tables
1. **zone_templates**
   - id (uuid, primary key)
   - project_id (uuid, foreign key)
   - name (text)
   - description (text)
   - sample_image_url (text)
   - is_active (boolean)
   - created_by (uuid)
   - created_at, updated_at (timestamps)

2. **zone_definitions**
   - id (uuid, primary key)
   - template_id (uuid, foreign key)
   - field_name (text)
   - field_type (text)
   - x, y, width, height (integers)
   - sort_order (integer)
   - validation_pattern (text, nullable)
   - validation_flags (text, default 'i')
   - anchor_text (text, nullable)
   - anchor_offset_x, anchor_offset_y (integers, nullable)
   - anchor_search_radius (integer, default 100)
   - created_at, updated_at (timestamps)

### RLS Policies
- System admins can manage all zone templates
- Tenant admins can manage their project templates
- Users can view templates for their assigned projects
- Proper isolation between customer data

---

## 🚀 Edge Functions

### New Functions (Phase 2)
1. **detect-duplicates**
   - Compares documents for similarity
   - Name matching using Jaro-Winkler algorithm
   - Address matching using Levenshtein distance
   - Configurable similarity thresholds
   - Cross-batch duplicate detection
   - Returns similarity scores and matching fields

2. **process-scheduled-exports**
   - Processes scheduled batch exports
   - Time-based scheduling (daily, weekly, monthly)
   - Fair-share processing across customers
   - Automatic next run calculation
   - Integration with auto-export-batch function

### New Functions (Phase 1)
1. **send-webhook**
   - Delivers webhook notifications
   - HMAC-SHA256 signature generation
   - Retry logic with exponential backoff
   - Response logging and tracking
   - Supports custom headers and authentication

### Existing Functions
1. **detect-barcodes**
   - Analyzes documents for barcode presence
   - Returns barcode type, value, and metadata
   - Uses Gemini 2.5 Flash for vision analysis
   - Handles multiple barcodes per document

### Updated Functions
- Improved error handling across all OCR functions
- Better logging for debugging
- Enhanced CORS headers

---

## 📝 Code Organization

### New Utility Libraries
- `src/lib/regex-patterns.ts` - Pattern validation library
- `src/lib/zone-anchor.ts` - Anchor positioning utilities

### New Components (Phase 2)
- `src/pages/admin/DuplicateDetections.tsx` - Duplicate review dashboard
- `src/pages/admin/ValidationRules.tsx` - Rule configuration interface
- `src/pages/admin/ScheduledBatches.tsx` - Schedule management UI

### New Components (Phase 1)
- `src/pages/admin/WebhookConfig.tsx` - Webhook configuration
- `src/pages/admin/ConfidenceDashboard.tsx` - Confidence analytics
- `src/pages/admin/ExceptionQueue.tsx` - Exception management

### Existing Components
- `src/components/zonal/ZoneTemplateManager.tsx` - Template CRUD
- `src/components/zonal/ZoneTemplateEditor.tsx` - Visual editor
- `src/components/admin/BarcodeTestTool.tsx` - Testing interface

### Integration Points
- Zone templates accessible from project management
- Barcode config linked to document classes
- Validation patterns shared across extraction methods

---

## 🐛 Bug Fixes

1. **Select Component Errors**
   - Fixed "Select.Item must have a value prop that is not an empty string" error
   - Changed empty string values to 'none' with proper mapping
   - Added proper background colors to all Select components

2. **Zone Editor Stability**
   - Fixed canvas disposal on unmount
   - Improved zone editing and deletion
   - Better handling of initial zone loading

3. **Dropdown Visibility**
   - Added explicit `bg-background` and `z-50` classes
   - Fixed transparent dropdown menus
   - Improved contrast in light/dark modes

---

## 📈 Performance Improvements

1. **Optimized Zone Loading**
   - Batch zone queries with single database call
   - Efficient zone rendering on canvas
   - Lazy loading of sample images

2. **Improved Validation**
   - Regex patterns compiled once and reused
   - Validation only on changed fields
   - Debounced validation for real-time feedback

3. **Better Caching**
   - Signed URLs cached for zone templates
   - Template metadata cached on client
   - Reduced redundant database queries

---

## 🔐 Security Considerations

### Addressed
- Multi-tenant data isolation in zone templates
- Proper RLS policies on new tables
- Secure file upload handling
- Validation of user inputs

### Pre-existing Warnings (Not Related to New Features)
⚠️ The following warnings existed before recent changes:
1. Extension in Public schema
2. Leaked Password Protection Disabled

These should be addressed in a future security audit but are not blockers for the new features.

---

## 🎓 Documentation Updates Needed

### User Documentation
- [ ] Guide: Creating Zone Templates
- [ ] Guide: Using Anchor Text for Reliable Extraction
- [ ] Guide: Regex Pattern Validation
- [ ] Guide: Barcode Testing Tool
- [ ] Video: Zone Template Walkthrough

### Developer Documentation
- [ ] API: Zone Template Management
- [ ] API: Barcode Detection Endpoint
- [ ] Guide: Extending Regex Pattern Library
- [ ] Guide: Custom Anchor Matching Strategies

---

## 🔄 Migration Notes

### For Existing Users
- No migration required - all changes are additive
- Existing projects continue to work unchanged
- Zone templates are optional enhancement
- Can be adopted per-project as needed

### For Administrators
- New admin UI components available
- Barcode testing tool in admin area
- Zone templates managed per project
- Consider training users on anchor text benefits

---

## 📱 Compatibility

- **Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Devices:** Desktop, tablet, mobile (responsive)
- **File Formats:** PNG, JPEG, TIFF, BMP, WEBP, PDF
- **Barcode Formats:** QR, Code 128, Code 39, EAN, UPC, and more

---

## 🎯 What's Next

### Phase 3: Bulk Operations & Analytics (In Development)
1. **Bulk Edit Mode**
   - Edit multiple document fields simultaneously
   - Batch field updates across documents
   - Undo/redo functionality
   - Change preview before applying

2. **Document Comparison View**
   - Side-by-side before/after validation view
   - Visual diff highlighting
   - Field-level change tracking
   - Approval workflow

3. **Quality Assurance Metrics**
   - Validation accuracy tracking
   - Processing time analytics
   - Error rate monitoring
   - Performance dashboards

### Phase 4: Smart Search & Intelligence
1. **Semantic Search**
   - AI-powered document search
   - Meaning-based queries
   - Cross-document intelligence
   - Natural language search

### Planned Features
1. **OCR Integration**
   - Connect anchor-based positioning to OCR functions
   - Use zone templates during document processing
   - Batch extraction with templates

2. **Advanced Barcode Features**
   - Barcode-triggered document separation
   - Barcode-based document routing
   - Barcode data validation rules

3. **Template Enhancements**
   - Template sharing between projects
   - Template versioning
   - Template import/export
   - AI-suggested zone placement

4. **Validation Improvements**
   - Visual pattern testing UI
   - Pattern library expansion
   - Custom validation functions
   - Lookup table validation

---

## 👥 Contributors

Development by the Lovable AI assistant working with the user to implement:
- Zonal extraction system architecture
- Regex validation framework
- Anchor-based positioning algorithm
- Barcode detection capabilities

---

## 📞 Support

For questions about new features:
- Zone Templates: See admin documentation
- Regex Patterns: Refer to pattern library
- Barcode Testing: Use built-in test tool
- Anchor Text: Check zone positioning guide

---

**Version:** 2.2.0 (Quality & Automation Release)
**Release Date:** November 2024
**Status:** Production Ready ✅

### Recent Updates
- **v2.2.0** - Phase 2: Automation & Advanced Validation (Duplicate Detection, Validation Rules, Scheduled Processing)
- **v2.1.0** - Phase 1: Quality Assurance & Monitoring (Webhooks, Confidence Dashboard, Exception Queue)
- **v2.0.0** - Zonal Extraction System (Zone Templates, Anchor Positioning, Barcode Detection)
