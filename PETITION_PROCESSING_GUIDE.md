# Petition Processing Guide - Parascript-Style Workflow

Your WISDM system now processes petitions with the same capabilities as Parascript FormXtra.AI.

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
  - Stores extracted data

#### Step 2: Validation Screen
Navigate to the **Validation** tab - you'll see:

**Top Section: AI Smart Validation**
- Click "Validate All" or the 💡 lightbulb next to individual fields
- AI validates extracted data quality and suggests corrections

**Signature Verification Section** (if enabled)
- Upload signature images
- System validates against reference signatures
- Provides match confidence scores

**Line Item Validation Section** (NEW - Like Parascript)
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

## Key Features (Matching Parascript)

✅ **Automatic Data Extraction** - Each signer row extracted as line item
✅ **Voter Count** - System counts total signers in `line_items` array
✅ **Address Validation** - CSV lookup verifies addresses match registration
✅ **Signature Verification** - AI-powered signature matching
✅ **Batch Validation** - Validate all signers at once
✅ **Mismatch Highlighting** - See exactly which fields don't match
✅ **Correction Suggestions** - System suggests proper values from registry
✅ **Confidence Scoring** - AI confidence for each extracted field

## Troubleshooting

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

## Advanced: Automatic Workflow

Enable **Auto-Export** and **Scheduled Exports** to automatically:
1. Scan petitions from hot folder
2. Extract all signer data
3. Validate against voter registry
4. Flag invalid/not-found signers
5. Export validated results to ECM system

This matches the full Parascript automated workflow!
