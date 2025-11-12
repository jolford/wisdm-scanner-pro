const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Load native Ricoh SDK addon
let ricohScanner;
try {
  ricohScanner = require('../build/Release/ricoh-scanner.node');
} catch (error) {
  console.error('Failed to load Ricoh SDK native addon:', error);
  ricohScanner = null;
}

class ScannerManager {
  constructor() {
    this.initialized = false;
    this.scanners = [];
  }

  async initialize() {
    if (!ricohScanner) {
      throw new Error('Ricoh SDK addon not loaded');
    }

    try {
      const result = ricohScanner.initialize();
      this.initialized = result.success;
      console.log('Ricoh SDK initialized:', result);
      
      // Auto-detect scanners
      await this.refreshScanners();
      
      return result;
    } catch (error) {
      console.error('Failed to initialize Ricoh SDK:', error);
      throw error;
    }
  }

  async refreshScanners() {
    if (!ricohScanner || !this.initialized) {
      return [];
    }

    try {
      this.scanners = ricohScanner.getScanners();
      console.log(`Detected ${this.scanners.length} scanner(s):`, this.scanners);
      return this.scanners;
    } catch (error) {
      console.error('Failed to get scanners:', error);
      return [];
    }
  }

  async getScanners() {
    if (this.scanners.length === 0) {
      await this.refreshScanners();
    }
    return this.scanners;
  }

  async scanDocument(options = {}) {
    if (!ricohScanner || !this.initialized) {
      return { success: false, error: 'Scanner not initialized' };
    }

    const {
      scanner = this.scanners[0],
      resolution = 300,
      colorMode = 'color',
      duplex = false,
      outputFormat = 'pdf'
    } = options;

    if (!scanner) {
      return { success: false, error: 'No scanner available' };
    }

    try {
      console.log('Starting scan with options:', { scanner: scanner.name, resolution, colorMode, duplex });

      // Create temp directory for scanned files
      const tempDir = path.join(os.tmpdir(), 'wisdm-scanner');
      await fs.mkdir(tempDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `scan_${timestamp}.${outputFormat}`;
      const filePath = path.join(tempDir, fileName);

      // Perform scan using Ricoh SDK
      const scanResult = ricohScanner.scan({
        scannerId: scanner.id,
        resolution,
        colorMode,
        duplex,
        outputPath: filePath
      });

      if (!scanResult.success) {
        return {
          success: false,
          error: scanResult.error || 'Scan failed'
        };
      }

      // Verify file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return {
          success: false,
          error: 'Scanned file not found'
        };
      }

      return {
        success: true,
        filePath,
        fileName,
        pageCount: scanResult.pageCount || 1,
        fileSize: (await fs.stat(filePath)).size
      };

    } catch (error) {
      console.error('Scan error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanup() {
    if (ricohScanner && this.initialized) {
      ricohScanner.cleanup();
      this.initialized = false;
    }
  }
}

// Export singleton instance
module.exports = new ScannerManager();
