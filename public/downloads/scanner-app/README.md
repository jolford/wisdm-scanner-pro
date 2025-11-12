# WISDM Desktop Scanner Application

Desktop application for scanning documents with Ricoh/Fujitsu scanners and uploading directly to WISDM web application.

## Features

- Background system tray application
- Ricoh Scanner SDK integration for optimal scanner performance
- Custom protocol handler (`wisdm-scan://`) for seamless web app integration
- Automatic upload to Supabase storage
- Session-based authentication (no separate login required)
- Multi-page document support
- System tray quick scan functionality

## Prerequisites

- Windows 10/11 (64-bit)
- Ricoh/Fujitsu scanner connected via USB
- Ricoh Scanner SDK installed at `C:\Ricoh SDK`
- Node.js 18+ and npm
- Visual Studio Build Tools (for native addon compilation)

## Installation

### Development Setup

1. **Install Visual Studio Build Tools**
   ```bash
   npm install --global windows-build-tools
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build native Ricoh SDK addon**
   ```bash
   npm run rebuild
   ```

4. **Run in development mode**
   ```bash
   npm start
   ```

### Build Installer

```bash
npm run build:win
```

This will create an installer in the `dist/` folder.

## Ricoh SDK Configuration

The native addon expects the Ricoh Scanner SDK to be installed at:
```
C:\Ricoh SDK\
├── include\
│   └── PfuSsApi.h
└── lib\
    └── x64\
        └── PfuSsApiLib.lib
```

If your SDK is installed elsewhere, update the paths in `native/binding.gyp`:

```json
"include_dirs": [
  "C:/YOUR_SDK_PATH/include"
],
"libraries": [
  "C:/YOUR_SDK_PATH/lib/x64/PfuSsApiLib.lib"
]
```

## Usage

### First Time Setup

1. Install the WISDM Scanner application
2. The app will run in the background (system tray)
3. In the WISDM web application, click "Scan Document"
4. The desktop app will receive authentication and start scanning

### Protocol Handler

The web app triggers scans using custom URLs:

```
wisdm-scan://scan?token=SESSION_TOKEN&project=PROJECT_ID&batch=BATCH_ID&customer=CUSTOMER_ID&supabase=SUPABASE_URL
```

### System Tray

Right-click the system tray icon for:
- Quick Scan (uses default settings)
- Refresh Scanners
- Settings
- About
- Quit

## Architecture

```
┌─────────────────────────────────────────────┐
│         WISDM Web Application                │
│  (Sends wisdm-scan:// protocol URL)         │
└───────────────┬─────────────────────────────┘
                │
                │ Protocol Handler
                │
┌───────────────▼─────────────────────────────┐
│      Electron Desktop App (main.js)         │
│  ┌─────────────────────────────────────┐   │
│  │  Protocol Handler (protocol.js)      │   │
│  │  • Parse URL parameters               │   │
│  │  • Store session token                │   │
│  │  • Trigger scan                       │   │
│  └────────────┬────────────────────────┘   │
│               │                              │
│  ┌────────────▼────────────────────────┐   │
│  │  Scanner Manager (scanner.js)        │   │
│  │  • Detect Ricoh scanners             │   │
│  │  • Configure scan settings           │   │
│  │  • Perform scan via native addon    │   │
│  └────────────┬────────────────────────┘   │
│               │                              │
│  ┌────────────▼────────────────────────┐   │
│  │  Native Addon (ricoh-scanner.cc)    │   │
│  │  • Call Ricoh SDK functions          │   │
│  │  • Return scanned image data         │   │
│  └────────────┬────────────────────────┘   │
│               │                              │
│  ┌────────────▼────────────────────────┐   │
│  │  Uploader (uploader.js)              │   │
│  │  • Upload to Supabase storage        │   │
│  │  • Create document record            │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                │
                │ HTTPS Upload
                │
┌───────────────▼─────────────────────────────┐
│         Supabase Backend                     │
│  • Storage (documents bucket)                │
│  • Database (documents table)                │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### Scanner Not Detected

1. Ensure scanner is powered on and connected via USB
2. Check Windows Device Manager for scanner
3. Try "Refresh Scanners" in system tray menu
4. Restart the desktop application

### Native Addon Build Fails

1. Verify Visual Studio Build Tools installed
2. Check Ricoh SDK path in `binding.gyp`
3. Run `npm run rebuild` again

### Upload Fails

1. Check internet connection
2. Verify session token is valid (try re-scanning from web app)
3. Check browser console for errors

## License

MIT License - WISDM

## Support

For issues, contact WISDM support or check application logs:
- Windows: `%APPDATA%\wisdm-scanner\logs\`
