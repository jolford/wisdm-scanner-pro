/**
 * Scanner Auto-Import Sync Agent
 * 
 * This service monitors a local network folder where scanners save files
 * and automatically uploads them to Supabase Storage for processing.
 * 
 * Setup:
 * 1. Install Node.js (https://nodejs.org)
 * 2. Run: npm install @supabase/supabase-js chokidar dotenv
 * 3. Create a .env file with your Supabase credentials
 * 4. Run: node scanner-sync-agent.js
 */

import { createClient } from '@supabase/supabase-js';
import chokidar from 'chokidar';
import { readFileSync } from 'fs';
import { basename, extname } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration
const WATCH_FOLDER = process.env.WATCH_FOLDER || 'C\\:\\\AutoImport';
const BUCKET_NAME = 'scanner-import';
const BUCKET_PATH = process.env.BUCKET_PATH || 'auto-import'; // This is your "watch folder" in the cloud
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Optional
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Optional (public)
const SUPABASE_EMAIL = process.env.SUPABASE_EMAIL; // Optional if using anon login
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD; // Optional if using anon login

// Supported file types
const SUPPORTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Initialize Supabase client (service key preferred, else anon + login)
let supabase;
if (SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('Auth mode: service key');
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Auth mode: user login with anon key');
}

// Track uploaded files to avoid duplicates
const uploadedFiles = new Set();

console.log('=================================');
console.log('Scanner Auto-Import Sync Agent');
console.log('=================================');
console.log(`Watching folder: ${WATCH_FOLDER}`);
console.log(`Upload to: ${BUCKET_NAME}/${BUCKET_PATH}`);
console.log(`Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`);
console.log('=================================\n');

/**
 * Upload file to Supabase Storage
 */
async function uploadFile(filePath) {
  try {
    const fileName = basename(filePath);
    const fileExt = extname(filePath).toLowerCase();
    
    // Check if already uploaded
    if (uploadedFiles.has(fileName)) {
      console.log(`⏭️  Skipping ${fileName} (already uploaded)`);
      return;
    }

    // Validate file extension
    if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
      console.log(`⚠️  Skipping ${fileName} (unsupported format)`);
      return;
    }

    // Read file
    const fileBuffer = readFileSync(filePath);
    
    // Check file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      console.error(`❌ File ${fileName} exceeds 50MB limit`);
      return;
    }

    // Determine content type
    const contentType = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    }[fileExt] || 'application/octet-stream';

    // Upload to Supabase Storage
    const storagePath = `${BUCKET_PATH}/${fileName}`;
    console.log(`📤 Uploading ${fileName}...`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`⏭️  ${fileName} already exists in storage`);
        uploadedFiles.add(fileName);
      } else {
        console.error(`❌ Upload failed for ${fileName}:`, error.message);
      }
      return;
    }

    console.log(`✅ Uploaded ${fileName} successfully`);
    uploadedFiles.add(fileName);

    // Auto-delete local file after successful upload
    unlinkSync(filePath);
    console.log(`🗑️  Deleted local file ${fileName}`);

  } catch (error) {
    console.error(`❌ Error processing ${basename(filePath)}:`, error.message);
  }
}

/**
 * Initialize file watcher
 */
function startWatcher() {
  const watcher = chokidar.watch(WATCH_FOLDER, {
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000, // Wait 2s after file stops changing
      pollInterval: 100
    }
  });

  watcher
    .on('add', (path) => {
      console.log(`📁 New file detected: ${basename(path)}`);
      uploadFile(path);
    })
    .on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });

  console.log('👀 Watching for new files...\n');
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    if (SUPABASE_SERVICE_KEY) {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      const bucketExists = data.some(b => b.name === BUCKET_NAME);
      if (!bucketExists) throw new Error(`Bucket '${BUCKET_NAME}' not found`);
    } else {
      // With user login, try listing the destination folder
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(BUCKET_PATH || '', { limit: 1 });
      if (error) throw error;
    }
    console.log('✅ Connected to Storage and authorized\n');
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.error('Please check your environment variables in .env file\n');
    return false;
  }
}

/**
 * Start the sync agent
 */
async function start() {
  // If not using service key, sign in with email/password
  if (!SUPABASE_SERVICE_KEY) {
    if (!SUPABASE_ANON_KEY || !SUPABASE_EMAIL || !SUPABASE_PASSWORD) {
      console.error('❌ Missing SUPABASE_ANON_KEY, SUPABASE_EMAIL, or SUPABASE_PASSWORD in .env');
      process.exit(1);
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: SUPABASE_EMAIL,
      password: SUPABASE_PASSWORD,
    });
    if (error) {
      console.error('❌ Login failed:', error.message);
      process.exit(1);
    }
    console.log(`✅ Signed in as ${data.user?.email}`);
  }

  const isHealthy = await healthCheck();
  if (!isHealthy) {
    process.exit(1);
  }

  startWatcher();
}

// Start the agent
start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down sync agent...');
  process.exit(0);
});
