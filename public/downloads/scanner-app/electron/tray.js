const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const scanner = require('../src/scanner');

let tray = null;

function initTray() {
  // Create tray icon (you'll need to provide an icon file)
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  updateTrayMenu();
  
  tray.setToolTip('WISDM Scanner - Ready');
  
  return tray;
}

function updateTrayMenu(scanners = []) {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'WISDM Scanner',
      enabled: false
    },
    { type: 'separator' },
    {
      label: scanners.length > 0 ? `${scanners.length} Scanner(s) Detected` : 'No Scanners Detected',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quick Scan',
      enabled: scanners.length > 0,
      click: async () => {
        try {
          const result = await scanner.scanDocument({
            scanner: scanners[0],
            autoUpload: true
          });
          console.log('Quick scan complete:', result);
        } catch (error) {
          console.error('Quick scan failed:', error);
        }
      }
    },
    {
      label: 'Refresh Scanners',
      click: async () => {
        const detectedScanners = await scanner.getScanners();
        updateTrayMenu(detectedScanners);
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        // Open settings window (to be implemented)
        console.log('Settings clicked');
      }
    },
    {
      label: 'About',
      click: () => {
        console.log('WISDM Scanner v1.0.0');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function setTrayStatus(status, tooltip) {
  if (tray) {
    // Update icon based on status (you can add different icon states)
    tray.setToolTip(tooltip || `WISDM Scanner - ${status}`);
  }
}

module.exports = { initTray, updateTrayMenu, setTrayStatus };
