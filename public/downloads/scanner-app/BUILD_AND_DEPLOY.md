# Scanner App - Build and Deployment Guide for Administrators

This guide is for **developers/administrators** who need to build the scanner app installer **once** for distribution to end-users.

## Overview

End-users should NOT need to build the scanner app themselves. You (the administrator) will build the installer once on a development machine, then distribute the pre-built `.exe` installer file to users.

---

## One-Time Build Setup (Administrator Only)

### Prerequisites

1. **Windows 10/11 (64-bit)** - Required for building Windows installer
2. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
3. **Visual Studio Build Tools 2022** - Required for native addon compilation
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Select **"Build Tools for Visual Studio 2022"** (free)
   - During installation, check **"Desktop development with C++"**
   - Restart your computer after installation
4. **Ricoh Scanner SDK** - Must be installed at `C:\Ricoh SDK`

### Build Process

1. **Navigate to scanner app directory:**
   ```bash
   cd public/downloads/scanner-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build native Ricoh SDK addon:**
   ```bash
   npm run rebuild
   ```
   
   Expected output:
   ```
   ✔ Rebuild Complete
   ```

4. **Create installer:**
   ```bash
   npm run build:win
   ```
   
   This will:
   - Compile the application
   - Package with Electron
   - Create NSIS installer
   - Output to `dist/` folder

5. **Locate the installer:**
   ```
   dist/
   └── WISDM-Scanner-Setup-1.0.0.exe  (or similar version number)
   ```

---

## Deployment to End Users

### Option 1: Web Application Download (Recommended)

1. **Rename the installer for simplicity:**
   ```bash
   # Example:
   WISDM-Scanner-Setup-1.0.0.exe → WISDM-Scanner-Setup.exe
   ```

2. **Place installer in web app downloads directory:**
   ```bash
   # Copy the .exe file to:
   public/downloads/WISDM-Scanner-Setup.exe
   ```

3. **Users download from:**
   - Web app → Click "Download Scanner App" → Downloads page
   - Direct URL: `https://your-domain.com/downloads/WISDM-Scanner-Setup.exe`

### Option 2: Network Share Distribution

1. **Place installer on network share:**
   ```
   \\company-server\software\WISDM-Scanner-Setup.exe
   ```

2. **Provide users with network path:**
   - Email instructions with UNC path
   - Include installation guide link

### Option 3: IT Deployment Tools

Use your organization's software deployment tool (e.g., SCCM, Intune, PDQ Deploy) to push the installer to user machines.

---

## End-User Installation (Simple Process)

Once you've built and deployed the installer, end-users follow these **simple steps**:

1. **Download installer:**
   - From WISDM web app downloads page
   - Or from provided network location

2. **Run installer:**
   - Double-click `WISDM-Scanner-Setup.exe`
   - Windows may show security warning → Click "More info" → "Run anyway"
   - Follow installation wizard (click Next → Install)

3. **Installation complete:**
   - App launches automatically (appears in system tray)
   - No configuration needed
   - Ready to scan when triggered from web app

**That's it!** No Visual Studio, no Node.js, no building required for end-users.

---

## Updating the Scanner App

When you need to release a new version:

1. **Update version in `package.json`:**
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. **Rebuild installer:**
   ```bash
   npm run rebuild
   npm run build:win
   ```

3. **Replace old installer:**
   - Remove old `WISDM-Scanner-Setup.exe` from downloads
   - Add new version to downloads
   - Notify users of update availability

4. **Users reinstall:**
   - Download new version
   - Run installer (will upgrade existing installation)

---

## Troubleshooting Build Issues

### "MSBuild not found"
- Install Visual Studio Build Tools 2022 with "Desktop development with C++" workload
- Restart computer after installation
- Do NOT use deprecated `windows-build-tools` npm package

### "Cannot find PfuSsApi.h"
- Verify Ricoh SDK installed at `C:\Ricoh SDK\`
- Check paths in `native/binding.gyp` if SDK is elsewhere

### "node-gyp rebuild failed"
- Ensure Visual Studio Build Tools installed correctly
- Run `npm install --global node-gyp`
- Try: `npm run rebuild` again

### Build succeeds but installer fails to run
- Check that all native dependencies are bundled
- Test installer on a clean Windows VM before distribution

---

## Pre-Built Installer Location

After building, place the installer here for web app distribution:

```
public/downloads/WISDM-Scanner-Setup.exe
```

Users access via:
- Web app: `/downloads` page
- Direct download: `https://your-domain.com/downloads/WISDM-Scanner-Setup.exe`

---

## Technical Notes

### Installer Configuration

Configured in `package.json` under `build` section:

```json
"build": {
  "appId": "com.wisdm.scanner",
  "productName": "WISDM Scanner",
  "win": {
    "target": ["nsis"],
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

### Protocol Handler Registration

The installer automatically registers the `wisdm-scan://` protocol handler, enabling web app integration.

### Installation Location

Default: `C:\Program Files\WISDM Scanner\`

Users can change during installation.

---

## Support

For build issues:
- Check build logs in console output
- Verify all prerequisites installed
- Test on clean Windows environment

For deployment issues:
- Verify installer file is not corrupted
- Check Windows Defender/antivirus settings
- Test installer download from web app

---

## Summary

**For Administrators:**
1. Build installer once using this guide
2. Place in `public/downloads/WISDM-Scanner-Setup.exe`
3. Users download and install (no building required)

**For End-Users:**
1. Download pre-built installer
2. Run installer
3. Start scanning

This approach eliminates all technical complexity for end-users while giving administrators full control over the build and deployment process.
