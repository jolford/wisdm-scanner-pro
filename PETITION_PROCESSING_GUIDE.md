# Petition Processing Guide - Parascript-Style Workflow

Your WISDM system now processes petitions with world-class capabilities matching Parascript FormXtra.AI.

## 🚀 Quick Start: Implementing Petition Processing

To enable advanced petition processing features in your project, follow these steps:

### **Enable Required Features**

1. **Navigate to Project Settings:**
   - Go to **Admin → Projects → [Your Petition Project] → Edit**
   - Open the **Processing & AI** tab

2. **Enable Signature Verification:**
   - ✅ Check "Enable Signature Verification"
   - This activates signature comparison and validation features

3. **Configure Table Extraction** (See detailed steps below in Section 1A)

4. **Configure Validation Lookups** (See detailed steps below in Section 1B)

5. **Save Changes** and you're ready to process petitions!

### **Features Automatically Enabled:**

✅ **Address Validation** - Normalizes and validates addresses using intelligent parsing with ZIP/state checks  
✅ **Duplicate Detection** - Jaro-Winkler name matching (85% threshold) + Levenshtein address matching (90% threshold)  
✅ **Fraud Pattern Detection** - Identifies suspicious patterns like repeated addresses, time bursts, and identical handwriting  
✅ **Enhanced Signature Comparison** - Stores comparison results with similarity scores and recommendations  
✅ **Batch & Cross-Batch Checking** - Finds duplicates within or across petition batches  

---

## Complete Workflow

### 1. **Project Setup** (One-time configuration)

#### A. Configure Table Extraction
Navigate to: **Admin → Projects → Your Petition Project → Edit**

**Table Extraction tab:**
- Enable table extraction
- Add fields for each signer row:
  - `Printed_Name` (text)
  - `Signature` (text) 
  - `Address` (text)
  - `City` (text)
  - `Zip` (text)
  - `Date_Signed` (date)

#### B. Configure Validation Lookups
**Validation Lookups accordion:**
1. ✅ Check "Enable validation lookups"
2. Select **"CSV File"** as system
3. Upload your **voter registration CSV**
4. After upload, page will reload showing:
   - **Key Column dropdown** → Select the CSV column with voter names (e.g., "Voter_Name")
   - **Lookup Field Configuration section** with "Add Field" button

5. **Map petition fields to CSV columns:**
   - Click "Add Field" for each mapping:
     - WISDM Field: `Printed_Name` → CSV Column: `Voter_Name`
     - WISDM Field: `Address` → CSV Column: `Address`
     - WISDM Field: `City` → CSV Column: `City`
     - WISDM Field: `Zip` → CSV Column: `Zip`

6. **Save Changes**

### 2. **Processing a Petition** (Runtime)

#### Step 1: Upload Petition Document
- Go to **Scan** or **Queue** tab
- Select your petition project
- Upload petition image/PDF
- System automatically:
  - Extracts each signer row into `line_items` table
  - Performs OCR on all fields
  - Stores extracted data with confidence scores

#### Step 2: Validation Screen
Navigate to the **Validation** tab - you'll see multiple validation sections:

---

#### **🔍 Petition Validation Warnings Section** (NEW - Auto-displayed)

This section automatically appears for petition documents and provides:

**Address Validation Results:**
- Shows validation status: Valid ✅ / Invalid ⚠️ / Corrected 🔄 / Unverified ❓
- Displays confidence score percentage
- Shows normalized address (corrected format)
- Provider information (Internal/USPS)
- Button to re-validate if needed

**Duplicate Detection Alerts:**
- Displays potential duplicates found
- Shows similarity scores for each match
- Breakdown by field (name similarity, address similarity)
- Actions available:
  - "Not Duplicate" - Dismiss false positive
  - "Confirm Duplicate" - Mark as actual duplicate
- Button to re-check for duplicates

**Fraud Pattern Detection:** (Phase 2)
- Identical handwriting warnings
- Repeated address alerts
- Time burst detection
- Incomplete data flags
- Severity indicators (High/Medium/Low)

---

#### **💡 AI Smart Validation Section**

- Click "Validate All" or the 💡 lightbulb next to individual fields
- AI validates extracted data quality and suggests corrections
- Provides confidence scores for each field

---

#### **✍️ Signature Verification Section**
- Upload signature images (cropped from document or separate files)
- Compare against reference signatures (if configured)
- System provides:
  - Signature detection confirmation
  - Match/No Match determination
  - Similarity percentage
  - Recommendation (Accept/Review/Reject)
  - Detailed analysis of similarities and differences
- Results stored in `signature_comparisons` table

---

#### **📋 Line Item Validation Section** (CSV/Excel Lookup)
- Displays: "Validate X signer(s) against CSV registry"
- Click **"Validate All X Items"** button
- System processes each signer:
  1. Looks up name in voter registration CSV
  2. Compares all mapped fields (Address, City, Zip)
  3. Shows validation results for each person

**Validation Results Display:**
Each signer row shows:
- ✅ **Valid** (green) - Found in registry, all fields match
- ⚠️ **Mismatch** (yellow) - Found but some fields don't match
  - Shows document value vs. registry value
  - Provides correction suggestions
- ❌ **Not Found** (red) - Name not in voter registry

**Field-by-Field Results:**
For mismatches, see detailed comparison:
```
Printed_Name: John Smith ✅
Address: 
  Document: 123 Main St
  Registry: 123 Main Street
  Suggestion: Use "123 Main Street"
City: Sacramento ✅
Zip: 95814 ✅
```

### 3. **Taking Action**

Based on validation results:
- **All Valid** → Click "Validate" to approve
- **Mismatches** → Review suggestions, correct data, re-validate
- **Not Found** → Flag for manual review or rejection

---

## 🎯 Key Features (Exceeding Parascript)

### **Data Extraction & Validation:**
✅ **Automatic Line Item Extraction** - Each signer row extracted as structured data in `line_items` table  
✅ **Voter Count Tracking** - Automatic count of total signers  
✅ **Address Validation** - Intelligent address parsing with ZIP/state verification  
✅ **CSV/Excel Lookup** - Validates against voter registration databases  
✅ **Batch Validation** - Process all signers simultaneously  
✅ **Mismatch Highlighting** - Visual indicators for non-matching fields  
✅ **Smart Corrections** - AI-powered suggestions from registry data  
✅ **Confidence Scoring** - Per-field confidence percentages  

### **Duplicate & Fraud Detection:**
✅ **Within-Batch Duplicates** - Detects duplicate signers in same petition  
✅ **Cross-Batch Duplicates** - Finds duplicates across multiple petitions  
✅ **Name Similarity** - Jaro-Winkler algorithm (85% threshold)  
✅ **Address Similarity** - Levenshtein distance (90% threshold)  
✅ **Signature Comparison** - Optional signature image matching  
✅ **Fraud Heuristics** - Identifies suspicious patterns automatically  

### **Signature Verification:**
✅ **AI-Powered Signature Matching** - Visual comparison using AI vision  
✅ **Reference Library** - Store and manage reference signatures  
✅ **Auto-Match by ID** - Links signatures to voter IDs automatically  
✅ **Similarity Scores** - Percentage match with accept/review/reject recommendations  
✅ **Audit Trail** - All comparisons logged in database  

### **Advanced Detection (Phase 2):**
✅ **Identical Handwriting** - Flags suspiciously similar signatures  
✅ **Repeated Addresses** - Alerts when same address used by multiple signers  
✅ **Time Burst Patterns** - Detects unusual clustering of signature dates  
✅ **Outlier Signatures** - Identifies suspiciously short or incomplete entries  
✅ **Missing Data** - Highlights incomplete required fields

---

## 🔧 How The System Works

### **Database Tables Created:**

1. **`address_validations`** - Stores address verification results
   - Original vs. normalized addresses
   - Confidence scores
   - Validation provider details

2. **`duplicate_detections`** - Tracks duplicate signer records
   - Similarity scores by field
   - Status (pending/confirmed/dismissed)
   - Cross-reference to both documents

3. **`fraud_detections`** - Fraud pattern alerts
   - Alert type and severity
   - Affected line items
   - Review status

4. **`signature_comparisons`** - Signature validation history
   - Match results and similarity scores
   - Reference signature used
   - AI recommendations

### **Edge Functions Available:**

- **`validate-address`** - Normalizes and validates addresses
- **`detect-duplicates`** - Finds duplicate signers (configurable thresholds)
- **`detect-fraud-patterns`** - Analyzes for suspicious patterns
- **`validate-signature`** - Compares signatures using AI vision

### **Validation Workflow:**

```
Upload Petition → OCR Extraction → Line Items Created
                      ↓
    ┌─────────────────┴─────────────────┐
    ↓                 ↓                 ↓
Address         Duplicate          Signature
Validation      Detection          Verification
    ↓                 ↓                 ↓
    └─────────────────┬─────────────────┘
                      ↓
              Validation Screen
              (All Results Shown)
                      ↓
            User Reviews & Approves
                      ↓
              Mark Valid/Invalid
```

---

## 📋 Troubleshooting

**"Add Field" button not visible:**
1. Make sure CSV file uploaded successfully (shows "File Ready")
2. Click "Save Changes" at bottom
3. Navigate away and back to project edit page
4. Re-expand "Validation Lookups" section
5. Field mapping section should now appear below "File Ready"

**Line Item Validation not showing:**
- Verify Table Extraction is enabled with correct field names
- Make sure petition document has been scanned with table extraction
- Check that `line_items` were extracted (visible in database)

**Validation finds no matches:**
- Check Key Column selection matches your CSV structure
- Verify CSV column names match exactly (case-sensitive)
- Ensure printed names format matches CSV format

---

## 🔄 Advanced: Fully Automated Workflow

For hands-free petition processing, configure:

### **Step 1: Enable Hot Folder Monitoring**
- Admin → Projects → Hot Folder Setup
- Point to network share or scanner output folder
- System automatically imports new petitions

### **Step 2: Configure Auto-Export**
- Admin → Projects → Export & Integration tab
- Select target ECM system (FileBound, SharePoint, etc.)
- Map fields to destination system

### **Step 3: Set Processing Rules**
- Define acceptance criteria (e.g., "Auto-approve if no warnings")
- Set review triggers (e.g., "Flag for review if duplicates found")
- Configure notification preferences

### **Automated Workflow:**
```
Scanner/Email → Hot Folder → Auto-Import
                    ↓
          OCR + Table Extraction
                    ↓
    Address Validation + Duplicate Check
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   No Issues               Has Warnings
        ↓                       ↓
  Auto-Approve          Queue for Review
        ↓                       ↓
  Auto-Export           Manual Validation
                              ↓
                        Export When Approved
```

**This exceeds Parascript capabilities with intelligent auto-routing!**

---

## 🆚 Comparison: WISDM vs. Parascript FormXtra.AI

| Feature | Parascript | WISDM |
|---------|-----------|-------|
| Table Extraction | ✅ Yes | ✅ Yes |
| Address Validation | ✅ Yes | ✅ Yes + Intelligent parsing |
| Duplicate Detection | ✅ Yes | ✅ Yes + Cross-batch |
| Signature Verification | ✅ Yes | ✅ Yes + AI vision |
| Voter Registry Lookup | ✅ Yes | ✅ Yes + Fuzzy matching |
| Fraud Detection | ❌ No | ✅ Yes - Multiple heuristics |
| Auto-Routing | ❌ Limited | ✅ Yes - Rule-based |
| Cloud-Based | ❌ No | ✅ Yes |
| API Access | ⚠️ Complex | ✅ Simple REST API |
| **Price** | **$$$** | **$** |

---

## 📞 Support & Resources

**Documentation:**
- API Docs: `/api-docs` in your WISDM instance
- Video Tutorials: Training section
- Sample Files: Available in `/public/downloads/`

**Need Help?**
- Check the Help section in-app
- Review Audit Trail for processing history
- Contact support with document ID for specific issues

**Sample Files Available:**
- `sample-petition.pdf` - Example petition document
- `voter-registration-sample.csv` - Sample registry format
- `SCANNER_SYNC_SETUP.md` - Physical scanner integration guide

---

## 🎓 Best Practices

1. **Test with samples first** - Use provided sample files to verify setup
2. **Review thresholds** - Adjust duplicate detection sensitivity if needed
3. **Train AI with corrections** - System learns from your fixes
4. **Monitor accuracy** - Check Analytics tab for validation metrics
5. **Back up registry files** - Keep copies of voter registration CSVs
6. **Regular audits** - Review flagged items periodically
7. **Document exceptions** - Use comments feature for special cases

---

*Your WISDM petition processing system is now configured to match and exceed the capabilities of industry-leading solutions like Parascript FormXtra.AI!*
