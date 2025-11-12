# Pre-Built Installer Deployment

## Instructions for Administrators

After building the scanner app installer using the instructions in [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md), place the pre-built installer file here for end-user distribution.

### File to Place Here

```
public/downloads/WISDM-Scanner-Setup.exe
```

### Build the Installer

From the `public/downloads/scanner-app/` directory:

```bash
npm install
npm run rebuild
npm run build:win
```

This creates: `dist/WISDM-Scanner-Setup-1.0.0.exe`

### Deploy to Web App

1. **Rename for simplicity (optional):**
   ```
   dist/WISDM-Scanner-Setup-1.0.0.exe → WISDM-Scanner-Setup.exe
   ```

2. **Copy to downloads directory:**
   ```
   Copy-Item dist/WISDM-Scanner-Setup-1.0.0.exe public/downloads/WISDM-Scanner-Setup.exe
   ```

3. **Commit to repository:**
   ```bash
   git add public/downloads/WISDM-Scanner-Setup.exe
   git commit -m "Add pre-built scanner app installer"
   git push
   ```

### End-User Access

Users can download the installer from:
- Web app: Click "Download Scanner App" → Downloads page
- Direct URL: `https://your-domain.com/downloads/WISDM-Scanner-Setup.exe`

### Updating the Installer

When releasing a new version:

1. Update version in `package.json`
2. Rebuild: `npm run build:win`
3. Replace `public/downloads/WISDM-Scanner-Setup.exe` with new version
4. Commit and push changes
5. Notify users to download and reinstall

---

## Current Status

- [ ] Pre-built installer not yet placed
- [ ] Place `WISDM-Scanner-Setup.exe` in `public/downloads/` directory
- [ ] See [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) for build instructions

Once the installer is placed, end-users can simply download and run it without needing to build the scanner app themselves.
