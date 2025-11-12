const { app, BrowserWindow, Tray, Menu, protocol, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { initTray } = require('./tray');
const { handleProtocolUrl } = require('./protocol');
const scanner = require('../src/scanner');

const store = new Store();
let tray = null;
let mainWindow = null;

// Register protocol handler
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('wisdm-scan', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('wisdm-scan');
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Handle protocol URL from second instance
    const url = commandLine.find((arg) => arg.startsWith('wisdm-scan://'));
    if (url) {
      handleProtocolUrl(url);
    }
  });

  app.whenReady().then(async () => {
    // Initialize system tray
    tray = initTray();

    // Check for stored credentials
    const supabaseUrl = store.get('supabaseUrl');
    const sessionToken = store.get('sessionToken');

    if (!supabaseUrl || !sessionToken) {
      console.log('No credentials found. Waiting for web app connection...');
    } else {
      console.log('Credentials loaded. Scanner ready.');
    }

    // Initialize scanner
    await scanner.initialize();
  });
}

// Handle protocol URLs on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

// Handle protocol URLs on Windows
if (process.platform === 'win32') {
  const url = process.argv.find((arg) => arg.startsWith('wisdm-scan://'));
  if (url) {
    app.whenReady().then(() => {
      handleProtocolUrl(url);
    });
  }
}

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// IPC handlers
ipcMain.handle('get-scanners', async () => {
  return await scanner.getScanners();
});

ipcMain.handle('scan-document', async (event, options) => {
  return await scanner.scanDocument(options);
});

ipcMain.handle('get-config', () => {
  return {
    supabaseUrl: store.get('supabaseUrl'),
    hasSession: !!store.get('sessionToken')
  };
});

ipcMain.handle('save-config', (event, config) => {
  store.set('supabaseUrl', config.supabaseUrl);
  store.set('sessionToken', config.sessionToken);
  store.set('projectId', config.projectId);
  store.set('customerId', config.customerId);
  return { success: true };
});

// Export for use in other modules
module.exports = { app, store };
