# WISDM Scanner Desktop App - End-User Installation Guide

Simple installation guide for end-users who want to use the WISDM Desktop Scanner application.

## For End-Users (Quick Start)

**You do NOT need to build the scanner app yourself!** Simply download the pre-built installer and run it.

### System Requirements

- **OS**: Windows 10/11 (64-bit)
- **Scanner**: Ricoh/Fujitsu scanner connected via USB
- **Ricoh Drivers**: Scanner drivers installed
- **.NET Framework**: 4.7.2 or later (usually pre-installed on Windows 10/11)

### Installation Steps

1. **Download the installer:**
   - From WISDM web application → Click "Download Scanner App"
   - Or download directly: `WISDM-Scanner-Setup.exe`

2. **Run the installer:**
   - Double-click `WISDM-Scanner-Setup.exe`
   - Windows may show security warning → Click "More info" → "Run anyway"

3. **Follow installation wizard:**
   - Choose installation directory (default: `C:\Program Files\WISDM Scanner`)
   - Click "Install"
   - Wait for installation to complete

4. **First launch:**
   - App launches automatically after install
   - Look for system tray icon (bottom-right corner, near clock)
   - Right-click tray icon to access menu

5. **Connect scanner:**
   - Ensure Ricoh/Fujitsu scanner is connected via USB
   - Power on scanner
   - Right-click tray icon → "Refresh Scanners"

6. **Start scanning:**
   - Open WISDM web application
   - Navigate to document upload/batch
   - Click "Scan Document" button
   - Desktop app will activate and scan automatically

**That's it!** No technical setup required.

---

## For Developers/Administrators

**If you need to BUILD the scanner app installer yourself** (for example, to customize it or create your own distribution), see the [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) guide.

This section is ONLY for developers/administrators who manage the scanner app deployment. End-users should use the pre-built installer above.

---

## Table of Contents

1. [Troubleshooting](#troubleshooting)
2. [Support](#support)

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
