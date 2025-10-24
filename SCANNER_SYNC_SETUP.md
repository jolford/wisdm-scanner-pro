# Scanner Auto-Import Sync Agent Setup Guide

This agent bridges the gap between your network scanners and the cloud-based auto-import system.

## Overview

**The Flow:**
```
Scanner → Network Folder → Sync Agent → Cloud Storage → Auto-Import Processing
```

## Installation (Windows)

### Prerequisites
1. **Node.js** (Download from https://nodejs.org)
   - Install the LTS version
   - During installation, check "Automatically install necessary tools"

2. **Network folder access**
   - Ensure the computer running this agent can access the scanner's output folder

### Step 1: Download the Sync Agent

Copy these files to a folder on your server (e.g., `C:\ScannerSync\`):
- `scanner-sync-agent.js`
- `.env.scanner-sync`
- `package.json` (create this - see below)

### Step 2: Create package.json

Create a file named `package.json` in the same folder:

```json
{
  "name": "scanner-sync-agent",
  "version": "1.0.0",
  "type": "module",
  "description": "Syncs scanner files to cloud storage",
  "scripts": {
    "start": "node scanner-sync-agent.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.75.0",
    "chokidar": "^3.6.0",
    "dotenv": "^16.4.5"
  }
}
```

### Step 3: Install Dependencies

Open Command Prompt in your folder and run:

```bash
npm install
```

### Step 4: Configure Environment

1. Rename `.env.scanner-sync` to `.env`

2. Get your Supabase Service Role Key:
   - Go to your backend (Storage section)
   - Click Settings → API
   - Copy the `service_role` key (NOT the anon key)

3. Edit `.env` file:
   ```env
   SUPABASE_URL=https://pbyerakkryuflamlmpvm.supabase.co
   SUPABASE_SERVICE_KEY=your_actual_service_role_key_here
   WATCH_FOLDER=C:\Users\Jerem\OneDrive\Desktop\Auto Import
   BUCKET_PATH=auto-import
   ```

### Step 5: Test the Agent

Run the agent manually first to test:

```bash
npm start
```

You should see:
```
=================================
Scanner Auto-Import Sync Agent
=================================
Watching folder: C:\Users\Jerem\OneDrive\Desktop\Auto Import
Upload to: scanner-import/auto-import
✅ Connected to Supabase Storage

👀 Watching for new files...
```

Drop a test PDF in your watch folder to verify it uploads.

### Step 6: Run as Windows Service (Production)

For continuous operation, install as a Windows service using `nssm`:

1. Download NSSM: https://nssm.cc/download
2. Extract to `C:\nssm\`
3. Open Command Prompt as Administrator
4. Run:

```bash
cd C:\nssm\win64
nssm install ScannerSyncAgent
```

5. In the GUI that opens:
   - **Path**: `C:\Program Files\nodejs\node.exe`
   - **Startup directory**: `C:\ScannerSync`
   - **Arguments**: `scanner-sync-agent.js`
   - Click "Install service"

6. Start the service:

```bash
nssm start ScannerSyncAgent
```

The service will now:
- Start automatically when Windows boots
- Run continuously in the background
- Restart automatically if it crashes

### Step 7: Update Your Project Settings

1. Go to Admin → Projects → Edit your project
2. Scroll to "Scanner Auto-Import"
3. Set **Watch Folder Path** to: `auto-import`
4. Enable auto-import
5. Save

## Monitoring

### View Agent Logs (if running as service)

```bash
nssm set ScannerSyncAgent AppStdout C:\ScannerSync\logs\output.log
nssm set ScannerSyncAgent AppStderr C:\ScannerSync\logs\error.log
nssm restart ScannerSyncAgent
```

### Check Upload Status

Check your backend storage:
- Backend → Storage → scanner-import → auto-import folder

### Check Processing Logs

- Backend → Functions → process-scanner-imports (check logs)

## Troubleshooting

### Files not uploading

1. Check the agent is running:
   ```bash
   nssm status ScannerSyncAgent
   ```

2. Check the watch folder path is correct

3. Verify file formats are supported (PDF, JPG, PNG, TIFF)

4. Check file size is under 50MB

### Permission errors

- Ensure the service account has read access to the watch folder
- Verify the Supabase service key is correct

### Duplicate uploads

The agent tracks uploaded files to avoid duplicates. If you need to reprocess a file:
1. Delete it from cloud storage
2. Restart the agent
3. Copy the file back to the watch folder

## Security Notes

⚠️ **IMPORTANT**: The `.env` file contains your service role key, which has admin access to your database. 

- Never commit `.env` to version control
- Restrict file permissions to administrators only
- Store the file securely on the server
- Rotate keys periodically

## Scanner Configuration

Configure your network scanner to:
1. Save files to your watch folder (e.g., `C:\AutoImport\`)
2. Use one of these formats: PDF, JPG, PNG, TIFF
3. Name files uniquely (most scanners add timestamps automatically)

### Example Scanner Settings:
- **Destination**: SMB/CIFS Network Folder
- **Path**: `\\SERVER\AutoImport\`
- **Format**: PDF
- **Filename**: `scan_{datetime}.pdf`

## Architecture

```
┌─────────────┐
│   Scanner   │
└──────┬──────┘
       │ saves to
       ▼
┌─────────────────┐
│ Network Folder  │ ← You configure this in scanner
│ (C:\AutoImport) │
└────────┬────────┘
         │ monitored by
         ▼
┌─────────────────┐
│  Sync Agent     │ ← This script (runs as service)
│  (this script)  │
└────────┬────────┘
         │ uploads to
         ▼
┌─────────────────┐
│ Cloud Storage   │ ← scanner-import/auto-import
│ (Supabase)      │
└────────┬────────┘
         │ processed by
         ▼
┌─────────────────┐
│  Edge Function  │ ← Runs every 5 min
│ (auto-import)   │
└────────┬────────┘
         │ creates
         ▼
┌─────────────────┐
│     Batch       │
│   + OCR Job     │
└─────────────────┘
```

## Cost Considerations

- **Storage**: ~$0.021/GB/month for files in cloud storage
- **Network**: Uploads are free, downloads have minimal costs
- **Processing**: OCR costs based on document size (already part of your system)

Files are automatically moved to a "processed" folder after import, keeping storage usage minimal.
