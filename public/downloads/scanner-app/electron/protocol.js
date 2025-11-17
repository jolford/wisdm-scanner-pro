const { store } = require('./main');
const scanner = require('../src/scanner');
const { uploadToSupabase, checkOnline } = require('../src/uploader');
const queueManager = require('../src/queue-manager');

/**
 * Handle wisdm-scan:// protocol URLs
 * Format: wisdm-scan://scan?token=SESSION_TOKEN&project=PROJECT_ID&batch=BATCH_ID&supabase=SUPABASE_URL
 */
async function handleProtocolUrl(url) {
  try {
    console.log('Received protocol URL:', url);

    // Parse URL
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    const sessionToken = params.get('token');
    const projectId = params.get('project');
    const batchId = params.get('batch');
    const customerId = params.get('customer');
    const supabaseUrl = params.get('supabase');

    // Validate required parameters
    if (!sessionToken || !projectId || !supabaseUrl) {
      console.error('Missing required parameters in protocol URL');
      return;
    }

    // Save credentials
    store.set('sessionToken', sessionToken);
    store.set('supabaseUrl', supabaseUrl);
    store.set('projectId', projectId);
    store.set('customerId', customerId);

    console.log('Credentials saved. Initiating scan...');

    // Get available scanners
    const scanners = await scanner.getScanners();
    
    if (scanners.length === 0) {
      console.error('No scanners detected');
      // TODO: Show notification to user
      return;
    }

    // Use first available scanner (or let user choose in settings)
    const selectedScanner = scanners[0];

    // Perform scan
    const scanResult = await scanner.scanDocument({
      scanner: selectedScanner,
      resolution: 300, // DPI
      colorMode: 'color', // 'color', 'grayscale', 'blackwhite'
      duplex: false
    });

    if (!scanResult.success) {
      console.error('Scan failed:', scanResult.error);
      return;
    }

    console.log('Scan successful. Checking connection...');

    // Check if online
    const isOnline = await checkOnline(supabaseUrl);

    if (!isOnline) {
      console.log('Offline mode: Adding to upload queue');
      
      // Add to queue for later upload
      await queueManager.addToQueue({
        filePath: scanResult.filePath,
        fileName: scanResult.fileName,
        projectId,
        batchId,
        customerId,
        sessionToken,
        supabaseUrl
      });

      const queueCount = queueManager.getQueueCount();
      console.log(`Document queued. ${queueCount} items in queue.`);
      // TODO: Show notification "Scan saved. Will upload when online."
      
      return;
    }

    // Online: Upload immediately
    console.log('Online: Uploading to Supabase...');
    
    const uploadResult = await uploadToSupabase({
      filePath: scanResult.filePath,
      fileName: scanResult.fileName,
      projectId,
      batchId,
      customerId,
      sessionToken,
      supabaseUrl
    });

    if (uploadResult.success) {
      console.log('Upload successful:', uploadResult.documentId);
      // TODO: Show success notification
    } else {
      // Check if it's a network error
      if (uploadResult.isNetworkError) {
        console.log('Network error detected: Adding to upload queue');
        
        // Add to queue for retry
        await queueManager.addToQueue({
          filePath: scanResult.filePath,
          fileName: scanResult.fileName,
          projectId,
          batchId,
          customerId,
          sessionToken,
          supabaseUrl
        });

        const queueCount = queueManager.getQueueCount();
        console.log(`Document queued. ${queueCount} items in queue.`);
        // TODO: Show notification "Network error. Document queued for upload."
      } else {
        console.error('Upload failed:', uploadResult.error);
        // TODO: Show error notification
      }
    }

  } catch (error) {
    console.error('Error handling protocol URL:', error);
  }
}

module.exports = { handleProtocolUrl };
