# Petition Processing Demonstration Guide

This guide will help you set up and demonstrate the complete petition processing workflow in WISDM Capture Pro.

## Overview

Process initiative petitions by automatically extracting signer information, validating against voter registration records, and verifying signatures using AI-powered analysis.

---

## Step 1: Create the Petition Processing Project

### Project Settings:
1. Navigate to **Admin → Projects → New Project**
2. Configure the following:

**Basic Information:**
- **Project Name:** `Petition Processing`
- **Description:** `Initiative petition processing with signature verification and voter validation`
- **Customer:** Select your customer/tenant

**Enable Features:**
- ✅ **Enable Signature Verification** - AI-powered signature detection and validation
- ✅ **Enable Table Extraction** - Automatically extract all petition rows

---

## Step 2: Configure Extraction Fields

Set up these fields to extract from each petition row:

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `Printed_Name` | Text | Yes | Voter's printed name |
| `Signature` | Signature | Yes | Voter's signature image |
| `Address` | Text | Yes | Residence address only |
| `City` | Text | Yes | City name |
| `Zip` | Text | Yes | ZIP code |
| `Date_Signed` | Date | No | Date signature was obtained |
| `Petition_Number` | Text | No | Petition page identifier |

**Field Validation Rules:**
- `Printed_Name`: Min 2 characters, letters and spaces only
- `Zip`: Exactly 5 digits
- `Signature`: Must have detectable signature present

---

## Step 3: Set Up Validation Lookup (Excel or CSV)

### Prepare Voter Registration Database

1. **Download Sample Template:**
   - Sample CSV file available at: `/downloads/voter-registration-sample.csv`
   - Contains columns: `Voter_Name`, `Address`, `City`, `Zip`, `Registration_Status`, `County`, `Registration_Date`

2. **Upload Your Voter Database:**
   - Go to **Project Settings → Validation Lookup**
   - Select **CSV** or **Excel** as validation source
   - Upload your voter registration CSV/Excel file
   - Map the columns:
     - WISDM `Printed_Name` → Database `Voter_Name`
     - WISDM `Address` → Database `Address`
     - WISDM `City` → Database `City`
     - WISDM `Zip` → Database `Zip`

3. **Validation Logic:**
   - System will auto-validate each extracted name against the database
   - Flags unregistered voters for review
   - Highlights address mismatches
   - Shows registration status (Active/Inactive)

---

## Step 4: Configure Signature Verification

### Reference Signature Setup

For petition signature verification, you can:

1. **Upload Reference Signatures** (Optional):
   - Go to **Project Settings → Signature References**
   - Upload sample signatures for known voters
   - Link to Entity Type: `Voter`
   - Link to Entity ID: Voter Registration Number

2. **Signature Validation Modes:**
   - **Detection Only:** Verify a signature is present
   - **With Reference:** Compare against uploaded reference signatures
   - **Strict Mode:** Require high similarity scores

### How Signature Verification Works:
- AI analyzes each signature image
- Detects presence and quality of signature
- Extracts characteristics (stroke patterns, flow, complexity)
- Compares against reference if available
- Provides confidence score and recommendation (Accept/Review/Reject)

---

## Step 5: Process Petitions

### Upload and Scan:
1. **Create New Batch:**
   - Go to **Batches → New Batch**
   - Select `Petition Processing` project
   - Upload petition PDF files
   - System will automatically separate pages

2. **AI Extraction:**
   - OCR extracts all text and signatures
   - Table extraction captures all petition rows
   - Each row becomes a separate validation record

3. **Automatic Validation:**
   - Excel lookup validates voter registration
   - Signature verification checks each signature
   - Confidence scores calculated for all fields

### Validation Workflow:
1. **Review Queue:** Documents flagged for review appear first
2. **Validation Screen:** Shows extracted data with confidence indicators
3. **Signature Viewer:** Click signature to see detailed analysis
4. **Smart Suggestions:** AI suggests corrections for low-confidence fields
5. **Bulk Actions:** Approve/reject multiple signatures at once

---

## Step 6: Export Results

### Export Options:
- **CSV Export:** All extracted data with validation results
- **Excel Export:** Formatted spreadsheet with signature status
- **JSON/XML Export:** Structured data for system integration
- **PDF Report:** Summary of validated vs. rejected signatures
- **Database Export:** Push to SQL Server, FileBound, SharePoint, or DocMgt

### Export Fields Include:
- All extracted petition data
- Validation status (Registered/Not Registered)
- Signature verification results
- Confidence scores
- Review flags and notes
- Validator name and timestamp

---

## Demo Workflow Example

### Sample Petition Processing Flow:

1. **Upload:** 50-page petition PDF with 5 signatures per page (250 total)
2. **Extract:** AI processes in ~2-3 minutes, extracts all 250 records
3. **Validate:** 
   - 230 names found in voter database (92%)
   - 20 names flagged for review (8%)
   - 245 signatures detected (98%)
   - 5 missing/unclear signatures flagged
4. **Review:** 
   - Validator reviews flagged records
   - Adds notes for questionable signatures
   - Approves valid signatures
5. **Export:** 
   - Generate validation report
   - Export to county election system
   - Archive batch with audit trail

---

## Key Features to Demonstrate

### AI-Powered Capabilities:
- ✨ **Smart Extraction:** Handles handwriting variations
- ✨ **Signature Detection:** Finds signatures even in complex layouts
- ✨ **Validation Intelligence:** Fuzzy matching for name variations (e.g., "Bob Smith" matches "Robert Smith")
- ✨ **Confidence Scoring:** Visual indicators for data quality
- ✨ **Auto-flagging:** Automatically flags suspicious entries

### Efficiency Metrics:
- ⚡ **Speed:** Process 250 signatures in ~3 minutes
- ⚡ **Accuracy:** 95%+ extraction accuracy on clear petitions
- ⚡ **Validation:** Instant voter lookup across thousands of records
- ⚡ **Collaboration:** Multiple validators can work simultaneously

### Compliance Features:
- 🔒 **Audit Trail:** Complete history of all changes
- 🔒 **User Roles:** Control access by permission level
- 🔒 **Signature Capture:** Maintains original signature images
- 🔒 **Tamper Detection:** Flags potential alterations

---

## Troubleshooting Tips

### Common Issues:

**Low Extraction Accuracy:**
- Ensure petition scans are at least 300 DPI
- Use color or grayscale scans (not pure black/white)
- Verify table boundaries are being detected correctly

**Signature Not Detected:**
- Check if signature is in expected location
- Ensure signature is dark enough (not too light)
- Try adjusting signature confidence threshold

**Validation Mismatches:**
- Check for spelling variations in voter database
- Verify address formatting is consistent
- Consider fuzzy matching for name variations

**Performance Issues:**
- Process petitions in batches of 100 pages or less
- Enable parallel processing for large jobs
- Consider upgrading OCR model for better accuracy

---

## Sample Files

- **Sample Petition:** `/downloads/sample-petition.pdf`
- **Voter Database Template (CSV):** `/downloads/voter-registration-sample.csv`
- **Setup Guide:** This document

---

## Support Resources

- **Training Videos:** Available in Help → Training
- **API Documentation:** `/api-docs` for integration
- **User Manual:** Complete system documentation
- **Contact Support:** For technical assistance

---

## Next Steps

1. ✅ Create the Petition Processing project
2. ✅ Upload the voter registration database (CSV or Excel)
3. ✅ Configure signature verification settings
4. ✅ Process a test petition batch
5. ✅ Review validation results
6. ✅ Export and analyze data

**Ready to start processing petitions!** 🎉
