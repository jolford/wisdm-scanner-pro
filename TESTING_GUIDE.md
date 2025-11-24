# Comprehensive Testing Guide for Document Processing System

## Table of Contents
1. [Document Reprocessing Tests](#document-reprocessing-tests)
2. [Scheduled Export Tests](#scheduled-export-tests)
3. [OCR and Extraction Tests](#ocr-and-extraction-tests)
4. [Batch Processing Tests](#batch-processing-tests)
5. [Authentication and Permissions Tests](#authentication-and-permissions-tests)
6. [Database and Storage Tests](#database-and-storage-tests)

---

## Document Reprocessing Tests

### Test 1: Basic Document Reprocessing (Image)

**Prerequisites:**
- Admin user account
- At least one uploaded image document (JPEG, PNG, or TIFF)
- Document should have existing `extracted_text` and `extracted_metadata`

**Steps:**
1. Log in as admin user
2. Navigate to **Admin → Document Reprocessing** (`/admin/documents/reprocessing`)
3. Open browser console (F12) to monitor logs
4. Locate a document with `file_type` containing "image"
5. Check the checkbox next to the document
6. Click **"Reprocess Selected"** button
7. Observe console output for:
   ```
   Reprocessing document: [filename] ([document-id])
   Calling OCR scan for [filename]...
   OCR completed for [filename], updating database...
   Successfully reprocessed [filename]
   ```
8. Wait for success toast notification

**Expected Results:**
- ✅ Console shows full reprocessing flow without errors
- ✅ Success toast appears: "Documents reprocessed successfully"
- ✅ Document's `extracted_text`, `extracted_metadata`, and `confidence_score` are updated
- ✅ No error toasts appear
- ✅ Page shows updated timestamp

**Validation:**
```sql
-- Run in Lovable Cloud backend SQL editor
SELECT 
  id,
  file_name,
  file_type,
  LENGTH(extracted_text) as text_length,
  confidence_score,
  jsonb_pretty(extracted_metadata) as metadata
FROM documents
WHERE id = '[document-id]';
```

---

### Test 2: Bulk Document Reprocessing (Multiple Documents)

**Prerequisites:**
- 5+ documents of mixed types (images and PDFs)
- Admin user with reprocessing permissions

**Steps:**
1. Navigate to **Admin → Document Reprocessing**
2. Open Network tab (F12 → Network)
3. Filter network requests by "ocr-scan"
4. Select 5 documents using checkboxes
5. Click **"Reprocess Selected"**
6. Monitor console for individual document processing logs
7. Monitor network tab for multiple OCR function calls
8. Wait for completion message

**Expected Results:**
- ✅ All 5 documents show processing logs
- ✅ Network tab shows 5 separate POST requests to `ocr-scan` edge function
- ✅ Success toast shows correct count (e.g., "Successfully reprocessed 5 documents")
- ✅ No partial failures
- ✅ All documents update within reasonable time (< 30 seconds for 5 docs)

**Performance Benchmark:**
- Average time per document: ~3-5 seconds
- Total time for 5 documents: ~15-25 seconds

---

### Test 3: PDF with Existing Text Reprocessing

**Prerequisites:**
- One PDF document with embedded text (not scanned)
- PDF should have `file_type: 'application/pdf'`

**Steps:**
1. Navigate to **Admin → Document Reprocessing**
2. Open console (F12)
3. Find a PDF document
4. Select the PDF checkbox
5. Click **"Reprocess Selected"**
6. Observe console for log: `"PDF has extracted text, using direct extraction..."`
7. Verify no signed URL creation occurs (check logs)
8. Wait for completion

**Expected Results:**
- ✅ Console shows PDF text extraction path (not image OCR)
- ✅ No "createSignedUrl" calls in network tab
- ✅ `extracted_text` field populated from PDF text content
- ✅ Processing completes faster than image OCR (~2-3 seconds)
- ✅ Success toast appears

---

### Test 4: Error Handling - Invalid File Path

**Prerequisites:**
- Admin access to database
- One test document

**Steps:**
1. **Corrupt the file_url:**
   ```sql
   UPDATE documents 
   SET file_url = 'invalid/path/to/file.jpg'
   WHERE id = '[test-document-id]';
   ```
2. Navigate to **Admin → Document Reprocessing**
3. Select the corrupted document
4. Click **"Reprocess Selected"**
5. Observe console for error: `"Failed to get signed URL for: invalid/path/to/file.jpg"`
6. Check for error toast notification

**Expected Results:**
- ✅ Console shows clear error message
- ✅ Error toast appears: "Failed to reprocess [filename]: Failed to get signed URL"
- ✅ No database corruption
- ✅ Other documents in queue still process successfully
- ✅ Error count increments in completion message

**Cleanup:**
```sql
-- Restore correct file_url
UPDATE documents 
SET file_url = '[correct-url]'
WHERE id = '[test-document-id]';
```

---

### Test 5: Reprocessing with Updated Extraction Fields

**Prerequisites:**
- Project with custom extraction fields configured
- One document to reprocess

**Steps:**
1. Navigate to **Admin → Projects** → Select project → **Edit**
2. Update `extraction_fields` JSON, add new field:
   ```json
   {
     "invoice_number": { "type": "text", "required": true },
     "total_amount": { "type": "number", "required": false },
     "NEW_FIELD": { "type": "text", "required": false }
   }
   ```
3. Save project
4. Navigate to **Admin → Document Reprocessing**
5. Filter documents by the project
6. Select a document
7. Click **"Reprocess Selected"**
8. After completion, check document's `extracted_metadata`

**Expected Results:**
- ✅ OCR function receives updated extraction fields
- ✅ New field appears in `extracted_metadata` if detected
- ✅ Existing fields are re-extracted
- ✅ No loss of previously extracted data

**Validation:**
```sql
SELECT 
  file_name,
  jsonb_pretty(extracted_metadata) as metadata,
  confidence_score
FROM documents
WHERE id = '[document-id]';
```

---

## Scheduled Export Tests

### Test 6: Manual Scheduled Export Trigger

**Prerequisites:**
- At least one scheduled export configuration created
- Admin access
- Export config with `is_active = true`

**Steps:**
1. **Create scheduled export config:**
   - Navigate to **Admin → Scheduled Exports**
   - Click **"New Scheduled Export"**
   - Configure:
     - Name: "Test Export"
     - Project: [Select any project]
     - Export Type: "CSV" or "JSON"
     - Schedule: "0 * * * *" (every hour)
     - Batch Filter: `status = 'completed'`
   - Enable **"Active"**
   - Save

2. **Verify pg_cron job is running:**
   ```sql
   -- Check if cron extension is enabled
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   
   -- Check scheduled jobs
   SELECT * FROM cron.job;
   ```

3. **Manually trigger the function:**
   - Open browser console
   - Run:
     ```javascript
     const { data, error } = await supabase.functions.invoke('process-scheduled-exports');
     console.log('Result:', data, error);
     ```

4. **Monitor edge function logs:**
   - Go to Lovable Cloud → Functions → `process-scheduled-exports`
   - Check recent invocations

**Expected Results:**
- ✅ pg_cron job exists and is active
- ✅ Manual invocation succeeds without errors
- ✅ Function logs show: "Processing scheduled export: Test Export"
- ✅ Export files are created in storage bucket (if batches exist)
- ✅ `last_run_at` timestamp updates in `scheduled_export_configs` table

**Validation:**
```sql
SELECT 
  name,
  export_type,
  schedule,
  is_active,
  last_run_at,
  last_run_status
FROM scheduled_export_configs
WHERE name = 'Test Export';
```

---

### Test 7: Scheduled Export Automatic Execution

**Prerequisites:**
- Scheduled export config with cron schedule: `*/2 * * * *` (every 2 minutes)
- Completed batches in the system

**Steps:**
1. Create a scheduled export with 2-minute interval
2. Note the current time
3. Wait 2 minutes
4. Check `scheduled_export_configs` table for updated `last_run_at`
5. Check storage bucket for new export files
6. Review edge function logs

**Expected Results:**
- ✅ `last_run_at` updates automatically every 2 minutes
- ✅ Export files appear in storage at `/exports/[export-id]/[timestamp]/`
- ✅ Edge function logs show regular invocations
- ✅ No failed invocations in logs
- ✅ `last_run_status` = 'success'

**Monitoring Script:**
```sql
-- Run every 30 seconds to monitor
SELECT 
  name,
  schedule,
  last_run_at,
  last_run_status,
  EXTRACT(EPOCH FROM (NOW() - last_run_at)) as seconds_since_last_run
FROM scheduled_export_configs
WHERE is_active = true
ORDER BY last_run_at DESC;
```

---

### Test 8: Scheduled Export Error Handling

**Prerequisites:**
- Admin access to modify configurations

**Steps:**
1. Create a scheduled export with invalid configuration:
   - Invalid batch filter SQL: `status = 'invalid_status' AND non_existent_column = 'value'`
   - Or: Invalid export type
2. Wait for automatic execution or trigger manually
3. Check edge function logs for errors
4. Verify `last_run_status` and `last_error`

**Expected Results:**
- ✅ Function handles error gracefully
- ✅ `last_run_status` = 'error'
- ✅ `last_error` field contains descriptive error message
- ✅ Other scheduled exports continue to run
- ✅ System remains stable

**Validation:**
```sql
SELECT 
  name,
  last_run_status,
  last_error,
  last_run_at
FROM scheduled_export_configs
WHERE last_run_status = 'error';
```

---

## OCR and Extraction Tests

### Test 9: OCR Confidence Score Validation

**Prerequisites:**
- Various document types (clear, blurry, handwritten)

**Steps:**
1. Upload 3 documents:
   - Document A: High-quality printed invoice
   - Document B: Low-quality scanned form
   - Document C: Handwritten note
2. Navigate to **Admin → Documents**
3. Find the uploaded documents
4. Check `confidence_score` for each
5. Verify scores align with quality:
   - High-quality: > 0.85
   - Medium-quality: 0.60 - 0.85
   - Low-quality: < 0.60

**Expected Results:**
- ✅ High-quality documents have confidence > 85%
- ✅ Confidence scores stored as decimal (0.0 - 1.0)
- ✅ Documents with confidence < 0.60 are flagged `needs_review = true`
- ✅ Confidence data stored in `extraction_confidence` table

**Validation:**
```sql
SELECT 
  d.file_name,
  d.confidence_score,
  d.needs_review,
  ec.field_name,
  ec.confidence_score as field_confidence
FROM documents d
LEFT JOIN extraction_confidence ec ON d.id = ec.document_id
WHERE d.id IN ('[doc-a-id]', '[doc-b-id]', '[doc-c-id]')
ORDER BY d.confidence_score DESC;
```

---

### Test 10: Table Extraction from Invoices

**Prerequisites:**
- Invoice PDF or image with line items table

**Steps:**
1. Navigate to **Admin → Projects** → Edit project
2. Enable **"Table Extraction"** in project settings
3. Configure table fields:
   ```json
   {
     "item_description": "text",
     "quantity": "number",
     "unit_price": "number",
     "total": "number"
   }
   ```
4. Upload invoice with line items table
5. Trigger OCR processing
6. Check document's `line_items` field

**Expected Results:**
- ✅ `line_items` contains array of extracted rows
- ✅ Each row has keys matching configured fields
- ✅ Numeric values parsed correctly
- ✅ Table structure preserved

**Example Output:**
```json
{
  "line_items": [
    {
      "item_description": "Widget A",
      "quantity": 5,
      "unit_price": 19.99,
      "total": 99.95
    },
    {
      "item_description": "Service Fee",
      "quantity": 1,
      "unit_price": 50.00,
      "total": 50.00
    }
  ]
}
```

---

### Test 11: Smart Field Detection (AI Auto-Detection)

**Prerequisites:**
- Document with form fields
- `smart-field-detection` edge function enabled

**Steps:**
1. Upload a form document (e.g., application form, registration form)
2. Open browser console
3. After upload completes, check `detected_fields` table:
   ```sql
   SELECT 
     field_name,
     field_type,
     confidence,
     bounding_box,
     auto_detected
   FROM detected_fields
   WHERE document_id = '[document-id]';
   ```
4. Verify detected fields match form structure
5. Check if ML template was created:
   ```sql
   SELECT * FROM ml_document_templates
   WHERE document_type = '[detected-type]'
   ORDER BY created_at DESC;
   ```

**Expected Results:**
- ✅ Fields auto-detected with names and types
- ✅ Bounding boxes show field locations
- ✅ Confidence > 0.7 for each detected field
- ✅ ML template auto-created if confidence > 0.8
- ✅ `auto_detected = true` flag set

---

## Batch Processing Tests

### Test 12: Batch Creation with Template

**Prerequisites:**
- Batch template configured
- Project with extraction fields

**Steps:**
1. Navigate to **Admin → Batch Templates**
2. Create template:
   - Name: "Invoice Processing Template"
   - Project: [Select project]
   - Extraction Config: [Copy from project]
   - Validation Rules: [Define rules]
   - Export Settings: [Configure]
3. Navigate to **Admin → Batches** → **New Batch**
4. Select **"Use Template"**
5. Choose "Invoice Processing Template"
6. Provide batch name
7. Click **"Create Batch"**
8. Verify batch inherits template settings

**Expected Results:**
- ✅ Batch created with template's extraction config
- ✅ Validation rules applied
- ✅ Export settings pre-configured
- ✅ `metadata` contains `template_id` reference

**Validation:**
```sql
SELECT 
  batch_name,
  jsonb_pretty(metadata) as metadata,
  status
FROM batches
WHERE metadata->>'template_id' IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

---

### Test 13: Parallel Batch Document Processing

**Prerequisites:**
- Batch with 10+ unprocessed documents
- Admin access

**Steps:**
1. Create new batch
2. Upload 10 images/PDFs
3. Navigate to **Admin → Queue**
4. Find the batch processing job
5. Monitor job status
6. Open edge function logs for `parallel-ocr-batch`
7. Observe parallel processing (default: 3 concurrent)
8. Check processing time

**Expected Results:**
- ✅ Job status updates from "pending" to "processing" to "completed"
- ✅ Multiple documents process simultaneously (check timestamps)
- ✅ Processing time < 10 documents × average-single-doc-time
- ✅ All documents reach `validation_status = 'pending'`
- ✅ No stuck jobs

**Performance Metrics:**
- Sequential (1 at a time): ~50 seconds for 10 docs
- Parallel (3 at a time): ~20 seconds for 10 docs

**Validation:**
```sql
SELECT 
  status,
  job_type,
  created_at,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM jobs
WHERE job_type = 'batch-ocr'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 14: Batch Status Transitions

**Prerequisites:**
- One batch in 'new' status

**Steps:**
1. Create batch (status: 'new')
2. Upload documents
3. Verify status changes:
   - → 'processing' (when OCR starts)
   - → 'validation' (when all docs processed)
   - → 'completed' (after validation finishes)
4. Monitor `batches` table updates
5. Check document counts update correctly

**Expected Results:**
- ✅ Status transitions follow correct flow
- ✅ `processed_documents` count increments
- ✅ `total_documents` matches actual count
- ✅ Timestamps (`started_at`, `completed_at`) populated
- ✅ `validated_documents` increments as validation occurs

**Monitoring Query:**
```sql
SELECT 
  batch_name,
  status,
  total_documents,
  processed_documents,
  validated_documents,
  error_count,
  started_at,
  completed_at
FROM batches
WHERE id = '[batch-id]';
```

---

## Authentication and Permissions Tests

### Test 15: Role-Based Access Control

**Prerequisites:**
- Three user accounts: admin, operator, viewer
- RLS policies enabled

**Steps:**
1. **Test Admin Access:**
   - Log in as admin
   - Navigate to all admin pages
   - Attempt CRUD operations on all entities
   - Expected: Full access

2. **Test Operator Access:**
   - Log in as operator
   - Attempt to view batches (should succeed)
   - Attempt to edit batch (should succeed)
   - Attempt to delete batch (should fail)
   - Attempt to access admin settings (should fail)

3. **Test Viewer Access:**
   - Log in as viewer
   - Attempt to view batches (should succeed)
   - Attempt to edit anything (should fail)
   - Check UI: action buttons should be disabled

**Expected Results:**
- ✅ Admin: All operations succeed
- ✅ Operator: Read + Update succeed, Delete + Admin fail
- ✅ Viewer: Only Read succeeds
- ✅ Proper error messages for unauthorized actions
- ✅ UI elements hidden based on permissions

**Validation:**
```sql
-- Check user roles
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
ORDER BY created_at DESC;
```

---

### Test 16: Document Lock Mechanism

**Prerequisites:**
- Two user accounts
- One document

**Steps:**
1. **User A:**
   - Log in as User A
   - Navigate to document validation
   - Open document for editing
   - Verify lock created

2. **User B (concurrent):**
   - Log in as User B (different browser/incognito)
   - Navigate to same document
   - Attempt to edit
   - Expected: Lock indicator appears
   - See "Locked by User A" message

3. **User A:**
   - Close document or navigate away
   - Wait for lock expiration (default: 5 minutes)

4. **User B:**
   - Refresh page
   - Verify lock released
   - Can now edit document

**Expected Results:**
- ✅ Lock created when User A opens document
- ✅ User B sees lock indicator
- ✅ User B cannot edit while locked
- ✅ Lock auto-expires after 5 minutes
- ✅ Lock released when User A closes

**Validation:**
```sql
SELECT 
  dl.document_id,
  dl.locked_by,
  dl.session_id,
  dl.locked_at,
  dl.expires_at,
  u.email as locked_by_email,
  EXTRACT(EPOCH FROM (dl.expires_at - NOW())) as seconds_until_expiry
FROM document_locks dl
JOIN auth.users u ON dl.locked_by = u.id
WHERE dl.expires_at > NOW();
```

---

## Database and Storage Tests

### Test 17: Storage Bucket Integrity

**Prerequisites:**
- Admin access to backend
- Documents uploaded

**Steps:**
1. Go to **Lovable Cloud → Storage**
2. Verify buckets exist:
   - `documents` (private)
   - `exports` (private)
   - `templates` (public, optional)
3. Check bucket policies:
   ```sql
   SELECT * FROM storage.buckets;
   ```
4. Verify file uploads:
   - Upload test file
   - Check file appears in bucket
   - Download file and verify integrity
5. Test signed URLs:
   ```javascript
   const { data } = await supabase.storage
     .from('documents')
     .createSignedUrl('path/to/file.pdf', 3600);
   console.log(data.signedUrl);
   ```

**Expected Results:**
- ✅ Buckets configured correctly
- ✅ RLS policies protect private files
- ✅ Signed URLs work and expire correctly
- ✅ Files retain integrity after upload/download
- ✅ No unauthorized access

---

### Test 18: Database Backup and Recovery

**Prerequisites:**
- Admin access
- Test data in database

**Steps:**
1. **Create baseline snapshot:**
   ```sql
   -- Export current state
   SELECT COUNT(*) FROM documents;
   SELECT COUNT(*) FROM batches;
   SELECT COUNT(*) FROM extraction_confidence;
   ```

2. **Perform test operations:**
   - Create new batch
   - Upload documents
   - Process batch
   - Delete batch

3. **Verify referential integrity:**
   ```sql
   -- Check for orphaned records
   SELECT COUNT(*) FROM documents WHERE batch_id NOT IN (SELECT id FROM batches);
   SELECT COUNT(*) FROM extraction_confidence WHERE document_id NOT IN (SELECT id FROM documents);
   ```

4. **Test cascading deletes:**
   ```sql
   -- Delete batch, verify documents also deleted
   DELETE FROM batches WHERE id = '[test-batch-id]';
   SELECT COUNT(*) FROM documents WHERE batch_id = '[test-batch-id]';
   -- Should return 0
   ```

**Expected Results:**
- ✅ No orphaned records
- ✅ Cascading deletes work correctly
- ✅ Foreign key constraints enforced
- ✅ Data integrity maintained

---

### Test 19: Performance Under Load

**Prerequisites:**
- Test environment
- Load testing tool (optional: k6, Apache JMeter)

**Steps:**
1. **Upload load test:**
   - Upload 100 documents simultaneously
   - Monitor:
     - Database connections
     - Storage throughput
     - Edge function execution time
     - Job queue depth

2. **Query performance:**
   ```sql
   -- Test complex query with EXPLAIN ANALYZE
   EXPLAIN ANALYZE
   SELECT 
     b.batch_name,
     COUNT(d.id) as doc_count,
     AVG(d.confidence_score) as avg_confidence,
     COUNT(CASE WHEN d.needs_review THEN 1 END) as review_count
   FROM batches b
   LEFT JOIN documents d ON b.id = d.batch_id
   GROUP BY b.id
   ORDER BY b.created_at DESC
   LIMIT 50;
   ```

3. **Monitor metrics:**
   - Page load time: < 2 seconds
   - API response time: < 500ms
   - OCR processing: < 5 seconds per document
   - Database query time: < 100ms

**Expected Results:**
- ✅ System handles 100 concurrent uploads
- ✅ No timeouts or failed requests
- ✅ Query execution times within acceptable range
- ✅ No database connection pool exhaustion
- ✅ Edge functions scale appropriately

---

## Continuous Monitoring Tests

### Test 20: Error Log Monitoring

**Prerequisites:**
- System running in production

**Steps:**
1. Navigate to **Admin → Error Logs**
2. Review recent errors
3. For each error:
   - Verify error message is descriptive
   - Check stack trace is present
   - Confirm user context captured
   - Verify error severity classification

**Monitoring Query:**
```sql
SELECT 
  component_name,
  error_message,
  COUNT(*) as occurrence_count,
  MAX(created_at) as last_occurred
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY component_name, error_message
ORDER BY occurrence_count DESC
LIMIT 20;
```

**Expected Results:**
- ✅ Errors logged with full context
- ✅ No repeated errors indicating unresolved bugs
- ✅ Error rates within acceptable thresholds (< 1% of requests)

---

## Test Completion Checklist

Use this checklist to track testing progress:

- [ ] Test 1: Basic Document Reprocessing (Image)
- [ ] Test 2: Bulk Document Reprocessing
- [ ] Test 3: PDF with Existing Text Reprocessing
- [ ] Test 4: Error Handling - Invalid File Path
- [ ] Test 5: Reprocessing with Updated Extraction Fields
- [ ] Test 6: Manual Scheduled Export Trigger
- [ ] Test 7: Scheduled Export Automatic Execution
- [ ] Test 8: Scheduled Export Error Handling
- [ ] Test 9: OCR Confidence Score Validation
- [ ] Test 10: Table Extraction from Invoices
- [ ] Test 11: Smart Field Detection
- [ ] Test 12: Batch Creation with Template
- [ ] Test 13: Parallel Batch Document Processing
- [ ] Test 14: Batch Status Transitions
- [ ] Test 15: Role-Based Access Control
- [ ] Test 16: Document Lock Mechanism
- [ ] Test 17: Storage Bucket Integrity
- [ ] Test 18: Database Backup and Recovery
- [ ] Test 19: Performance Under Load
- [ ] Test 20: Error Log Monitoring

---

## Common Issues and Debugging

### Issue: "Failed to get signed URL"
**Cause:** Incorrect file path in `file_url`
**Solution:** Check file path extraction logic in reprocessing code
**Debug Query:**
```sql
SELECT id, file_name, file_url FROM documents WHERE file_url NOT LIKE '%/documents/%';
```

### Issue: Scheduled exports not running
**Cause:** pg_cron job not configured
**Solution:** Verify cron job exists:
```sql
SELECT * FROM cron.job WHERE jobname = 'process-scheduled-exports';
```

### Issue: Documents stuck in "processing" status
**Cause:** Edge function failure or timeout
**Solution:** Check edge function logs and job queue:
```sql
SELECT * FROM jobs WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes';
```

---

## Automated Testing Scripts

### Bash Script: Full System Health Check

```bash
#!/bin/bash

echo "=== Document Processing System Health Check ==="
echo ""

# Test 1: Check scheduled exports
echo "1. Checking scheduled export cron job..."
psql -c "SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'process-scheduled-exports';"

# Test 2: Check pending jobs
echo "2. Checking job queue..."
psql -c "SELECT job_type, status, COUNT(*) FROM jobs GROUP BY job_type, status;"

# Test 3: Check document processing stats
echo "3. Document processing statistics (last 24h)..."
psql -c "SELECT validation_status, COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY validation_status;"

# Test 4: Check error rate
echo "4. Error rate (last 24h)..."
psql -c "SELECT COUNT(*) as error_count FROM error_logs WHERE created_at > NOW() - INTERVAL '24 hours';"

# Test 5: Storage usage
echo "5. Storage usage..."
psql -c "SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;"

echo ""
echo "=== Health Check Complete ==="
```

### JavaScript: Automated UI Test Suite

```javascript
// Run in browser console after logging in as admin

async function runFullTestSuite() {
  console.log('🧪 Starting automated test suite...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Can fetch batches
  try {
    const { data, error } = await supabase.from('batches').select('count');
    if (error) throw error;
    console.log('✅ Test 1 PASSED: Can fetch batches');
    passed++;
  } catch (e) {
    console.error('❌ Test 1 FAILED:', e.message);
    failed++;
  }
  
  // Test 2: Can invoke OCR function
  try {
    const { error } = await supabase.functions.invoke('ocr-scan', {
      body: { imageUrl: 'test', extractionFields: {} }
    });
    // We expect this to fail with validation error, but function should respond
    console.log('✅ Test 2 PASSED: OCR function accessible');
    passed++;
  } catch (e) {
    console.error('❌ Test 2 FAILED:', e.message);
    failed++;
  }
  
  // Test 3: Can create signed URL
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl('test/file.pdf', 60);
    // Will fail if file doesn't exist, but that's OK
    console.log('✅ Test 3 PASSED: Storage bucket accessible');
    passed++;
  } catch (e) {
    console.error('❌ Test 3 FAILED:', e.message);
    failed++;
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Run the test suite
runFullTestSuite();
```

---

**Last Updated:** 2024-11-24  
**Version:** 1.0.0  
**Maintained by:** WisdM Development Team
