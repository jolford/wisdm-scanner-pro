# WISDM Scanner Desktop App - Installation Guide

Complete step-by-step installation guide for the WISDM Desktop Scanner application.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation Setup](#pre-installation-setup)
3. [Building the Application](#building-the-application)
4. [Creating the Installer](#creating-the-installer)
5. [End-User Installation](#end-user-installation)
6. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Development Machine
- **OS**: Windows 10/11 (64-bit)
- **Node.js**: v18.x or later
- **npm**: v9.x or later
- **Visual Studio**: Build Tools 2019 or later
- **Ricoh Scanner SDK**: Installed at `C:\Ricoh SDK`

### End-User Machine
- **OS**: Windows 10/11 (64-bit)
- **Scanner**: Ricoh/Fujitsu scanner connected via USB
- **Ricoh Drivers**: Scanner drivers installed
- **.NET Framework**: 4.7.2 or later (usually pre-installed on Windows 10/11)

---

## Pre-Installation Setup

### 1. Install Development Tools

#### Install Node.js
```bash
# Download from nodejs.org and install
# Verify installation
node --version
npm --version
```

#### Install Visual Studio Build Tools

**IMPORTANT:** The old `windows-build-tools` npm package is deprecated and no longer works.

**Recommended Method - Download Visual Studio Build Tools:**

1. Download from: https://visualstudio.microsoft.com/downloads/
2. Select **"Build Tools for Visual Studio 2022"** (free)
3. During installation, check **"Desktop development with C++"**
4. Install location: Default is fine
5. Restart your computer after installation

**Alternative - Use Chocolatey (if you have it):**
```bash
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools"
```

**Verify Installation:**
```bash
# Should show version info
where cl.exe
```

### 2. Verify Ricoh SDK Installation

Ensure the Ricoh Scanner SDK is installed at:
```
C:\Ricoh SDK\
├── include\
│   ├── PfuSsApi.h
│   └── ... (other headers)
└── lib\
    └── x64\
        └── PfuSsApiLib.lib
```

**If SDK is at a different location:**
Edit `native/binding.gyp` and update paths:
```json
"include_dirs": [
  "C:/YOUR_CUSTOM_PATH/include"
],
"libraries": [
  "C:/YOUR_CUSTOM_PATH/lib/x64/PfuSsApiLib.lib"
]
```

---

## Building the Application

### 1. Clone/Copy Project Files

```bash
# Navigate to scanner-app directory
cd C:\path\to\scanner-app

# Verify all files are present
dir
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- Electron runtime
- Supabase client
- Native build tools
- Development dependencies

### 3. Build Native Addon

```bash
# Build the Ricoh SDK native addon
npm run rebuild
```

Expected output:
```
> ricoh-scanner@1.0.0 rebuild
> electron-rebuild -f -w ricoh-scanner

✔ Rebuild Complete
```

**If build fails**, check:
- Visual Studio Build Tools are installed
- Ricoh SDK paths in `binding.gyp` are correct
- Node version is compatible (v18+)

### 4. Test in Development Mode

```bash
npm start
```

This will:
- Launch Electron app
- Create system tray icon
- Initialize scanner detection

**Verify:**
- System tray icon appears (bottom-right, near clock)
- Right-click tray icon shows menu
- Console logs show "Ricoh SDK initialized successfully"

---

## Creating the Installer

### 1. Prepare Assets

Create icon files (required):
```
scanner-app/
└── assets/
    ├── icon.ico       # Windows installer icon (256x256)
    └── tray-icon.png  # System tray icon (16x16 or 32x32)
```

**Generate icons:**
- Use online tools like [icoconvert.com](https://icoconvert.com/)
- Or use your company logo

### 2. Configure Installer

Edit `package.json` if needed:
```json
{
  "build": {
    "appId": "com.yourcompany.scanner",
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
}
```

### 3. Build Installer

```bash
npm run build:win
```

This will:
- Compile application
- Package with Electron
- Create NSIS installer
- Output to `dist/` folder

**Build output:**
```
dist/
├── WISDM-Scanner-Setup-1.0.0.exe  (Installer)
└── win-unpacked/                   (Unpacked files)
```

### 4. Test Installer

```bash
# Run the installer
.\dist\WISDM-Scanner-Setup-1.0.0.exe
```

Follow installation wizard and verify:
- Installation completes successfully
- App launches and appears in system tray
- Protocol handler registers (`wisdm-scan://`)

---

## End-User Installation

### Distribution

**Option 1: Direct Download**
1. Upload `WISDM-Scanner-Setup.exe` to your web server
2. Place in `public/downloads/scanner-app/`
3. Users download from WISDM web app

**Option 2: Network Share**
1. Place installer on network share
2. Provide users with share path
3. Run from network location

### User Installation Steps

1. **Download Installer**
   - From WISDM web app: Click "Download Scanner App"
   - Or access installer from network share

2. **Run Installer**
   - Double-click `WISDM-Scanner-Setup.exe`
   - Windows may show security warning - click "More info" → "Run anyway"

3. **Installation Wizard**
   - Choose installation directory (default: `C:\Program Files\WISDM Scanner`)
   - Click "Install"
   - Wait for installation to complete

4. **First Launch**
   - App will launch automatically
   - Look for system tray icon (bottom-right)
   - Right-click to access menu

5. **Scanner Detection**
   - Connect Ricoh/Fujitsu scanner via USB
   - Ensure scanner is powered on
   - Right-click tray icon → "Refresh Scanners"

6. **Web App Integration**
   - Open WISDM web application
   - Navigate to document upload
   - Click "Scan Document" button
   - Desktop app will activate and scan

---

## Troubleshooting

### Build Issues

**Error: "Cannot find module 'node-gyp'"**
```bash
npm install --global node-gyp
npm run rebuild
```

**Error: "MSBuild not found"**
- Install Visual Studio Build Tools 2022 from https://visualstudio.microsoft.com/downloads/
- During install, select "Desktop development with C++"
- Restart your computer after installation
- Do NOT use `windows-build-tools` npm package (it's deprecated)

**Error: "Cannot find PfuSsApi.h"**
- Verify Ricoh SDK installed at `C:\Ricoh SDK`
- Check paths in `native/binding.gyp`

### Runtime Issues

**Scanner Not Detected**
1. Verify scanner is connected and powered on
2. Check Windows Device Manager for scanner
3. Install/update scanner drivers
4. Right-click tray icon → "Refresh Scanners"

**Protocol Handler Not Working**
1. Reinstall application (registers protocol handler)
2. Check Windows Registry:
   - `HKEY_CLASSES_ROOT\wisdm-scan`
3. Try running as Administrator

**Upload Fails**
1. Check internet connection
2. Verify logged into WISDM web app
3. Try scanning from web app again (refreshes token)

### Logs and Debugging

**Application Logs:**
```
%APPDATA%\wisdm-scanner\logs\main.log
```

**Enable Verbose Logging:**
Edit `electron/main.js`:
```javascript
console.log('Debug:', ...);
```

**Check Network Requests:**
- Open browser DevTools
- Network tab
- Look for failed requests to Supabase

---

## Support

For additional help:
- **Email**: support@wisdm.com
- **Documentation**: See README.md
- **SDK Documentation**: Ricoh Scanner SDK docs

---

## Appendix: Ricoh SDK Function Reference

Common SDK functions used in the native addon:

| Function | Description |
|----------|-------------|
| `PfuSsInitialize()` | Initialize SDK |
| `PfuSsGetDeviceCount()` | Get number of connected scanners |
| `PfuSsGetDeviceInfo()` | Get scanner information |
| `PfuSsOpenDevice()` | Open scanner for use |
| `PfuSsSetScanParam()` | Configure scan settings |
| `PfuSsStartScan()` | Begin scanning |
| `PfuSsGetImageData()` | Retrieve scanned image |
| `PfuSsCloseDevice()` | Close scanner |
| `PfuSsUninitialize()` | Cleanup SDK |

Refer to Ricoh Scanner SDK documentation for detailed API reference.
