const Store = require('electron-store');
const fs = require('fs').promises;
const path = require('path');
const { uploadToSupabase } = require('./uploader');

const store = new Store();
const QUEUE_KEY = 'upload_queue';
const MAX_RETRIES = 5;

/**
 * Manage offline document queue with automatic retry
 */
class QueueManager {
  constructor() {
    this.isProcessing = false;
    this.retryInterval = null;
  }

  /**
   * Add document to upload queue
   */
  async addToQueue(options) {
    const queue = store.get(QUEUE_KEY, []);
    
    const queueItem = {
      id: Date.now().toString(),
      ...options,
      addedAt: new Date().toISOString(),
      retries: 0,
      status: 'pending'
    };

    queue.push(queueItem);
    store.set(QUEUE_KEY, queue);
    
    console.log(`Added to queue: ${queueItem.fileName} (ID: ${queueItem.id})`);
    
    return queueItem;
  }

  /**
   * Get all queued items
   */
  getQueue() {
    return store.get(QUEUE_KEY, []);
  }

  /**
   * Get queue count
   */
  getQueueCount() {
    return this.getQueue().length;
  }

  /**
   * Remove item from queue
   */
  removeFromQueue(itemId) {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    store.set(QUEUE_KEY, filtered);
  }

  /**
   * Update item status
   */
  updateQueueItem(itemId, updates) {
    const queue = this.getQueue();
    const updated = queue.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );
    store.set(QUEUE_KEY, updated);
  }

  /**
   * Check if online by attempting to reach Supabase
   */
  async isOnline(supabaseUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      return response.ok || response.status === 401; // 401 means server is reachable
    } catch (error) {
      return false;
    }
  }

  /**
   * Process upload queue
   */
  async processQueue() {
    if (this.isProcessing) {
      console.log('Queue processing already in progress');
      return;
    }

    this.isProcessing = true;
    const queue = this.getQueue();

    if (queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    console.log(`Processing queue: ${queue.length} items`);

    for (const item of queue) {
      if (item.status === 'uploading') {
        continue; // Skip items currently being uploaded
      }

      // Check if file still exists
      try {
        await fs.access(item.filePath);
      } catch (error) {
        console.error(`File not found: ${item.filePath}`);
        this.removeFromQueue(item.id);
        continue;
      }

      // Check if online before attempting upload
      const online = await this.isOnline(item.supabaseUrl);
      
      if (!online) {
        console.log('Still offline, will retry later');
        break;
      }

      // Mark as uploading
      this.updateQueueItem(item.id, { status: 'uploading' });

      // Attempt upload
      const result = await uploadToSupabase({
        filePath: item.filePath,
        fileName: item.fileName,
        projectId: item.projectId,
        batchId: item.batchId,
        customerId: item.customerId,
        sessionToken: item.sessionToken,
        supabaseUrl: item.supabaseUrl
      });

      if (result.success) {
        console.log(`Successfully uploaded queued item: ${item.fileName}`);
        this.removeFromQueue(item.id);
      } else {
        // Increment retry count
        const newRetries = item.retries + 1;
        
        if (newRetries >= MAX_RETRIES) {
          console.error(`Max retries reached for: ${item.fileName}`);
          this.updateQueueItem(item.id, { 
            status: 'failed', 
            retries: newRetries,
            lastError: result.error 
          });
        } else {
          console.log(`Upload failed, will retry (${newRetries}/${MAX_RETRIES}): ${item.fileName}`);
          this.updateQueueItem(item.id, { 
            status: 'pending', 
            retries: newRetries,
            lastError: result.error 
          });
        }
      }

      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
  }

  /**
   * Start automatic queue processing with retry
   */
  startAutoProcessing(intervalMs = 60000) {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }

    console.log(`Starting auto-processing with ${intervalMs}ms interval`);
    
    this.retryInterval = setInterval(() => {
      const queueCount = this.getQueueCount();
      if (queueCount > 0) {
        console.log(`Auto-processing: ${queueCount} items in queue`);
        this.processQueue();
      }
    }, intervalMs);

    // Also process immediately
    this.processQueue();
  }

  /**
   * Stop automatic queue processing
   */
  stopAutoProcessing() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * Clear failed items from queue
   */
  clearFailedItems() {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.status !== 'failed');
    store.set(QUEUE_KEY, filtered);
    console.log(`Cleared ${queue.length - filtered.length} failed items`);
  }
}

module.exports = new QueueManager();
