# Scanner Auto-Import System Guide

## Overview

The WISDM Scanner Pro now includes an **automatic folder monitoring system** that allows network scanners to save files directly to a watched folder, with automatic import into the system every 5 minutes.

## How It Works

```
Scanner → Network Folder → Auto-Import (Every 5 min) → WISDM System → OCR Processing
```

## Setup Steps

### 1. Configure in WISDM (Admin)

1. Navigate to **Admin → Projects → Edit Project**
2. Scroll to **"Scanner Auto-Import"** section
3. Configure:
   - **Enable Auto-Import**: Toggle ON
   - **Watch Folder Path**: Set the folder path (e.g., `customer1/scanner` or `department/invoices`)
   - **Auto-Create Batches**: Enable to automatically create batches
   - **Batch Name Template**: Customize batch naming (use `{date}` for date insertion)
4. Click **Save Configuration**

### 2. Configure Your Scanner

Most modern scanners support "Scan to Folder" functionality. Configure your scanner to save files to the watch folder path you specified.

**Common Scanner Destinations:**
- **Network Folder (SMB/CIFS)**: Point to the designated folder
- **FTP**: Configure FTP credentials to upload directly
- **Email to Folder**: Some scanners can email files that get saved to folders

**Supported File Types:**
- PDF
- JPEG/JPG
- PNG
- TIFF

**File Size Limit:** 50MB per file

### 3. Scanner Setup Instructions

#### For IT Administrators:

**Option A: Network Share (Most Common)**
1. Set up a network share/SMB folder
2. Configure scanner to save to: `\\server\scanner-import\[watch-folder-path]`
3. Scanner writes files → System picks them up automatically

**Option B: FTP Upload**
1. Set up FTP server pointing to scanner-import storage
2. Configure scanner FTP settings
3. Scanner uploads → System imports automatically

**Option C: Cloud Storage Sync**
1. Use cloud sync tools (Dropbox, OneDrive, etc.)
2. Sync to scanner-import bucket
3. Files appear → System processes them

## How Files Are Processed

1. **Every 5 minutes**, the system checks configured watch folders
2. **New files detected** → System downloads them
3. **Creates/Updates Batch** → Files are added to a batch
4. **Uploads to Documents** → Files moved to main document storage
5. **Triggers OCR** → Automatic text extraction begins
6. **Moves to Processed** → Original file moved to `processed/` subfolder

## Testing the Setup

1. In Project Settings, click **"Test Import Now"** button
2. Manually place a test file in the watch folder
3. Click test button to trigger immediate import
4. Check batch to see if document appears

## Monitoring & Logs

### View Last Check Time
- In Project Settings → Scanner Auto-Import section
- Shows when the system last checked for files

### Import Logs
Import history is tracked in the `scanner_import_logs` table:
- File name
- Import status (success/failed/skipped)
- Batch ID
- Document ID
- Error messages (if any)

### Troubleshooting

**Files Not Importing?**
- ✅ Check "Enable Auto-Import" is ON
- ✅ Verify watch folder path is correct
- ✅ Ensure files are supported types (PDF, JPG, PNG, TIFF)
- ✅ Check file size under 50MB
- ✅ Wait full 5 minutes for next check cycle
- ✅ Use "Test Import Now" button for immediate check

**Files Imported Multiple Times?**
- System tracks processed files to prevent duplicates
- Files are moved to `processed/` folder after import
- Check logs for any errors

**Scanner Can't Access Folder?**
- Verify network credentials
- Check firewall settings
- Ensure scanner has write permissions
- Test with manual file copy first

## Architecture

### Storage Buckets
- **`scanner-import`**: Incoming files from scanners
  - Active files in root/watch folders
  - Processed files moved to `processed/` subfolder
- **`documents`**: Main document storage after import

### Database Tables
- **`scanner_import_configs`**: Configuration per project
- **`scanner_import_logs`**: Import history and tracking
- **`batches`**: Auto-created batches for imports
- **`documents`**: Imported document records

### Edge Functions
- **`process-scanner-imports`**: Main import processor (runs every 5 min via cron)
- Triggered automatically by `pg_cron` scheduler

### Scheduled Job
```sql
-- Runs every 5 minutes automatically
SELECT cron.schedule(
  'process-scanner-imports-every-5-min',
  '*/5 * * * *',
  ...
);
```

## Security Considerations

✅ **RLS Policies**: All tables have proper row-level security
✅ **File Size Limits**: 50MB max to prevent abuse
✅ **Supported MIME Types**: Only allowed formats (PDF, images)
✅ **Folder Isolation**: Each customer/project has separate watch folders
✅ **Audit Logs**: All imports are logged with timestamps

## Benefits of Auto-Import

1. **No Manual Upload**: Scanner → System automatically
2. **Continuous Processing**: Files processed every 5 minutes
3. **Batch Organization**: Auto-creates and manages batches
4. **Audit Trail**: Complete import history
5. **Multi-Scanner Support**: Multiple projects can have different watch folders
6. **Error Recovery**: Failed imports logged for review

## Cost-Effective Alternative to Dynamsoft

Instead of paying for Dynamsoft Web TWAIN SDK ($1,000-$10,000+/year):
- ✅ **Free**: Uses native scanner "scan to folder" features
- ✅ **No Software Installation**: Works with existing scanner capabilities
- ✅ **Platform Independent**: Any scanner with network save functionality
- ✅ **Automatic**: No user intervention required
- ✅ **Scalable**: Handle multiple scanners and locations

## Example Use Cases

### Use Case 1: Invoice Processing Department
- **Setup**: Scanners save to `invoices/department-a`
- **Auto-Import**: Every 5 minutes → "Invoice Batch YYYY-MM-DD"
- **Result**: Invoices automatically extracted and ready for validation

### Use Case 2: Multi-Location Scanning
- **Location 1**: `customer1/branch-ny`
- **Location 2**: `customer1/branch-la`
- **Result**: Each location's scans imported to correct project automatically

### Use Case 3: Receipt Processing
- **Setup**: Scanner at reception desk → `receipts/2025-01`
- **Auto-Import**: Creates daily batches
- **Result**: All receipts digitized and processed without manual intervention

## Support

For issues or questions:
- Check import logs in database
- Review scanner configuration
- Test with manual file placement
- Contact system administrator
- Use AI Assistant in Help Center for troubleshooting

---

**Version**: 1.0  
**Last Updated**: January 2025  
**Requires**: WISDM Scanner Pro v2.0+