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
