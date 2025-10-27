# Scanner Sync Agent - Quick Setup Guide

This small desktop program watches a folder on your network and automatically uploads scanned files to the cloud.

---

## 📋 What You'll Need

- **A Windows computer** that can access your scanner's output folder
- **5 minutes** to set everything up
- **Downloaded files** from WISDM (you should have these already)

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Install Node.js

1. Download Node.js from: **https://nodejs.org**
2. Run the installer and click "Next" through all steps
3. ✅ Done! Close the installer

### Step 2: Create a Folder

1. Create a new folder on your computer: `C:\ScannerSync`
2. Copy all downloaded files into this folder:
   - `scanner-sync-agent.js`
   - `.env.scanner-sync`
   - `package.json`

### Step 3: Configure the Folder Path

1. Open `.env.scanner-sync` in Notepad
2. Change this line to match where your scanner saves files:
   ```
   WATCH_FOLDER=C:\AutoImport
   ```
   Example: If your scanner saves to `\\SERVER\Scans\`, use:
   ```
   WATCH_FOLDER=\\SERVER\Scans
   ```
3. Rename the file from `.env.scanner-sync` to `.env`
4. Save and close

### Step 4: Install & Test

1. Open Command Prompt
2. Type: `cd C:\ScannerSync` and press Enter
3. Type: `npm install` and press Enter (this downloads required files)
4. Type: `npm start` and press Enter
5. You should see: `👀 Watching for new files...`
6. **Test it:** Place a PDF in your scanner folder - it should upload automatically!
7. Press `Ctrl+C` to stop

✅ **If it worked, continue to Step 5. If not, see Troubleshooting below.**

### Step 5: Run 24/7 (Optional but Recommended)

To make the agent run automatically in the background:

1. Download NSSM from: **https://nssm.cc/download**
2. Extract the ZIP file to `C:\nssm`
3. Open Command Prompt **as Administrator**
4. Type these commands:
   ```
   cd C:\nssm\win64
   nssm install ScannerSyncAgent
   ```
5. In the window that appears:
   - **Path:** `C:\Program Files\nodejs\node.exe`
   - **Startup directory:** `C:\ScannerSync`
   - **Arguments:** `scanner-sync-agent.js`
   - Click "Install service"
6. Start the service:
   ```
   nssm start ScannerSyncAgent
   ```

✅ **Done!** The agent will now run automatically when Windows starts.

---

## 🔧 Troubleshooting

### "npm is not recognized"
- Restart your computer after installing Node.js
- Open a new Command Prompt window

### "File not found" or "Cannot find module"
- Make sure you ran `npm install` in Step 4
- Check that all files are in `C:\ScannerSync`

### Files not uploading
- Verify your `WATCH_FOLDER` path is correct in the `.env` file
- Check that the folder exists and the computer can access it
- Make sure the file extension is supported: PDF, JPG, PNG, TIFF

### Still stuck?
Contact your WISDM administrator for help.

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
