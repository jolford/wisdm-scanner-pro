const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

/**
 * Upload scanned document to Supabase storage and create document record
 */
async function uploadToSupabase(options) {
  const {
    filePath,
    fileName,
    projectId,
    batchId,
    customerId,
    sessionToken,
    supabaseUrl
  } = options;

  try {
    // Initialize Supabase client with session token
    const supabase = createClient(supabaseUrl, sessionToken, {
      auth: {
        persistSession: false
      }
    });

    // Read file
    const fileBuffer = await fs.readFile(filePath);
    const fileSize = (await fs.stat(filePath)).size;

    // Generate storage path
    const storageFileName = `${Date.now()}_${fileName}`;
    const storagePath = `${customerId}/${projectId}/${storageFileName}`;

    // Upload to storage bucket
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return {
        success: false,
        error: storageError.message
      };
    }

    console.log('File uploaded to storage:', storageData.path);

    // Create document record in database
    const { data: documentData, error: documentError } = await supabase
      .from('documents')
      .insert({
        batch_id: batchId,
        project_id: projectId,
        customer_id: customerId,
        file_name: fileName,
        file_path: storageData.path,
        file_size: fileSize,
        document_type: 'scanned',
        status: 'pending_ocr',
        source: 'desktop_scanner',
        metadata: {
          scanner_source: 'ricoh_sdk',
          scanned_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (documentError) {
      console.error('Document creation error:', documentError);
      
      // Try to clean up uploaded file
      await supabase.storage
        .from('documents')
        .remove([storageData.path]);

      return {
        success: false,
        error: documentError.message
      };
    }

    console.log('Document record created:', documentData.id);

    // Clean up local temp file
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Failed to delete temp file:', error);
    }

    return {
      success: true,
      documentId: documentData.id,
      storagePath: storageData.path
    };

  } catch (error) {
    console.error('Upload error:', error);
    
    // Check if it's a network error
    const isNetworkError = 
      error.message?.includes('fetch') || 
      error.message?.includes('network') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.code === 'ENOTFOUND';
    
    return {
      success: false,
      error: error.message,
      isNetworkError
    };
  }
}

/**
 * Check if online by attempting to reach Supabase
 */
async function checkOnline(supabaseUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    return response.ok || response.status === 401;
  } catch (error) {
    return false;
  }
}

module.exports = { uploadToSupabase, checkOnline };
