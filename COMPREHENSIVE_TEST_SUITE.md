# Complete Application Test Suite
## WisdM Document Processing System

**Version:** 1.0.0  
**Last Updated:** 2024-11-24  
**Test Coverage:** End-to-End Application Testing

---

## Table of Contents

### Part 1: User Authentication & Management
1. [User Registration & Login Tests](#user-registration--login-tests)
2. [Multi-Factor Authentication Tests](#multi-factor-authentication-tests)
3. [Password Reset & Recovery](#password-reset--recovery)
4. [Session Management](#session-management)
5. [Role-Based Access Control](#role-based-access-control)

### Part 2: Project Management
6. [Project Creation & Configuration](#project-creation--configuration)
7. [Project Settings & Customization](#project-settings--customization)
8. [Project Icon Management](#project-icon-management)
9. [Extraction Field Configuration](#extraction-field-configuration)

### Part 3: Batch Management
10. [Batch Creation & Setup](#batch-creation--setup)
11. [Batch Templates](#batch-templates)
12. [Batch Status Workflow](#batch-status-workflow)
13. [Batch Assignment & Collaboration](#batch-assignment--collaboration)

### Part 4: Document Upload & Processing
14. [Document Upload (Single & Bulk)](#document-upload-single--bulk)
15. [Mobile Capture](#mobile-capture)
16. [Scanner Integration](#scanner-integration)
17. [Email Import](#email-import)
18. [Fax Import](#fax-import)
19. [Hot Folder Import](#hot-folder-import)

### Part 5: OCR & Data Extraction
20. [OCR Processing Tests](#ocr-processing-tests)
21. [Table Extraction](#table-extraction)
22. [Smart Field Detection](#smart-field-detection)
23. [Confidence Scoring](#confidence-scoring)
24. [Document Classification](#document-classification)

### Part 6: Validation Workflows
25. [Manual Validation](#manual-validation)
26. [Interactive Document Viewer](#interactive-document-viewer)
27. [Field-Level Validation](#field-level-validation)
28. [Validation Rules Engine](#validation-rules-engine)
29. [Lookup Table Validation](#lookup-table-validation)
30. [Address Validation](#address-validation)
31. [Signature Validation](#signature-validation)

### Part 7: Advanced Features
32. [Barcode Detection & Processing](#barcode-detection--processing)
33. [Document Separation](#document-separation)
34. [Duplicate Detection](#duplicate-detection)
35. [Fraud Detection](#fraud-detection)
36. [PII Detection & Redaction](#pii-detection--redaction)
37. [ML Document Templates](#ml-document-templates)
38. [Zonal OCR Templates](#zonal-ocr-templates)

### Part 8: Export & Integration
39. [Export to CSV/JSON/Excel](#export-to-csvjsonexcel)
40. [Export to SharePoint](#export-to-sharepoint)
41. [Export to Documentum](#export-to-documentum)
42. [Export to FileBound](#export-to-filebound)
43. [Scheduled Exports](#scheduled-exports)
44. [Webhook Integration](#webhook-integration)

### Part 9: Administration
45. [User Management](#user-management)
46. [Customer Management](#customer-management)
47. [License Management](#license-management)
48. [Audit Trail](#audit-trail)
49. [Error Logs](#error-logs)
50. [Analytics & Reporting](#analytics--reporting)

### Part 10: System Features
51. [Job Queue System](#job-queue-system)
52. [Document Locking](#document-locking)
53. [Comments & Collaboration](#comments--collaboration)
54. [Exception Queue](#exception-queue)
55. [Bulk Operations](#bulk-operations)
56. [Search & Filtering](#search--filtering)

### Part 11: Performance & Security
57. [Performance Testing](#performance-testing)
58. [Security Testing](#security-testing)
59. [Database Integrity](#database-integrity)
60. [Storage Testing](#storage-testing)

---

## Part 1: User Authentication & Management

### Test 1: User Registration & Login Tests

#### Test 1.1: New User Registration

**Prerequisites:** None

**Steps:**
1. Navigate to login page
2. Click **"Sign Up"**
3. Enter:
   - Email: `testuser@example.com`
   - Password: `SecurePass123!`
   - Confirm Password: `SecurePass123!`
   - Full Name: `Test User`
4. Click **"Create Account"**
5. Check email for verification (if auto-confirm disabled)

**Expected Results:**
- ✅ Account created successfully
- ✅ User redirected to dashboard or prompted to verify email
- ✅ User profile created in `profiles` table
- ✅ Default role assigned (viewer/operator)

**Validation:**
```sql
SELECT 
  u.email,
  u.created_at,
  u.email_confirmed_at,
  u.raw_user_meta_data->>'role' as role,
  p.full_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'testuser@example.com';
```

---

#### Test 1.2: User Login with Valid Credentials

**Steps:**
1. Navigate to login page
2. Enter email: `testuser@example.com`
3. Enter password: `SecurePass123!`
4. Click **"Sign In"**

**Expected Results:**
- ✅ User successfully authenticated
- ✅ Redirected to `/` (dashboard)
- ✅ Session cookie created
- ✅ User's role loaded from metadata

---

#### Test 1.3: Login with Invalid Credentials

**Steps:**
1. Navigate to login page
2. Enter email: `testuser@example.com`
3. Enter password: `WrongPassword`
4. Click **"Sign In"**

**Expected Results:**
- ✅ Error message: "Invalid login credentials"
- ✅ User remains on login page
- ✅ No session created
- ✅ Failed login attempt logged

---

#### Test 1.4: Email Format Validation

**Steps:**
1. Attempt registration with invalid emails:
   - `invalidemail` (no @)
   - `test@` (no domain)
   - `@example.com` (no username)
   - `test@.com` (invalid domain)

**Expected Results:**
- ✅ Form validation prevents submission
- ✅ Error message displays for each invalid format
- ✅ No database records created

---

### Test 2: Multi-Factor Authentication Tests

#### Test 2.1: MFA Enrollment (TOTP)

**Prerequisites:** User logged in

**Steps:**
1. Navigate to **User Settings** → **Security**
2. Click **"Enable Multi-Factor Authentication"**
3. Scan QR code with authenticator app (Google Authenticator, Authy)
4. Enter 6-digit code from app
5. Click **"Verify and Enable"**
6. Save recovery codes

**Expected Results:**
- ✅ MFA enabled for user account
- ✅ Recovery codes generated and displayed
- ✅ Next login requires TOTP code
- ✅ User metadata updated with MFA status

**Validation:**
```sql
SELECT 
  email,
  raw_user_meta_data->>'mfa_enabled' as mfa_enabled,
  created_at
FROM auth.users
WHERE email = 'testuser@example.com';
```

---

#### Test 2.2: Login with MFA

**Steps:**
1. Log out
2. Log in with email and password
3. Enter TOTP code from authenticator app
4. Click **"Verify"**

**Expected Results:**
- ✅ TOTP challenge appears after password
- ✅ Valid code grants access
- ✅ Invalid code shows error
- ✅ Session created after successful MFA

---

#### Test 2.3: MFA Recovery with Backup Codes

**Steps:**
1. Log out
2. Log in with email and password
3. Click **"Use recovery code"**
4. Enter one of the saved recovery codes
5. Submit

**Expected Results:**
- ✅ Recovery code accepted (one-time use)
- ✅ User gains access
- ✅ Recovery code marked as used
- ✅ Warning shown: few recovery codes remaining

---

#### Test 2.4: Admin Disable User MFA

**Prerequisites:** Admin account

**Steps:**
1. Log in as admin
2. Navigate to **Admin** → **Users**
3. Find user with MFA enabled
4. Click **"Disable MFA"**
5. Confirm action

**Expected Results:**
- ✅ MFA disabled for target user
- ✅ User can log in without TOTP on next login
- ✅ Audit log entry created
- ✅ User notified via email (optional)

**API Test:**
```javascript
const { data, error } = await supabase.functions.invoke('disable-user-mfa', {
  body: { userId: '[target-user-id]' }
});
console.log(data, error);
```

---

### Test 3: Password Reset & Recovery

#### Test 3.1: Request Password Reset

**Steps:**
1. Navigate to login page
2. Click **"Forgot Password?"**
3. Enter email: `testuser@example.com`
4. Click **"Send Reset Link"**
5. Check email inbox

**Expected Results:**
- ✅ Password reset email sent
- ✅ Email contains secure reset link with token
- ✅ Token expires after 1 hour
- ✅ Success message displayed

---

#### Test 3.2: Complete Password Reset

**Steps:**
1. Open reset link from email
2. Enter new password: `NewSecurePass456!`
3. Confirm password: `NewSecurePass456!`
4. Click **"Reset Password"**
5. Attempt login with new password

**Expected Results:**
- ✅ Password updated successfully
- ✅ Old password no longer works
- ✅ New password grants access
- ✅ Password reset token invalidated

---

#### Test 3.3: Expired Reset Token

**Steps:**
1. Request password reset
2. Wait for token expiration (or manually expire in DB)
3. Attempt to use expired reset link

**Expected Results:**
- ✅ Error: "Reset link has expired"
- ✅ User prompted to request new link
- ✅ Password remains unchanged

---

### Test 4: Session Management

#### Test 4.1: Session Persistence

**Steps:**
1. Log in successfully
2. Close browser tab
3. Reopen application URL
4. Verify user still logged in

**Expected Results:**
- ✅ Session persists across browser close
- ✅ User auto-logged in on return
- ✅ Session data in localStorage

---

#### Test 4.2: Logout

**Steps:**
1. Log in
2. Click **"Logout"** button
3. Attempt to navigate to protected page

**Expected Results:**
- ✅ Session cleared
- ✅ localStorage cleared
- ✅ Redirected to login page
- ✅ Cannot access protected routes

---

#### Test 4.3: Session Timeout

**Prerequisites:** Session timeout configured (e.g., 24 hours)

**Steps:**
1. Log in
2. Wait for session timeout or manually expire token
3. Attempt action (e.g., create batch)

**Expected Results:**
- ✅ Session expired error
- ✅ User redirected to login
- ✅ Error toast: "Session expired, please log in again"

---

### Test 5: Role-Based Access Control

#### Test 5.1: Admin Role Access

**Steps:**
1. Log in as admin user
2. Attempt to access:
   - `/admin/dashboard`
   - `/admin/users`
   - `/admin/customers`
   - `/admin/licenses`
   - `/admin/analytics`

**Expected Results:**
- ✅ All admin routes accessible
- ✅ Full CRUD permissions on all entities
- ✅ Can view sensitive data
- ✅ Can modify system settings

---

#### Test 5.2: Operator Role Access

**Steps:**
1. Log in as operator user
2. Attempt to access:
   - `/` (dashboard) - Should work
   - `/batches` - Should work
   - `/admin/users` - Should fail
   - `/admin/customers` - Should fail

**Expected Results:**
- ✅ Can view and edit batches
- ✅ Can validate documents
- ✅ Cannot access admin settings
- ✅ Cannot manage users/customers

---

#### Test 5.3: Viewer Role Access

**Steps:**
1. Log in as viewer user
2. Attempt to:
   - View batches
   - Edit batch
   - Delete batch
   - Create new batch

**Expected Results:**
- ✅ Can view batches (read-only)
- ✅ Cannot edit/delete/create batches
- ✅ Action buttons disabled in UI
- ✅ API calls return 403 Forbidden

---

#### Test 5.4: RLS Policy Enforcement

**Steps:**
1. Log in as regular user (not admin)
2. Open browser console
3. Attempt direct database query:
   ```javascript
   const { data } = await supabase
     .from('licenses')
     .select('*');
   console.log(data);
   ```

**Expected Results:**
- ✅ RLS blocks unauthorized access
- ✅ Returns empty array or error
- ✅ No sensitive data exposed

**Admin Test:**
```javascript
// As admin, same query should succeed
const { data } = await supabase
  .from('licenses')
  .select('*');
console.log(data); // Should return license data
```

---

## Part 2: Project Management

### Test 6: Project Creation & Configuration

#### Test 6.1: Create New Project

**Prerequisites:** Admin or operator role

**Steps:**
1. Navigate to **Admin** → **Projects** → **New Project**
2. Fill form:
   - Name: `Invoice Processing`
   - Description: `Automated invoice data extraction`
   - Customer: [Select customer]
   - Icon: [Select icon]
3. Configure extraction fields:
   ```json
   {
     "invoice_number": {
       "type": "text",
       "required": true,
       "label": "Invoice Number"
     },
     "invoice_date": {
       "type": "date",
       "required": true,
       "label": "Invoice Date"
     },
     "vendor_name": {
       "type": "text",
       "required": true,
       "label": "Vendor Name"
     },
     "total_amount": {
       "type": "number",
       "required": true,
       "label": "Total Amount"
     }
   }
   ```
4. Enable features:
   - ✓ Detect PII
   - ✓ Enable Signature Verification
   - ✓ Enable Check Scanning
5. Click **"Create Project"**

**Expected Results:**
- ✅ Project created successfully
- ✅ Project appears in projects list
- ✅ Extraction fields saved
- ✅ Features enabled as configured
- ✅ Toast notification: "Project created successfully"

**Validation:**
```sql
SELECT 
  name,
  description,
  customer_id,
  detect_pii,
  enable_signature_verification,
  enable_check_scanning,
  jsonb_pretty(extraction_fields) as fields
FROM projects
WHERE name = 'Invoice Processing';
```

---

#### Test 6.2: Edit Existing Project

**Steps:**
1. Navigate to **Admin** → **Projects**
2. Click on existing project
3. Click **"Edit"**
4. Update:
   - Description: `Updated description`
   - Add new extraction field:
     ```json
     "purchase_order": {
       "type": "text",
       "required": false,
       "label": "PO Number"
     }
     ```
5. Click **"Save Changes"**

**Expected Results:**
- ✅ Project updated
- ✅ New field available for extraction
- ✅ Existing batches can use new field
- ✅ Audit trail entry created

---

#### Test 6.3: Deactivate Project

**Steps:**
1. Navigate to **Admin** → **Projects**
2. Select project
3. Click **"Deactivate"**
4. Confirm action
5. Attempt to create batch in deactivated project

**Expected Results:**
- ✅ Project marked as inactive (`is_active = false`)
- ✅ Project hidden from batch creation dropdown
- ✅ Existing batches still accessible
- ✅ Cannot create new batches

**Validation:**
```sql
SELECT name, is_active FROM projects WHERE name = 'Invoice Processing';
```

---

### Test 7: Project Settings & Customization

#### Test 7.1: OCR Model Selection

**Steps:**
1. Edit project
2. Change OCR model from default to `enhanced`
3. Save changes
4. Upload document to batch in this project
5. Check OCR processing

**Expected Results:**
- ✅ OCR model setting saved
- ✅ New documents use selected model
- ✅ Enhanced model provides better accuracy (if applicable)

---

#### Test 7.2: Export Type Configuration

**Steps:**
1. Edit project
2. Configure export types:
   - ✓ CSV
   - ✓ JSON
   - ✓ Excel
   - ✓ SharePoint
3. Save

**Expected Results:**
- ✅ Export types saved in `export_types` array
- ✅ Batch export shows only enabled types
- ✅ Disabled export types hidden from UI

**Validation:**
```sql
SELECT name, export_types FROM projects WHERE name = 'Invoice Processing';
```

---

#### Test 7.3: Queue Configuration

**Steps:**
1. Edit project
2. Configure queues:
   ```json
   {
     "validation": {
       "name": "Validation Queue",
       "priority": "high"
     },
     "review": {
       "name": "QA Review",
       "priority": "medium"
     }
   }
   ```
3. Save

**Expected Results:**
- ✅ Queues created for project
- ✅ Documents can be assigned to queues
- ✅ Queue filters work in batch view

---

### Test 8: Project Icon Management

#### Test 8.1: Select Predefined Icon

**Steps:**
1. Create/Edit project
2. Click **"Select Icon"**
3. Choose from predefined icons:
   - Invoice icon
   - Contract icon
   - Receipt icon
   - Form icon
4. Save

**Expected Results:**
- ✅ Icon selected and displayed
- ✅ Icon appears in project list
- ✅ Icon URL stored in `icon_url` field

---

#### Test 8.2: Upload Custom Icon

**Steps:**
1. Edit project
2. Click **"Upload Custom Icon"**
3. Select image file (PNG, 256x256px)
4. Confirm upload
5. Save project

**Expected Results:**
- ✅ Custom icon uploaded to storage
- ✅ Icon displayed in project
- ✅ Icon accessible via signed URL

---

### Test 9: Extraction Field Configuration

#### Test 9.1: Field Types

**Test all supported field types:**

```json
{
  "text_field": {
    "type": "text",
    "required": true,
    "label": "Text Field"
  },
  "number_field": {
    "type": "number",
    "required": false,
    "label": "Number Field"
  },
  "date_field": {
    "type": "date",
    "required": true,
    "label": "Date Field",
    "format": "YYYY-MM-DD"
  },
  "boolean_field": {
    "type": "boolean",
    "required": false,
    "label": "Boolean Field"
  },
  "select_field": {
    "type": "select",
    "required": false,
    "label": "Select Field",
    "options": ["Option 1", "Option 2", "Option 3"]
  }
}
```

**Expected Results:**
- ✅ All field types supported
- ✅ Fields appear in validation UI
- ✅ Field validation works correctly
- ✅ Data types enforced

---

#### Test 9.2: Required vs Optional Fields

**Steps:**
1. Create project with mix of required/optional fields
2. Upload document
3. Attempt to validate document:
   - Leave required field empty
   - Leave optional field empty

**Expected Results:**
- ✅ Validation error for empty required fields
- ✅ No error for empty optional fields
- ✅ Cannot complete validation without required fields

---

#### Test 9.3: Field Validation Patterns

**Configure field with pattern:**
```json
{
  "invoice_number": {
    "type": "text",
    "required": true,
    "label": "Invoice Number",
    "pattern": "^INV-\\d{6}$",
    "patternError": "Must be format: INV-123456"
  }
}
```

**Test:**
1. Enter invalid format: `12345`
2. Enter valid format: `INV-123456`

**Expected Results:**
- ✅ Invalid format shows pattern error
- ✅ Valid format accepted
- ✅ Custom error message displayed

---

## Part 3: Batch Management

### Test 10: Batch Creation & Setup

#### Test 10.1: Create Empty Batch

**Steps:**
1. Navigate to **Batches** → **New Batch**
2. Fill form:
   - Project: `Invoice Processing`
   - Batch Name: `January 2024 Invoices`
   - Priority: `High`
   - Notes: `Q1 2024 invoices for Acme Corp`
3. Click **"Create"**

**Expected Results:**
- ✅ Batch created with status `new`
- ✅ Batch appears in batches list
- ✅ Zero documents initially
- ✅ Assigned to creator by default

**Validation:**
```sql
SELECT 
  batch_name,
  status,
  project_id,
  total_documents,
  created_by,
  priority
FROM batches
WHERE batch_name = 'January 2024 Invoices';
```

---

#### Test 10.2: Create Batch and Upload Documents

**Steps:**
1. Create new batch
2. Immediately upload 5 documents
3. Wait for OCR processing
4. Check batch statistics

**Expected Results:**
- ✅ Batch status → `processing`
- ✅ `total_documents = 5`
- ✅ `processed_documents` increments as OCR completes
- ✅ Status → `validation` when all processed

---

#### Test 10.3: Batch Assignment

**Steps:**
1. Create batch (as admin)
2. Click **"Assign To"**
3. Select user from dropdown
4. Save assignment
5. Log in as assigned user
6. Verify batch appears in "My Batches"

**Expected Results:**
- ✅ `assigned_to` field updated
- ✅ Assigned user notified (optional)
- ✅ Batch appears in user's queue
- ✅ Filters work correctly

---

### Test 11: Batch Templates

#### Test 11.1: Create Batch Template

**Steps:**
1. Navigate to **Admin** → **Batch Templates** → **New**
2. Configure:
   - Name: `Standard Invoice Template`
   - Project: `Invoice Processing`
   - Extraction Config: [Copy from project]
   - Validation Rules:
     ```json
     {
       "total_amount": {
         "min": 0,
         "max": 100000,
         "required": true
       },
       "invoice_date": {
         "maxDate": "today",
         "required": true
       }
     }
     ```
   - Export Settings:
     ```json
     {
       "type": "CSV",
       "includeMetadata": true,
       "filename": "invoices_{{date}}.csv"
     }
     ```
3. Enable **"Active"**
4. Click **"Save Template"**

**Expected Results:**
- ✅ Template saved
- ✅ Available for batch creation
- ✅ All configurations stored

**Validation:**
```sql
SELECT 
  name,
  is_active,
  jsonb_pretty(extraction_config) as extraction,
  jsonb_pretty(validation_rules) as validation,
  jsonb_pretty(export_settings) as export
FROM batch_templates
WHERE name = 'Standard Invoice Template';
```

---

#### Test 11.2: Create Batch from Template

**Steps:**
1. Navigate to **Batches** → **New Batch**
2. Click **"Use Template"**
3. Select `Standard Invoice Template`
4. Provide batch name: `Feb 2024 Invoices`
5. Click **"Create"**

**Expected Results:**
- ✅ Batch inherits template extraction config
- ✅ Validation rules applied automatically
- ✅ Export settings pre-configured
- ✅ `metadata.template_id` references template

**Validation:**
```sql
SELECT 
  batch_name,
  metadata->>'template_id' as template_id,
  metadata->>'template_name' as template_name
FROM batches
WHERE batch_name = 'Feb 2024 Invoices';
```

---

#### Test 11.3: Batch Auto-Assignment Rules

**Prerequisites:** `batch_auto_rules` configured

**Steps:**
1. Create auto-assignment rule:
   - Trigger: Document type = `invoice`
   - Condition: `total_amount > 10000`
   - Template: `Standard Invoice Template`
2. Upload invoice with `total_amount = 15000`
3. Check if batch auto-created

**Expected Results:**
- ✅ Batch auto-created when conditions met
- ✅ Template applied automatically
- ✅ Document assigned to batch

---

### Test 12: Batch Status Workflow

#### Test 12.1: Status Transitions

**Test complete workflow:**

1. **new** → **processing**
   - Upload first document
   - Verify status changes

2. **processing** → **validation**
   - Wait for all documents to process
   - Verify status changes when `processed_documents = total_documents`

3. **validation** → **completed**
   - Validate all documents
   - Verify status changes when `validated_documents = total_documents`

4. **completed** → **exported**
   - Export batch
   - Verify `exported_at` timestamp set

**Validation:**
```sql
SELECT 
  batch_name,
  status,
  total_documents,
  processed_documents,
  validated_documents,
  started_at,
  completed_at,
  exported_at
FROM batches
ORDER BY created_at DESC
LIMIT 1;
```

---

#### Test 12.2: Error State Handling

**Steps:**
1. Upload document that causes OCR error
2. Verify batch handles error gracefully
3. Check `error_count` increments
4. Verify batch doesn't get stuck

**Expected Results:**
- ✅ `error_count` increments
- ✅ Batch continues processing other docs
- ✅ Failed document flagged for review
- ✅ Batch can still complete

---

### Test 13: Batch Assignment & Collaboration

#### Test 13.1: Reassign Batch

**Steps:**
1. Create batch assigned to User A
2. As admin, reassign to User B
3. Verify both users see update

**Expected Results:**
- ✅ User A sees batch removed from queue
- ✅ User B sees batch in queue
- ✅ Audit log entry created

---

#### Test 13.2: Batch Collaboration (Comments)

**Steps:**
1. User A opens batch
2. User A adds comment: "Need to verify vendor names"
3. User B receives notification
4. User B replies to comment
5. User A sees reply

**Expected Results:**
- ✅ Comments stored in database
- ✅ Real-time updates (if enabled)
- ✅ Notification system works

---

## Part 4: Document Upload & Processing

### Test 14: Document Upload (Single & Bulk)

#### Test 14.1: Single Document Upload

**Steps:**
1. Navigate to batch
2. Click **"Upload Documents"**
3. Select single PDF file
4. Wait for upload
5. Verify document appears in batch

**Expected Results:**
- ✅ Document uploaded to storage bucket
- ✅ Database record created
- ✅ File accessible via URL
- ✅ OCR job queued automatically

**Validation:**
```sql
SELECT 
  file_name,
  file_type,
  file_url,
  batch_id,
  uploaded_by,
  created_at
FROM documents
WHERE file_name = '[uploaded-filename]';
```

---

#### Test 14.2: Bulk Document Upload

**Steps:**
1. Select 20 documents (mix of PDF and images)
2. Upload all at once
3. Monitor upload progress
4. Wait for all uploads to complete

**Expected Results:**
- ✅ All 20 documents uploaded
- ✅ Progress indicator shows accurate count
- ✅ No upload failures
- ✅ All documents queued for OCR

**Performance:**
- Target: < 2 seconds per document upload
- Total time for 20 docs: < 40 seconds

---

#### Test 14.3: Supported File Types

**Test each supported format:**

| Format | Extension | Test File |
|--------|-----------|-----------|
| PDF | .pdf | invoice.pdf |
| JPEG | .jpg, .jpeg | scan.jpg |
| PNG | .png | form.png |
| TIFF | .tif, .tiff | document.tif |
| HEIC | .heic | photo.heic |

**Steps:**
1. Upload one file of each type
2. Verify acceptance
3. Check OCR processing works

**Expected Results:**
- ✅ All formats accepted
- ✅ OCR processes each correctly
- ✅ Thumbnails generated (if applicable)

---

#### Test 14.4: File Size Limits

**Test file size handling:**

1. **Within limit (< 10MB):** Should succeed
2. **At limit (10MB):** Should succeed
3. **Over limit (15MB):** Should reject with error

**Expected Results:**
- ✅ Files under limit accepted
- ✅ Files over limit rejected
- ✅ Clear error message displayed
- ✅ No partial uploads

---

#### Test 14.5: Duplicate File Detection

**Steps:**
1. Upload document `invoice_001.pdf`
2. Attempt to upload same file again
3. Check duplicate detection warning

**Expected Results:**
- ✅ Warning: "Similar document already exists"
- ✅ Option to upload anyway or cancel
- ✅ Duplicate detection based on hash or filename

---

### Test 15: Mobile Capture

#### Test 15.1: Mobile Camera Capture

**Prerequisites:** Mobile device or browser dev tools mobile mode

**Steps:**
1. Navigate to batch on mobile
2. Click **"Capture Document"**
3. Allow camera permissions
4. Position document in frame
5. Capture photo
6. Review and confirm
7. Upload captured image

**Expected Results:**
- ✅ Camera opens correctly
- ✅ Image captured
- ✅ Preview shows captured image
- ✅ Upload succeeds
- ✅ OCR processes mobile photo

---

#### Test 15.2: Image Enhancement

**Steps:**
1. Capture document with poor lighting
2. Enable auto-enhancement
3. Compare before/after
4. Upload enhanced image

**Expected Results:**
- ✅ Auto-enhancement improves clarity
- ✅ Better OCR results
- ✅ Enhanced image stored

---

### Test 16: Scanner Integration

#### Test 16.1: Scanner Auto-Import Setup

**Prerequisites:** Scanner sync agent installed

**Steps:**
1. Navigate to **Admin** → **Scanner Auto-Import**
2. Click **"Add Scanner Config"**
3. Configure:
   - Scanner Folder Path: `C:\ScannedDocs`
   - Project: `Invoice Processing`
   - Auto-Create Batch: `Yes`
   - Batch Name Template: `Scanner Import {{date}}`
   - Delete After Import: `No`
4. Enable **"Active"**
5. Save configuration

**Expected Results:**
- ✅ Configuration saved
- ✅ Scanner agent connects
- ✅ Status shows "Active"

---

#### Test 16.2: Auto-Import Workflow

**Steps:**
1. Place PDF in scanner folder
2. Wait for scanner agent to detect
3. Verify file imported
4. Check batch created
5. Verify OCR triggered

**Expected Results:**
- ✅ File detected within 30 seconds
- ✅ Batch auto-created
- ✅ Document uploaded
- ✅ OCR queued
- ✅ File deleted from scanner folder (if configured)

**Validation:**
```sql
SELECT 
  config_id,
  file_name,
  batch_id,
  status,
  imported_at,
  error_message
FROM scanner_import_logs
ORDER BY imported_at DESC
LIMIT 10;
```

---

#### Test 16.3: Scanner Error Handling

**Steps:**
1. Place invalid file in scanner folder (e.g., .txt file)
2. Wait for scanner agent
3. Check error log

**Expected Results:**
- ✅ Invalid file rejected
- ✅ Error logged with reason
- ✅ File not deleted
- ✅ Agent continues monitoring

---

### Test 17: Email Import

#### Test 17.1: Email Import Configuration

**Steps:**
1. Navigate to **Admin** → **Email Import**
2. Click **"New Configuration"**
3. Fill:
   - Email Host: `imap.gmail.com`
   - Port: `993`
   - Username: `documents@company.com`
   - Password: `[app-password]`
   - Use SSL: `Yes`
   - Folder: `INBOX`
   - Project: `Invoice Processing`
   - Delete After Import: `No`
   - Mark as Read: `Yes`
4. Test connection
5. Enable **"Active"**

**Expected Results:**
- ✅ Connection test succeeds
- ✅ Configuration saved
- ✅ Email checking scheduled

---

#### Test 17.2: Email Import Workflow

**Steps:**
1. Send email to configured address
2. Attach PDF document
3. Subject: `Invoice from Vendor XYZ`
4. Wait for import process (runs every 5 minutes)
5. Check batch for imported document

**Expected Results:**
- ✅ Email detected
- ✅ Attachment extracted
- ✅ Document uploaded
- ✅ Batch created (if auto-create enabled)
- ✅ Email marked as read

**Validation:**
```sql
SELECT 
  email_subject,
  email_from,
  file_name,
  batch_id,
  status,
  imported_at
FROM email_import_logs
ORDER BY imported_at DESC
LIMIT 5;
```

---

#### Test 17.3: Multiple Attachments

**Steps:**
1. Send email with 3 PDF attachments
2. Wait for import
3. Verify all imported

**Expected Results:**
- ✅ All 3 attachments imported
- ✅ 3 documents created
- ✅ All assigned to same batch

---

### Test 18: Fax Import

#### Test 18.1: Fax Configuration (Twilio)

**Prerequisites:** Twilio account with fax number

**Steps:**
1. Navigate to **Admin** → **Fax Import**
2. Configure:
   - Twilio Phone Number: `+1-555-0123`
   - Project: `Invoice Processing`
   - Auto-Create Batch: `Yes`
3. Save

**Expected Results:**
- ✅ Configuration saved
- ✅ Webhook URL generated
- ✅ Ready to receive faxes

---

#### Test 18.2: Receive Fax

**Steps:**
1. Send fax to configured number
2. Wait for Twilio webhook
3. Check fax logs
4. Verify document imported

**Expected Results:**
- ✅ Fax received via Twilio
- ✅ PDF generated
- ✅ Document uploaded
- ✅ Batch created
- ✅ OCR triggered

**Validation:**
```sql
SELECT 
  from_number,
  to_number,
  num_pages,
  status,
  batch_id,
  document_id,
  received_at
FROM fax_logs
ORDER BY received_at DESC
LIMIT 5;
```

---

### Test 19: Hot Folder Import

#### Test 19.1: Hot Folder Setup

**Steps:**
1. Navigate to **Admin** → **Hot Folder**
2. Configure:
   - Folder Path: `/shared/invoices/inbox`
   - Project: `Invoice Processing`
   - File Pattern: `*.pdf`
   - Action After Import: `Move to Archive`
   - Archive Folder: `/shared/invoices/archive`
   - Check Interval: `60 seconds`
3. Enable **"Active"**

**Expected Results:**
- ✅ Configuration saved
- ✅ Folder monitoring starts
- ✅ Status shows "Monitoring"

---

#### Test 19.2: Hot Folder Auto-Import

**Steps:**
1. Copy 5 PDFs to hot folder
2. Wait 60 seconds
3. Check import logs
4. Verify documents imported
5. Check archive folder

**Expected Results:**
- ✅ All 5 files detected
- ✅ Documents uploaded
- ✅ Files moved to archive
- ✅ Batch created (if auto-create enabled)

---

## Part 5: OCR & Data Extraction

### Test 20: OCR Processing Tests

#### Test 20.1: Standard OCR (Printed Text)

**Steps:**
1. Upload clear, printed invoice
2. Wait for OCR processing
3. Check extracted text
4. Verify extraction fields populated

**Expected Results:**
- ✅ Text extracted accurately (>95% accuracy)
- ✅ Key fields identified correctly
- ✅ Confidence score >0.85
- ✅ Processing time <5 seconds

**Validation:**
```sql
SELECT 
  file_name,
  LENGTH(extracted_text) as text_length,
  confidence_score,
  jsonb_pretty(extracted_metadata) as metadata
FROM documents
WHERE id = '[document-id]';
```

---

#### Test 20.2: Handwritten Text OCR

**Steps:**
1. Upload handwritten form
2. Enable handwriting mode (if applicable)
3. Process document
4. Check accuracy

**Expected Results:**
- ✅ Handwriting detected
- ✅ Text extracted (lower accuracy expected)
- ✅ Confidence score reflects difficulty (0.60-0.80)
- ✅ Document flagged for review if confidence low

---

#### Test 20.3: Multi-Page PDF

**Steps:**
1. Upload 10-page PDF document
2. Wait for OCR
3. Check text extraction for all pages
4. Verify page separation

**Expected Results:**
- ✅ All 10 pages processed
- ✅ Text from each page extracted
- ✅ Page numbers preserved
- ✅ Processing time scales linearly

---

#### Test 20.4: Poor Quality Scan

**Steps:**
1. Upload low-quality, blurry scan
2. Process with OCR
3. Check confidence score
4. Verify flagged for review

**Expected Results:**
- ✅ OCR attempts extraction
- ✅ Low confidence score (<0.60)
- ✅ `needs_review = true`
- ✅ Document appears in review queue

---

#### Test 20.5: Skewed/Rotated Document

**Steps:**
1. Upload document rotated 90 degrees
2. Enable auto-rotation
3. Process document

**Expected Results:**
- ✅ Document auto-rotated
- ✅ Text extracted correctly
- ✅ Rotation angle logged in metadata

---

### Test 21: Table Extraction

#### Test 21.1: Invoice Line Items

**Prerequisites:** Project configured with table extraction fields

**Steps:**
1. Upload invoice with line items table
2. Configure table fields:
   - Description
   - Quantity
   - Unit Price
   - Total
3. Process document
4. Check `line_items` field

**Expected Results:**
- ✅ Table structure detected
- ✅ All rows extracted
- ✅ Column headers matched to fields
- ✅ Numeric values parsed correctly

**Example Output:**
```json
{
  "line_items": [
    {
      "description": "Widget A",
      "quantity": 10,
      "unit_price": 25.00,
      "total": 250.00
    },
    {
      "description": "Service Fee",
      "quantity": 1,
      "unit_price": 100.00,
      "total": 100.00
    }
  ]
}
```

---

#### Test 21.2: Multi-Page Table

**Steps:**
1. Upload invoice with table spanning multiple pages
2. Process document
3. Verify table rows combined

**Expected Results:**
- ✅ Rows from all pages combined
- ✅ Correct row count
- ✅ No duplicate rows
- ✅ Table continuity preserved

---

### Test 22: Smart Field Detection

#### Test 22.1: Auto-Detect Form Fields

**Steps:**
1. Upload blank form (application form, registration, etc.)
2. Trigger smart field detection
3. Wait for AI analysis
4. Check `detected_fields` table

**Expected Results:**
- ✅ Form fields auto-detected
- ✅ Field types inferred (text, number, date, etc.)
- ✅ Field names generated
- ✅ Bounding boxes captured
- ✅ Confidence scores >0.70

**Validation:**
```sql
SELECT 
  field_name,
  field_type,
  confidence,
  auto_detected,
  jsonb_pretty(bounding_box) as bbox
FROM detected_fields
WHERE document_id = '[document-id]'
ORDER BY confidence DESC;
```

---

#### Test 22.2: ML Template Auto-Creation

**Steps:**
1. Upload multiple documents of same type (e.g., 5 W-9 forms)
2. Process all with smart detection
3. Check if ML template created
4. Upload new W-9 form
5. Verify template applied automatically

**Expected Results:**
- ✅ ML template created after detecting pattern
- ✅ Template captures field positions
- ✅ Subsequent documents use template
- ✅ Improved accuracy for repeated forms

**Validation:**
```sql
SELECT 
  template_name,
  document_type,
  accuracy_rate,
  training_data_count,
  jsonb_pretty(field_patterns) as patterns
FROM ml_document_templates
WHERE document_type = 'W-9 Form';
```

---

### Test 23: Confidence Scoring

#### Test 23.1: Field-Level Confidence

**Steps:**
1. Process document
2. Check confidence for each extracted field
3. Identify low-confidence fields

**Expected Results:**
- ✅ Each field has confidence score
- ✅ Scores range 0.0 - 1.0
- ✅ Low confidence fields flagged
- ✅ Overall document confidence calculated

**Validation:**
```sql
SELECT 
  d.file_name,
  ec.field_name,
  ec.extracted_value,
  ec.confidence_score,
  ec.needs_review
FROM extraction_confidence ec
JOIN documents d ON ec.document_id = d.id
WHERE d.id = '[document-id]'
ORDER BY ec.confidence_score ASC;
```

---

#### Test 23.2: Confidence-Based Routing

**Steps:**
1. Configure project with confidence thresholds:
   - High (>0.85): Auto-validate
   - Medium (0.60-0.85): Standard queue
   - Low (<0.60): Priority review queue
2. Process documents with varying quality
3. Check queue assignment

**Expected Results:**
- ✅ High-confidence docs auto-validated
- ✅ Medium routed to standard queue
- ✅ Low routed to priority review
- ✅ Manual review required for low confidence

---

### Test 24: Document Classification

#### Test 24.1: Auto-Classify Document Type

**Prerequisites:** Multiple document classes configured

**Steps:**
1. Create document classes:
   - Invoice
   - Receipt
   - Purchase Order
   - Contract
2. Upload mixed documents
3. Trigger auto-classification
4. Check classification results

**Expected Results:**
- ✅ Documents auto-classified correctly
- ✅ Classification confidence score provided
- ✅ `document_class_id` assigned
- ✅ Incorrect classifications flagged for review

**Validation:**
```sql
SELECT 
  d.file_name,
  dc.name as document_class,
  d.classification_confidence,
  d.classification_metadata
FROM documents d
LEFT JOIN document_classes dc ON d.document_class_id = dc.id
ORDER BY d.created_at DESC
LIMIT 20;
```

---

#### Test 24.2: Classification with Barcode

**Steps:**
1. Configure barcode-based classification
2. Upload document with QR code containing class identifier
3. Process document
4. Verify classification from barcode

**Expected Results:**
- ✅ Barcode detected
- ✅ Class extracted from barcode
- ✅ Document classified correctly
- ✅ Higher confidence than AI classification

---

## Part 6: Validation Workflows

### Test 25: Manual Validation

#### Test 25.1: Validate Single Document

**Steps:**
1. Navigate to **Batches** → Select batch
2. Click on document with status `pending`
3. Review OCR results
4. Correct any errors in extracted fields
5. Click **"Validate"**

**Expected Results:**
- ✅ Document status → `validated`
- ✅ `validated_by` set to current user
- ✅ `validated_at` timestamp recorded
- ✅ Field changes logged
- ✅ Document removed from validation queue

**Validation:**
```sql
SELECT 
  file_name,
  validation_status,
  validated_by,
  validated_at,
  validation_notes
FROM documents
WHERE id = '[document-id]';
```

---

#### Test 25.2: Reject Document

**Steps:**
1. Open document for validation
2. Click **"Reject"**
3. Enter rejection reason: `Illegible scan, requires re-upload`
4. Confirm rejection

**Expected Results:**
- ✅ Status → `rejected`
- ✅ Rejection reason stored
- ✅ Document appears in rejected queue
- ✅ Original uploader notified (optional)

---

#### Test 25.3: Batch Validation

**Steps:**
1. Select 10 documents in batch
2. Click **"Validate Selected"**
3. Confirm bulk validation

**Expected Results:**
- ✅ All selected documents validated
- ✅ Batch `validated_documents` count updates
- ✅ If all docs validated, batch status → `completed`

---

### Test 26: Interactive Document Viewer

#### Test 26.1: View Original Document

**Steps:**
1. Open document for validation
2. View original file in viewer
3. Test zoom in/out
4. Test page navigation (for PDFs)

**Expected Results:**
- ✅ Document loads in viewer
- ✅ Zoom controls work
- ✅ Page navigation works
- ✅ Signed URL used for security

---

#### Test 26.2: Side-by-Side Comparison

**Steps:**
1. Open document
2. Enable side-by-side view
3. Compare original and extracted data
4. Make corrections

**Expected Results:**
- ✅ Original and data shown side-by-side
- ✅ Fields highlighted on image
- ✅ Easy to spot errors
- ✅ Click field to edit

---

#### Test 26.3: Bounding Box Overlay

**Steps:**
1. Open document with word bounding boxes
2. Enable bounding box overlay
3. Hover over extracted fields
4. Verify boxes match text position

**Expected Results:**
- ✅ Bounding boxes drawn on image
- ✅ Boxes align with text
- ✅ Field highlighting works
- ✅ Click box to edit field

---

### Test 27: Field-Level Validation

#### Test 27.1: Data Type Validation

**Test each data type:**

| Field Type | Valid Input | Invalid Input |
|------------|-------------|---------------|
| Number | `1234.56` | `abc123` |
| Date | `2024-01-15` | `13/32/2024` |
| Email | `test@example.com` | `invalid-email` |
| Phone | `(555) 123-4567` | `12345` |
| URL | `https://example.com` | `not-a-url` |

**Expected Results:**
- ✅ Valid inputs accepted
- ✅ Invalid inputs rejected with error
- ✅ Error messages descriptive

---

#### Test 27.2: Required Field Validation

**Steps:**
1. Attempt to validate document
2. Leave required field empty
3. Click **"Validate"**

**Expected Results:**
- ✅ Validation blocked
- ✅ Error: "Invoice Number is required"
- ✅ Field highlighted in red
- ✅ Focus moved to empty field

---

#### Test 27.3: Cross-Field Validation

**Configure validation rule:**
```json
{
  "rule": "invoice_date must be <= today",
  "fields": ["invoice_date"],
  "message": "Invoice date cannot be in the future"
}
```

**Steps:**
1. Enter invoice_date = tomorrow's date
2. Attempt to validate

**Expected Results:**
- ✅ Validation fails
- ✅ Custom error message shown
- ✅ Field highlighted

---

### Test 28: Validation Rules Engine

#### Test 28.1: Create Validation Rule

**Steps:**
1. Navigate to **Admin** → **Validation Rules**
2. Click **"New Rule"**
3. Configure:
   - Rule Name: `Total Amount Range Check`
   - Field: `total_amount`
   - Condition: `value >= 0 AND value <= 100000`
   - Error Message: `Total must be between $0 and $100,000`
   - Severity: `Error`
4. Save rule

**Expected Results:**
- ✅ Rule saved
- ✅ Applied to all validations
- ✅ Rule appears in rules list

---

#### Test 28.2: Test Validation Rule

**Steps:**
1. Open document for validation
2. Enter `total_amount = 150000` (over limit)
3. Attempt to validate

**Expected Results:**
- ✅ Validation fails
- ✅ Error message from rule displayed
- ✅ Cannot validate until corrected

---

#### Test 28.3: Warning-Level Rules

**Create warning rule (non-blocking):**
```json
{
  "rule": "Vendor Name Not in Database",
  "severity": "warning",
  "message": "This vendor is not in our approved list"
}
```

**Steps:**
1. Enter vendor not in lookup table
2. Validate document

**Expected Results:**
- ✅ Warning shown
- ✅ Validation still succeeds
- ✅ Warning logged
- ✅ User can acknowledge and continue

---

### Test 29: Lookup Table Validation

#### Test 29.1: Create Lookup Table

**Steps:**
1. Navigate to **Admin** → **Validation Lookups**
2. Click **"New Lookup Table"**
3. Configure:
   - Name: `Approved Vendors`
   - Type: `SQL Database`
   - Connection String: [provided]
   - Query: `SELECT vendor_id, vendor_name FROM vendors`
4. Test connection
5. Save

**Expected Results:**
- ✅ Connection test succeeds
- ✅ Lookup table created
- ✅ Data loaded from database
- ✅ Available for validation

---

#### Test 29.2: Excel Lookup Validation

**Steps:**
1. Create lookup from Excel:
   - Upload `vendors.xlsx`
   - Map columns: `vendor_name`, `vendor_code`
2. Configure field validation to use lookup
3. Enter vendor name
4. Verify autocomplete

**Expected Results:**
- ✅ Excel data imported
- ✅ Autocomplete suggests matches
- ✅ Invalid entries flagged
- ✅ Validation against lookup works

---

#### Test 29.3: API Lookup

**Configure API lookup:**
```json
{
  "type": "API",
  "endpoint": "https://api.company.com/vendors",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer [token]"
  },
  "responseMapping": {
    "id": "$.data[*].id",
    "name": "$.data[*].name"
  }
}
```

**Steps:**
1. Configure API lookup
2. Test API call
3. Verify data retrieved
4. Use in validation

**Expected Results:**
- ✅ API call succeeds
- ✅ Data parsed correctly
- ✅ Lookup values available
- ✅ Real-time validation works

---

### Test 30: Address Validation

#### Test 30.1: Validate US Address (USPS)

**Prerequisites:** Address validation configured

**Steps:**
1. Open document with address fields
2. Enter address:
   ```
   123 Main Street
   Apt 4B
   New York, NY 10001
   ```
3. Click **"Validate Address"**
4. Review normalized address

**Expected Results:**
- ✅ Address validated via USPS
- ✅ Normalized format returned
- ✅ Suggestions for corrections (if needed)
- ✅ Confidence score provided
- ✅ Validation status stored

**Validation:**
```sql
SELECT 
  document_id,
  validation_status,
  confidence_score,
  jsonb_pretty(original_address) as original,
  jsonb_pretty(normalized_address) as normalized,
  validation_provider
FROM address_validations
WHERE document_id = '[document-id]';
```

---

#### Test 30.2: Invalid Address

**Steps:**
1. Enter invalid address:
   ```
   123 Fake Street
   Invalid City, XX 00000
   ```
2. Attempt validation

**Expected Results:**
- ✅ Validation fails
- ✅ Error: "Address not found"
- ✅ Suggestions provided (if available)
- ✅ User can override or correct

---

### Test 31: Signature Validation

#### Test 31.1: Upload Reference Signature

**Steps:**
1. Navigate to **Admin** → **Signature References**
2. Click **"Add Signature"**
3. Upload signature image for "John Doe"
4. Save reference

**Expected Results:**
- ✅ Signature uploaded
- ✅ Reference signature stored
- ✅ Available for comparison

---

#### Test 31.2: Validate Document Signature

**Steps:**
1. Upload document with signature
2. Enable signature detection
3. Process document
4. Compare detected signature with reference
5. Review match score

**Expected Results:**
- ✅ Signature region detected
- ✅ Comparison with reference performed
- ✅ Match score calculated (0-100%)
- ✅ High match (>80%) auto-validates
- ✅ Low match flags for review

**Validation:**
```sql
SELECT 
  document_id,
  signature_match_score,
  reference_signature_id,
  validation_status,
  metadata
FROM signature_validations
WHERE document_id = '[document-id]';
```

---

## Part 7: Advanced Features

### Test 32: Barcode Detection & Processing

#### Test 32.1: Detect Barcodes

**Steps:**
1. Upload document with barcodes (QR, Code 128, etc.)
2. Enable barcode detection
3. Process document
4. Check detected barcodes

**Expected Results:**
- ✅ All barcodes detected
- ✅ Barcode types identified
- ✅ Decoded values extracted
- ✅ Bounding boxes captured

**Validation:**
```sql
SELECT 
  document_id,
  barcode_type,
  decoded_value,
  position,
  confidence
FROM barcode_detections
WHERE document_id = '[document-id]';
```

---

#### Test 32.2: Barcode-Based Document Separation

**Configure barcode separation:**
```json
{
  "separator_type": "QR Code",
  "pattern": "^DOC-\\d+$",
  "action": "split_document"
}
```

**Steps:**
1. Upload multi-page PDF with separator barcodes
2. Enable barcode separation
3. Process document
4. Verify documents split correctly

**Expected Results:**
- ✅ PDF split at barcode positions
- ✅ Multiple documents created
- ✅ Barcode values used for naming
- ✅ Original preserved (optional)

---

#### Test 32.3: Barcode Classification

**Configure barcode classification:**
```json
{
  "INV-*": "Invoice",
  "PO-*": "Purchase Order",
  "RCP-*": "Receipt"
}
```

**Steps:**
1. Upload documents with classification barcodes
2. Process documents
3. Verify classification

**Expected Results:**
- ✅ Document type set from barcode
- ✅ Correct document class assigned
- ✅ High classification confidence

---

### Test 33: Document Separation

#### Test 33.1: Blank Page Separation

**Steps:**
1. Upload PDF with blank separator pages
2. Enable blank page detection
3. Process document
4. Verify separation

**Expected Results:**
- ✅ Blank pages detected
- ✅ PDF split at blank pages
- ✅ Separator pages removed
- ✅ Individual documents created

---

#### Test 33.2: Page Count Separation

**Configure fixed page separation:**
- Every 3 pages = new document

**Steps:**
1. Upload 12-page PDF
2. Apply page count separation
3. Verify 4 documents created

**Expected Results:**
- ✅ 4 documents created (3 pages each)
- ✅ All pages accounted for
- ✅ Page order preserved

---

### Test 34: Duplicate Detection

#### Test 34.1: Exact Duplicate Detection

**Steps:**
1. Upload document `invoice_001.pdf`
2. Upload same file again
3. Check duplicate detection

**Expected Results:**
- ✅ Duplicate detected
- ✅ Warning shown
- ✅ User can choose: Upload anyway / Skip
- ✅ Duplicate logged

**Validation:**
```sql
SELECT 
  document_id,
  duplicate_document_id,
  duplicate_type,
  similarity_score,
  status
FROM duplicate_detections
ORDER BY created_at DESC
LIMIT 10;
```

---

#### Test 34.2: Field-Based Duplicate Detection

**Configure field matching:**
- Check `invoice_number` and `vendor_name`

**Steps:**
1. Upload invoice with `INV-12345` from `Acme Corp`
2. Upload different PDF with same invoice number and vendor
3. Check duplicate detection

**Expected Results:**
- ✅ Duplicate detected based on fields
- ✅ Both documents shown for comparison
- ✅ Similarity score calculated
- ✅ User can review and decide

---

#### Test 34.3: Fuzzy Duplicate Detection

**Steps:**
1. Upload invoice `invoice_001.pdf`
2. Upload slightly modified version (e.g., rescanned)
3. Enable fuzzy matching
4. Check detection

**Expected Results:**
- ✅ Similar document detected
- ✅ Similarity score 70-95%
- ✅ User review required
- ✅ Side-by-side comparison available

---

### Test 35: Fraud Detection

#### Test 35.1: Detect Altered Document

**Steps:**
1. Upload document with tampered fields
2. Enable fraud detection
3. Process document
4. Check fraud alerts

**Expected Results:**
- ✅ Tampering detected
- ✅ Suspicious regions highlighted
- ✅ Fraud score calculated
- ✅ Document flagged for review

**Validation:**
```sql
SELECT 
  document_id,
  fraud_type,
  severity,
  description,
  details,
  status
FROM fraud_detections
WHERE document_id = '[document-id]';
```

---

#### Test 35.2: Duplicate Signature Detection

**Steps:**
1. Upload multiple documents with identical signatures
2. Enable signature fraud detection
3. Check alerts

**Expected Results:**
- ✅ Identical signatures flagged
- ✅ Documents linked
- ✅ Fraud alert created
- ✅ Manual review required

---

#### Test 35.3: Offensive Language Detection

**Steps:**
1. Upload document with offensive content
2. Enable language filtering
3. Process document
4. Check flags

**Expected Results:**
- ✅ Offensive language detected
- ✅ Document flagged
- ✅ Specific words/phrases identified
- ✅ Review required before processing

---

### Test 36: PII Detection & Redaction

#### Test 36.1: Detect PII

**Steps:**
1. Upload document with PII:
   - Social Security Numbers
   - Credit card numbers
   - Email addresses
   - Phone numbers
2. Enable PII detection
3. Process document
4. Check detected PII

**Expected Results:**
- ✅ All PII detected
- ✅ PII types classified
- ✅ Regions marked
- ✅ `pii_detected = true`

**Validation:**
```sql
SELECT 
  file_name,
  pii_detected,
  jsonb_pretty(detected_pii_regions) as pii_regions
FROM documents
WHERE pii_detected = true
ORDER BY created_at DESC
LIMIT 5;
```

---

#### Test 36.2: Automatic Redaction

**Steps:**
1. Upload document with SSN: `123-45-6789`
2. Enable auto-redaction
3. Process document
4. View redacted document

**Expected Results:**
- ✅ PII automatically redacted
- ✅ Redacted PDF generated
- ✅ Original preserved
- ✅ `redacted_file_url` populated
- ✅ Redaction metadata stored

---

#### Test 36.3: Manual Redaction Tool

**Steps:**
1. Open document with PII
2. Enable redaction mode
3. Draw redaction boxes over sensitive data
4. Apply redactions
5. Generate redacted PDF

**Expected Results:**
- ✅ Redaction boxes drawn
- ✅ Redacted areas blacked out
- ✅ PDF generated with redactions
- ✅ Original untouched

---

#### Test 36.4: Keyword Redaction

**Configure keyword list:**
- `CONFIDENTIAL`
- `INTERNAL ONLY`
- `DO NOT DISTRIBUTE`

**Steps:**
1. Upload document with keywords
2. Enable keyword redaction
3. Process

**Expected Results:**
- ✅ Keywords detected
- ✅ Regions redacted
- ✅ Case-insensitive matching

---

### Test 37: ML Document Templates

#### Test 37.1: Create ML Template

**Steps:**
1. Process 10 similar documents (e.g., W-9 forms)
2. Navigate to **Admin** → **ML Templates**
3. Click **"Train Template"**
4. Select document type: `W-9 Form`
5. Review auto-generated field patterns
6. Click **"Create Template"**

**Expected Results:**
- ✅ Template created
- ✅ Field patterns learned
- ✅ Accuracy rate calculated
- ✅ `training_data_count = 10`

**Validation:**
```sql
SELECT 
  template_name,
  document_type,
  accuracy_rate,
  training_data_count,
  is_active,
  jsonb_pretty(field_patterns) as patterns
FROM ml_document_templates
WHERE document_type = 'W-9 Form';
```

---

#### Test 37.2: Apply ML Template

**Steps:**
1. Upload new W-9 form
2. Process document
3. Verify template applied
4. Check extraction accuracy

**Expected Results:**
- ✅ Template auto-detected
- ✅ Fields extracted using template
- ✅ Higher accuracy than baseline
- ✅ Faster processing time

---

#### Test 37.3: Template Learning

**Steps:**
1. Validate 20 documents with corrections
2. Check if template accuracy improves
3. Verify template updates

**Expected Results:**
- ✅ Template learns from corrections
- ✅ Accuracy rate increases
- ✅ `training_data_count` increments
- ✅ Better performance on subsequent docs

---

### Test 38: Zonal OCR Templates

#### Test 38.1: Create Zone Template

**Steps:**
1. Open blank form
2. Click **"Create Zone Template"**
3. Draw zones for each field:
   - Invoice Number: (100, 50, 200, 20)
   - Date: (300, 50, 150, 20)
   - Total: (100, 400, 150, 30)
4. Name each zone
5. Save template

**Expected Results:**
- ✅ Zones saved with coordinates
- ✅ Template created
- ✅ Available for reuse

---

#### Test 38.2: Apply Zone Template

**Steps:**
1. Upload document matching template
2. Select zone template
3. Process document
4. Verify OCR only extracts from zones

**Expected Results:**
- ✅ OCR targets specific zones
- ✅ Faster processing
- ✅ More accurate extraction
- ✅ No irrelevant text extracted

---

## Part 8: Export & Integration

### Test 39: Export to CSV/JSON/Excel

#### Test 39.1: Export Batch to CSV

**Steps:**
1. Navigate to completed batch
2. Click **"Export"** → **"CSV"**
3. Configure export:
   - Include metadata: Yes
   - Include line items: Yes
   - Filename: `invoices_jan2024.csv`
4. Click **"Export"**
5. Download file

**Expected Results:**
- ✅ CSV file generated
- ✅ All documents included
- ✅ All fields exported
- ✅ Proper CSV formatting
- ✅ File downloadable

**Verify CSV Contents:**
```csv
document_id,invoice_number,invoice_date,vendor_name,total_amount,status
abc123,INV-001,2024-01-15,Acme Corp,1250.00,validated
def456,INV-002,2024-01-16,Widget Inc,875.50,validated
```

---

#### Test 39.2: Export to JSON

**Steps:**
1. Click **"Export"** → **"JSON"**
2. Export batch

**Expected Results:**
- ✅ Valid JSON format
- ✅ Nested structure for metadata
- ✅ Line items as arrays
- ✅ All data types preserved

**Example JSON:**
```json
{
  "batch": {
    "id": "batch-123",
    "name": "January 2024 Invoices",
    "documents": [
      {
        "id": "doc-001",
        "invoice_number": "INV-001",
        "invoice_date": "2024-01-15",
        "vendor_name": "Acme Corp",
        "total_amount": 1250.00,
        "line_items": [
          {
            "description": "Widget A",
            "quantity": 10,
            "unit_price": 125.00,
            "total": 1250.00
          }
        ]
      }
    ]
  }
}
```

---

#### Test 39.3: Export to Excel

**Steps:**
1. Click **"Export"** → **"Excel"**
2. Export batch
3. Open in Excel/LibreOffice

**Expected Results:**
- ✅ Valid .xlsx file
- ✅ Header row formatted
- ✅ Data types preserved (numbers, dates)
- ✅ Multiple sheets if configured:
   - Sheet 1: Documents
   - Sheet 2: Line Items

---

### Test 40: Export to SharePoint

#### Test 40.1: Configure SharePoint Connection

**Steps:**
1. Navigate to **Admin** → **ECM Export** → **SharePoint**
2. Click **"Configure Connection"**
3. Enter:
   - Site URL: `https://company.sharepoint.com/sites/Documents`
   - Access Token: [Microsoft token]
   - Library Name: `Invoices`
4. Test connection
5. Save configuration

**Expected Results:**
- ✅ Connection test succeeds
- ✅ Libraries listed
- ✅ Configuration saved

---

#### Test 40.2: Export Batch to SharePoint

**Steps:**
1. Select completed batch
2. Click **"Export"** → **"SharePoint"**
3. Configure:
   - Target Library: `Invoices`
   - Folder: `/2024/January`
   - Metadata Mapping: [Map fields]
4. Start export

**Expected Results:**
- ✅ Documents uploaded to SharePoint
- ✅ Metadata applied
- ✅ Folder structure created
- ✅ Export log created

**Validation:**
```sql
SELECT 
  batch_id,
  export_type,
  export_status,
  documents_exported,
  export_started_at,
  export_completed_at,
  error_message
FROM export_logs
WHERE export_type = 'sharepoint'
ORDER BY export_started_at DESC;
```

---

### Test 41: Export to Documentum

#### Test 41.1: Configure Documentum

**Steps:**
1. Navigate to **Admin** → **ECM Export** → **Documentum**
2. Configure:
   - Server URL: `https://documentum.company.com`
   - Username: `docadmin`
   - Password: [encrypted]
   - Repository: `MainRepository`
   - Cabinet: `Invoices`
3. Test connection

**Expected Results:**
- ✅ Connection succeeds
- ✅ Repositories listed
- ✅ Cabinets retrieved

---

#### Test 41.2: Export to Documentum

**Steps:**
1. Select batch
2. Export to Documentum
3. Verify documents in Documentum

**Expected Results:**
- ✅ Documents uploaded
- ✅ Documentum object types applied
- ✅ Attributes set from metadata
- ✅ Files accessible in Documentum

---

### Test 42: Export to FileBound

#### Test 42.1: Configure FileBound

**Steps:**
1. Configure FileBound connection:
   - Server: `filebound.company.com`
   - Database: `FileBoundDB`
   - Project: `AP_Invoices`
   - Division: `101`
2. Test connection

**Expected Results:**
- ✅ Connection succeeds
- ✅ Projects listed
- ✅ Fields mapped

---

#### Test 42.2: Export Batch

**Steps:**
1. Export batch to FileBound
2. Verify in FileBound client

**Expected Results:**
- ✅ Documents imported
- ✅ Index fields populated
- ✅ Files stored correctly

---

### Test 43: Scheduled Exports

(Already covered in Part 1 - Tests 6-8)

---

### Test 44: Webhook Integration

#### Test 44.1: Configure Webhook

**Steps:**
1. Navigate to **Admin** → **Webhooks**
2. Click **"New Webhook"**
3. Configure:
   - URL: `https://api.company.com/webhook/documents`
   - Event: `document.validated`
   - Headers:
     ```json
     {
       "Authorization": "Bearer secret-token",
       "Content-Type": "application/json"
     }
     ```
   - Payload Template:
     ```json
     {
       "event": "{{event}}",
       "document_id": "{{document.id}}",
       "batch_id": "{{batch.id}}",
       "metadata": "{{document.metadata}}"
     }
     ```
4. Save webhook

**Expected Results:**
- ✅ Webhook saved
- ✅ Configuration valid
- ✅ Test payload sent successfully

---

#### Test 44.2: Trigger Webhook

**Steps:**
1. Validate a document
2. Check webhook delivery
3. Verify payload received at endpoint

**Expected Results:**
- ✅ Webhook fired on event
- ✅ Payload sent to URL
- ✅ Headers included
- ✅ Response logged

**Validation:**
```sql
SELECT 
  webhook_id,
  event_type,
  payload,
  response_status,
  response_body,
  delivered_at
FROM webhook_deliveries
ORDER BY delivered_at DESC
LIMIT 10;
```

---

#### Test 44.3: Webhook Retry Logic

**Steps:**
1. Configure webhook to failing endpoint
2. Trigger event
3. Check retry attempts

**Expected Results:**
- ✅ Initial delivery fails
- ✅ Retries attempted (3x with backoff)
- ✅ Final failure logged
- ✅ Admin notified

---

## Part 9: Administration

### Test 45: User Management

#### Test 45.1: Create New User (Admin)

**Steps:**
1. Log in as admin
2. Navigate to **Admin** → **Users** → **New User**
3. Fill form:
   - Email: `newuser@company.com`
   - Full Name: `New User`
   - Role: `operator`
   - Password: Auto-generated
4. Send invitation email
5. Click **"Create User"**

**Expected Results:**
- ✅ User created
- ✅ Invitation email sent
- ✅ User appears in users list
- ✅ Role assigned correctly

**Validation:**
```sql
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'newuser@company.com';
```

---

#### Test 45.2: Edit User Role

**Steps:**
1. Navigate to **Admin** → **Users**
2. Select user
3. Click **"Edit"**
4. Change role from `operator` to `admin`
5. Save changes

**Expected Results:**
- ✅ Role updated
- ✅ User gains admin permissions immediately
- ✅ Audit log entry created

---

#### Test 45.3: Deactivate User

**Steps:**
1. Select active user
2. Click **"Deactivate"**
3. Confirm action
4. Attempt login as deactivated user

**Expected Results:**
- ✅ User deactivated
- ✅ Cannot log in
- ✅ Sessions invalidated
- ✅ User data preserved

---

#### Test 45.4: Delete User

**Prerequisites:** Admin account

**Steps:**
1. Select user to delete
2. Click **"Delete User"**
3. Confirm deletion
4. Verify user removed

**Expected Results:**
- ✅ User deleted from auth.users
- ✅ Related data handled (orphaned or anonymized)
- ✅ Cannot be restored (permanent)

---

### Test 46: Customer Management

#### Test 46.1: Create New Customer

**Steps:**
1. Navigate to **Admin** → **Customers** → **New**
2. Fill form:
   - Company Name: `Acme Corporation`
   - Contact Name: `John Smith`
   - Contact Email: `john@acme.com`
   - Phone: `(555) 123-4567`
3. Save customer

**Expected Results:**
- ✅ Customer created
- ✅ Appears in customers list
- ✅ Can be assigned to projects

**Validation:**
```sql
SELECT 
  company_name,
  contact_name,
  contact_email,
  phone,
  created_at
FROM customers
WHERE company_name = 'Acme Corporation';
```

---

#### Test 46.2: Assign License to Customer

**Steps:**
1. Edit customer
2. Navigate to **Licenses** tab
3. Click **"Assign License"**
4. Configure:
   - Plan Type: `Enterprise`
   - Total Documents: `100000`
   - Start Date: `2024-01-01`
   - End Date: `2024-12-31`
5. Generate license key
6. Save

**Expected Results:**
- ✅ License created
- ✅ License key generated
- ✅ Document quota set
- ✅ License active

---

### Test 47: License Management

#### Test 47.1: Monitor License Usage

**Steps:**
1. Navigate to **Admin** → **Licenses**
2. Select license
3. View usage statistics:
   - Total documents: 100,000
   - Used documents: 45,230
   - Remaining: 54,770
4. Check usage trend graph

**Expected Results:**
- ✅ Accurate usage counts
- ✅ Trend visualization
- ✅ Alerts if approaching limit

**Validation:**
```sql
SELECT 
  l.license_key,
  l.total_documents,
  l.remaining_documents,
  COUNT(lu.id) as actual_usage,
  l.status
FROM licenses l
LEFT JOIN license_usage lu ON l.id = lu.license_id
WHERE l.id = '[license-id]'
GROUP BY l.id;
```

---

#### Test 47.2: License Expiration Warning

**Steps:**
1. Create license expiring in 7 days
2. Wait for warning notification
3. Check email/dashboard alert

**Expected Results:**
- ✅ Warning 30 days before expiration
- ✅ Warning 7 days before
- ✅ License disabled on expiration date
- ✅ Grace period (optional)

---

#### Test 47.3: License Over-Usage

**Steps:**
1. Use all remaining documents
2. Attempt to process additional document

**Expected Results:**
- ✅ Error: "License limit exceeded"
- ✅ Document processing blocked
- ✅ Admin notified
- ✅ User prompted to upgrade

---

### Test 48: Audit Trail

#### Test 48.1: View Audit Log

**Steps:**
1. Navigate to **Admin** → **Audit Trail**
2. Filter by:
   - Date range: Last 7 days
   - User: [Select user]
   - Action type: `update`
   - Entity type: `document`
3. Review entries

**Expected Results:**
- ✅ All matching actions listed
- ✅ Details include:
   - Timestamp
   - User
   - Action
   - Entity
   - Old/New values
   - IP address
   - User agent

**Validation:**
```sql
SELECT 
  action_type,
  entity_type,
  entity_id,
  user_id,
  jsonb_pretty(old_values) as old,
  jsonb_pretty(new_values) as new,
  ip_address,
  created_at
FROM audit_trail
WHERE user_id = '[user-id]'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

#### Test 48.2: Export Audit Log

**Steps:**
1. Apply filters
2. Click **"Export to CSV"**
3. Download file
4. Verify completeness

**Expected Results:**
- ✅ CSV includes all filtered records
- ✅ Timestamps in readable format
- ✅ User names resolved
- ✅ JSON data flattened

---

### Test 49: Error Logs

#### Test 49.1: View Error Logs

**Steps:**
1. Navigate to **Admin** → **Error Logs**
2. Review recent errors
3. Click on error for details
4. View stack trace

**Expected Results:**
- ✅ Errors listed chronologically
- ✅ Severity levels visible
- ✅ Stack traces captured
- ✅ User context included

**Validation:**
```sql
SELECT 
  component_name,
  error_message,
  error_stack,
  user_id,
  url,
  created_at
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

---

#### Test 49.2: Error Grouping

**Steps:**
1. View error logs
2. Group by error message
3. Sort by frequency

**Expected Results:**
- ✅ Duplicate errors grouped
- ✅ Count shown for each group
- ✅ Most common errors highlighted

**Query:**
```sql
SELECT 
  error_message,
  component_name,
  COUNT(*) as occurrence_count,
  MAX(created_at) as last_occurred
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message, component_name
ORDER BY occurrence_count DESC;
```

---

### Test 50: Analytics & Reporting

#### Test 50.1: Dashboard Metrics

**Steps:**
1. Navigate to **Admin** → **Dashboard**
2. View metrics:
   - Total documents processed (today/week/month)
   - Average confidence score
   - Documents needing review
   - Processing time trends
   - User activity
3. Check real-time updates

**Expected Results:**
- ✅ Metrics accurate
- ✅ Charts render correctly
- ✅ Data refreshes periodically
- ✅ Drill-down available

---

#### Test 50.2: Custom Reports

**Steps:**
1. Navigate to **Admin** → **Advanced Reports**
2. Create new report:
   - Name: `Monthly Invoice Summary`
   - Date Range: Last month
   - Grouping: By vendor
   - Metrics: Count, Total Amount
   - Filters: Document type = Invoice
3. Run report
4. Export to PDF

**Expected Results:**
- ✅ Report generates
- ✅ Data accurate
- ✅ Visualization clear
- ✅ Exportable

---

#### Test 50.3: Validation Analytics

**Steps:**
1. Navigate to **Admin** → **Validation Analytics**
2. View metrics:
   - Documents by status
   - Average validation time
   - Top validators (by count)
   - Accuracy trends
3. Filter by date range and project

**Expected Results:**
- ✅ Metrics provide insights
- ✅ Charts show trends
- ✅ Filters work correctly
- ✅ Data exportable

---

## Part 10: System Features

### Test 51: Job Queue System

#### Test 51.1: View Job Queue

**Steps:**
1. Navigate to **Admin** → **Queue**
2. View pending jobs
3. Check job details:
   - Job type
   - Priority
   - Status
   - Scheduled for
   - Attempts
4. Monitor job progression

**Expected Results:**
- ✅ All queued jobs listed
- ✅ Sorted by priority
- ✅ Status updates in real-time
- ✅ Completed jobs archived

**Validation:**
```sql
SELECT 
  job_type,
  status,
  priority,
  attempts,
  max_attempts,
  created_at,
  started_at,
  completed_at,
  jsonb_pretty(payload) as payload
FROM jobs
WHERE status IN ('pending', 'processing')
ORDER BY priority DESC, created_at ASC;
```

---

#### Test 51.2: Job Retry Logic

**Steps:**
1. Create job that will fail (e.g., invalid OCR request)
2. Monitor job attempts
3. Verify retry behavior

**Expected Results:**
- ✅ Job retries after failure
- ✅ Exponential backoff applied
- ✅ Max attempts respected (default: 3)
- ✅ Error logged on final failure

---

#### Test 51.3: Job Prioritization

**Steps:**
1. Queue 10 jobs with varying priorities:
   - 3 high priority
   - 5 normal priority
   - 2 low priority
2. Monitor processing order

**Expected Results:**
- ✅ High priority jobs process first
- ✅ Low priority jobs wait
- ✅ FIFO within same priority
- ✅ Starvation prevention (low priority eventually runs)

---

### Test 52: Document Locking

(Already covered in Part 1 - Test 16)

---

### Test 53: Comments & Collaboration

#### Test 53.1: Add Comment to Document

**Steps:**
1. Open document for validation
2. Click **"Add Comment"**
3. Enter: `Please verify vendor address`
4. Enable **"Flag for Review"**
5. Submit comment

**Expected Results:**
- ✅ Comment saved
- ✅ Timestamp and user recorded
- ✅ Document flagged for review
- ✅ Comment visible to all users

**Validation:**
```sql
SELECT 
  document_id,
  user_id,
  comment,
  flag_for_review,
  created_at,
  is_resolved
FROM document_comments
WHERE document_id = '[document-id]'
ORDER BY created_at DESC;
```

---

#### Test 53.2: Reply to Comment

**Steps:**
1. View existing comment
2. Click **"Reply"**
3. Enter reply
4. Submit

**Expected Results:**
- ✅ Reply threaded under original
- ✅ Original commenter notified
- ✅ Conversation visible

---

#### Test 53.3: Resolve Comment

**Steps:**
1. Address issue raised in comment
2. Click **"Resolve"**
3. Optionally add resolution note

**Expected Results:**
- ✅ Comment marked resolved
- ✅ `resolved_by` and `resolved_at` recorded
- ✅ Document review flag cleared (if last comment)
- ✅ Archived from active comments

---

### Test 54: Exception Queue

#### Test 54.1: Create Exception

**Steps:**
1. Document processing fails (e.g., OCR error)
2. Exception auto-created
3. Navigate to **Admin** → **Exception Queue**
4. View exception details

**Expected Results:**
- ✅ Exception created automatically
- ✅ Details captured:
   - Exception type
   - Severity
   - Description
   - Document/batch reference
- ✅ Appears in queue

**Validation:**
```sql
SELECT 
  exception_type,
  severity,
  description,
  status,
  document_id,
  batch_id,
  assigned_to,
  created_at
FROM document_exceptions
WHERE status = 'open'
ORDER BY severity DESC, created_at ASC;
```

---

#### Test 54.2: Assign Exception

**Steps:**
1. Select exception
2. Click **"Assign To"**
3. Select user
4. Add assignment note
5. Save

**Expected Results:**
- ✅ Exception assigned
- ✅ Assignee notified
- ✅ Appears in assignee's queue
- ✅ Status updated

---

#### Test 54.3: Resolve Exception

**Steps:**
1. Open assigned exception
2. Address root cause
3. Click **"Resolve"**
4. Enter resolution notes
5. Confirm

**Expected Results:**
- ✅ Exception marked resolved
- ✅ Resolution notes saved
- ✅ Document unblocked
- ✅ Processing resumes

---

### Test 55: Bulk Operations

#### Test 55.1: Bulk Status Update

**Steps:**
1. Navigate to batch with 20 documents
2. Select 10 documents
3. Click **"Bulk Actions"** → **"Update Status"**
4. Change status to `validated`
5. Confirm

**Expected Results:**
- ✅ All 10 documents updated
- ✅ Batch statistics refresh
- ✅ Audit log entries created (1 per doc)
- ✅ Operation completes quickly (<3 seconds)

---

#### Test 55.2: Bulk Export

**Steps:**
1. Select 50 documents
2. Click **"Export Selected"**
3. Choose format (CSV)
4. Download

**Expected Results:**
- ✅ Only selected documents exported
- ✅ Export completes successfully
- ✅ File contains 50 records

---

#### Test 55.3: Bulk Delete

**Steps:**
1. Select 5 documents
2. Click **"Delete Selected"**
3. Confirm deletion

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Documents deleted from database
- ✅ Files removed from storage
- ✅ Batch counts updated
- ✅ Audit entries created

---

### Test 56: Search & Filtering

#### Test 56.1: Full-Text Search

**Steps:**
1. Navigate to **Batches** or **Documents**
2. Enter search term: `Acme Corporation`
3. Search across all fields

**Expected Results:**
- ✅ Results include documents with "Acme Corporation" in:
   - File name
   - Extracted text
   - Metadata
- ✅ Results highlighted
- ✅ Fast response (<1 second)

---

#### Test 56.2: Advanced Filters

**Steps:**
1. Apply multiple filters:
   - Status: `validated`
   - Date Range: Last 30 days
   - Project: `Invoice Processing`
   - Confidence Score: > 0.80
2. View filtered results

**Expected Results:**
- ✅ All filters applied correctly
- ✅ Results match all criteria
- ✅ Filter combinations work (AND logic)
- ✅ Filter state persists

---

#### Test 56.3: Saved Searches

**Steps:**
1. Configure complex filter
2. Click **"Save Search"**
3. Name: `High-Confidence Invoices`
4. Save
5. Apply saved search later

**Expected Results:**
- ✅ Search saved
- ✅ Available in dropdown
- ✅ Filters restored correctly
- ✅ Can be shared with team

---

## Part 11: Performance & Security

### Test 57: Performance Testing

#### Test 57.1: Load Test - Document Upload

**Prerequisites:** Load testing tool (k6, JMeter)

**Scenario:** 100 concurrent users uploading documents

**Steps:**
1. Configure load test:
   ```javascript
   import http from 'k6/http';
   export let options = {
     vus: 100,
     duration: '5m',
   };
   export default function() {
     const file = open('./test_document.pdf', 'b');
     http.post('https://api.app.com/upload', file);
   }
   ```
2. Run test
3. Monitor metrics:
   - Response time
   - Throughput
   - Error rate
4. Check database performance

**Expected Results:**
- ✅ 95th percentile response time < 2 seconds
- ✅ Error rate < 1%
- ✅ Database connections stable
- ✅ No memory leaks

---

#### Test 57.2: Stress Test - OCR Processing

**Scenario:** Process 1000 documents simultaneously

**Steps:**
1. Queue 1000 OCR jobs
2. Monitor:
   - Job queue depth
   - Processing rate
   - Memory usage
   - CPU usage
3. Verify all complete successfully

**Expected Results:**
- ✅ All jobs complete
- ✅ No timeouts
- ✅ Consistent processing speed
- ✅ System remains responsive

---

#### Test 57.3: Database Query Performance

**Steps:**
1. Run EXPLAIN ANALYZE on critical queries
2. Check execution times
3. Verify index usage

**Critical Queries to Test:**
```sql
-- 1. Batch listing
EXPLAIN ANALYZE
SELECT * FROM batches
WHERE customer_id = '[id]'
  AND status = 'validation'
ORDER BY created_at DESC
LIMIT 50;

-- 2. Document search
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE extracted_text ILIKE '%search term%'
  AND project_id = '[id]'
LIMIT 100;

-- 3. Analytics aggregation
EXPLAIN ANALYZE
SELECT 
  DATE(created_at) as date,
  COUNT(*) as doc_count,
  AVG(confidence_score) as avg_confidence
FROM documents
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at);
```

**Expected Results:**
- ✅ All queries < 100ms
- ✅ Indexes used
- ✅ No sequential scans on large tables
- ✅ Query plans optimal

---

### Test 58: Security Testing

#### Test 58.1: SQL Injection Protection

**Steps:**
1. Attempt SQL injection in search:
   ```
   ' OR '1'='1
   '; DROP TABLE documents; --
   admin'--
   ```
2. Verify blocked/sanitized

**Expected Results:**
- ✅ All attempts fail
- ✅ No database manipulation
- ✅ Input sanitized
- ✅ Errors logged

---

#### Test 58.2: XSS Protection

**Steps:**
1. Attempt XSS in comment field:
   ```html
   <script>alert('XSS')</script>
   <img src=x onerror=alert('XSS')>
   ```
2. Save and view comment

**Expected Results:**
- ✅ Script tags escaped
- ✅ No JavaScript execution
- ✅ Content sanitized on display
- ✅ HTML entities encoded

---

#### Test 58.3: CSRF Protection

**Steps:**
1. Attempt cross-site request without CSRF token
2. Try to modify data from external site

**Expected Results:**
- ✅ Requests rejected without valid token
- ✅ Tokens validated
- ✅ Token expiration enforced

---

#### Test 58.4: File Upload Security

**Steps:**
1. Attempt to upload malicious files:
   - Executable (.exe)
   - PHP script
   - File with double extension (image.jpg.php)
   - File exceeding size limit
2. Verify rejections

**Expected Results:**
- ✅ Only allowed file types accepted
- ✅ File type validated by content, not extension
- ✅ Size limits enforced
- ✅ Malicious files quarantined

---

#### Test 58.5: Authentication Bypass Attempts

**Steps:**
1. Attempt to access protected endpoints without auth
2. Try expired token
3. Attempt token tampering

**Expected Results:**
- ✅ All attempts blocked
- ✅ 401 Unauthorized returned
- ✅ No sensitive data exposed
- ✅ Attempts logged

---

### Test 59: Database Integrity

#### Test 59.1: Referential Integrity

**Steps:**
1. Verify foreign key constraints:
   ```sql
   -- Orphaned documents check
   SELECT COUNT(*)
   FROM documents
   WHERE batch_id NOT IN (SELECT id FROM batches);
   
   -- Orphaned license usage
   SELECT COUNT(*)
   FROM license_usage
   WHERE license_id NOT IN (SELECT id FROM licenses);
   ```

**Expected Results:**
- ✅ No orphaned records
- ✅ Foreign keys enforced
- ✅ Cascading deletes work correctly

---

#### Test 59.2: Data Consistency

**Steps:**
1. Verify batch statistics match reality:
   ```sql
   SELECT 
     b.id,
     b.total_documents as reported,
     COUNT(d.id) as actual,
     b.total_documents - COUNT(d.id) as discrepancy
   FROM batches b
   LEFT JOIN documents d ON b.id = d.batch_id
   GROUP BY b.id
   HAVING b.total_documents != COUNT(d.id);
   ```

**Expected Results:**
- ✅ No discrepancies
- ✅ Counts accurate
- ✅ Triggers maintaining consistency

---

#### Test 59.3: Transaction Integrity

**Steps:**
1. Simulate transaction failure mid-operation
2. Verify rollback works
3. Check no partial data committed

**Expected Results:**
- ✅ All-or-nothing commits
- ✅ No partial updates
- ✅ Database state consistent

---

### Test 60: Storage Testing

#### Test 60.1: Storage Quota Management

**Steps:**
1. Check current storage usage:
   ```sql
   SELECT 
     bucket_id,
     SUM(OCTET_LENGTH(storage.objects.metadata)) as total_size
   FROM storage.objects
   GROUP BY bucket_id;
   ```
2. Upload large files to approach quota
3. Verify quota enforcement

**Expected Results:**
- ✅ Usage tracked accurately
- ✅ Warnings when approaching limit
- ✅ Uploads blocked when quota exceeded

---

#### Test 60.2: File Retention Policy

**Prerequisites:** Retention policy configured (e.g., 365 days)

**Steps:**
1. Check for old files:
   ```sql
   SELECT 
     name,
     created_at,
     EXTRACT(DAY FROM (NOW() - created_at)) as age_days
   FROM storage.objects
   WHERE created_at < NOW() - INTERVAL '365 days';
   ```
2. Run cleanup job
3. Verify old files archived/deleted

**Expected Results:**
- ✅ Files older than retention period removed
- ✅ Important files preserved
- ✅ Cleanup logged

---

#### Test 60.3: Signed URL Security

**Steps:**
1. Generate signed URL for document
2. Access URL (should work)
3. Wait for expiration
4. Attempt access again

**Expected Results:**
- ✅ URL works within validity period
- ✅ URL expires after timeout
- ✅ Expired URL returns 403
- ✅ Cannot be refreshed without re-signing

---

## Test Results Tracking

### Test Execution Log Template

```markdown
| Test ID | Test Name | Status | Notes | Tester | Date |
|---------|-----------|--------|-------|--------|------|
| T01.1 | User Registration | ✅ Pass | - | JD | 2024-11-24 |
| T01.2 | Login Valid Creds | ✅ Pass | - | JD | 2024-11-24 |
| T01.3 | Login Invalid Creds | ✅ Pass | - | JD | 2024-11-24 |
| T14.1 | Single Upload | ❌ Fail | Timeout on large files | JD | 2024-11-24 |
```

---

## Automated Test Scripts

### Full System Health Check (Bash)

```bash
#!/bin/bash

echo "=== WisdM System Health Check ==="
echo "Started: $(date)"
echo ""

# Database connectivity
echo "1. Testing database connection..."
psql -c "SELECT NOW();" && echo "✅ Database OK" || echo "❌ Database FAIL"

# Job queue status
echo "2. Checking job queue..."
PENDING=$(psql -t -c "SELECT COUNT(*) FROM jobs WHERE status='pending';")
echo "Pending jobs: $PENDING"

# Document processing stats
echo "3. Document processing (24h)..."
psql -c "SELECT validation_status, COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY validation_status;"

# Storage usage
echo "4. Storage usage..."
psql -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Error rate
echo "5. Error rate (24h)..."
ERRORS=$(psql -t -c "SELECT COUNT(*) FROM error_logs WHERE created_at > NOW() - INTERVAL '24 hours';")
echo "Errors: $ERRORS"

# License status
echo "6. Active licenses..."
psql -c "SELECT COUNT(*), status FROM licenses GROUP BY status;"

echo ""
echo "=== Health Check Complete ==="
```

### Continuous Monitoring (PostgreSQL Function)

```sql
CREATE OR REPLACE FUNCTION monitor_system_health()
RETURNS TABLE(
  metric VARCHAR,
  value NUMERIC,
  status VARCHAR,
  message TEXT
) AS $$
BEGIN
  -- Check pending jobs
  RETURN QUERY
  SELECT 
    'pending_jobs'::VARCHAR,
    COUNT(*)::NUMERIC,
    CASE WHEN COUNT(*) > 100 THEN 'WARNING' ELSE 'OK' END::VARCHAR,
    'Job queue depth: ' || COUNT(*)::TEXT
  FROM jobs
  WHERE status = 'pending';
  
  -- Check error rate
  RETURN QUERY
  SELECT 
    'error_rate_24h'::VARCHAR,
    COUNT(*)::NUMERIC,
    CASE WHEN COUNT(*) > 50 THEN 'CRITICAL' ELSE 'OK' END::VARCHAR,
    'Errors in last 24h: ' || COUNT(*)::TEXT
  FROM error_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  -- Check licenses
  RETURN QUERY
  SELECT 
    'licenses_expiring_soon'::VARCHAR,
    COUNT(*)::NUMERIC,
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END::VARCHAR,
    'Licenses expiring in 30 days: ' || COUNT(*)::TEXT
  FROM licenses
  WHERE end_date < NOW() + INTERVAL '30 days'
    AND status = 'active';
    
  -- Check document processing
  RETURN QUERY
  SELECT 
    'docs_pending_validation'::VARCHAR,
    COUNT(*)::NUMERIC,
    CASE WHEN COUNT(*) > 500 THEN 'WARNING' ELSE 'OK' END::VARCHAR,
    'Documents awaiting validation: ' || COUNT(*)::TEXT
  FROM documents
  WHERE validation_status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Run monitoring
SELECT * FROM monitor_system_health();
```

---

## Bug Report Template

```markdown
**Bug ID:** BUG-001  
**Test ID:** T14.1  
**Reporter:** John Doe  
**Date:** 2024-11-24  
**Severity:** High

### Description
Single document upload times out for files > 5MB

### Steps to Reproduce
1. Navigate to batch
2. Upload 8MB PDF file
3. Upload hangs after 30 seconds
4. Timeout error displayed

### Expected Behavior
Upload should complete within 10 seconds regardless of size (up to limit)

### Actual Behavior
Upload times out after 30 seconds for files > 5MB

### Environment
- Browser: Chrome 120
- OS: Windows 11
- Server: Production

### Screenshots
[Attach screenshot]

### Logs
```
Error: Upload timeout after 30000ms
File: invoice_large.pdf (8.2 MB)
```

### Suggested Fix
Increase upload timeout to 60 seconds or implement chunked upload

### Priority
P1 - Critical

### Status
Open
```

---

## Test Coverage Summary

| Category | Tests | Pass | Fail | Skip | Coverage |
|----------|-------|------|------|------|----------|
| Authentication | 15 | - | - | - | 100% |
| Project Management | 9 | - | - | - | 100% |
| Batch Management | 10 | - | - | - | 100% |
| Document Upload | 15 | - | - | - | 100% |
| OCR & Extraction | 13 | - | - | - | 100% |
| Validation | 18 | - | - | - | 100% |
| Advanced Features | 17 | - | - | - | 100% |
| Export & Integration | 15 | - | - | - | 100% |
| Administration | 20 | - | - | - | 100% |
| System Features | 15 | - | - | - | 100% |
| Performance & Security | 12 | - | - | - | 100% |
| **TOTAL** | **159** | **-** | **-** | **-** | **100%** |

---

**END OF COMPREHENSIVE TEST SUITE**

For questions or issues, contact: support@wisdm.app
