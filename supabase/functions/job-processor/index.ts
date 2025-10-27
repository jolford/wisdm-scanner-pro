/**
 * Job Processor Edge Function
 * 
 * Background job processing system that handles asynchronous tasks using a fair-share
 * scheduling algorithm. Processes jobs from the queue and updates their status.
 * 
 * Supported Job Types:
 * - ocr_document: OCR processing and data extraction from documents
 * - export_batch: Batch export to external systems (placeholder)
 * 
 * Features:
 * - Fair-share scheduling (distributes load evenly across customers)
 * - Automatic retry with exponential backoff
 * - Job metrics tracking (completion time, success/failure rates)
 * - Cost tracking per customer
 * - Status updates (pending → processing → completed/failed)
 * 
 * Retry Logic:
 * - Maximum 3 attempts per job
 * - Exponential backoff: 2min, 4min, 8min between retries
 * - Jobs marked as 'failed' after max attempts
 * 
 * Job Flow:
 * 1. Get next job using get_next_job() RPC (fair-share)
 * 2. Fetch job details from database
 * 3. Process based on job_type
 * 4. Update job status (completed/failed)
 * 5. Update metrics and cost tracking
 * 
 * @invocation Triggered manually or by scheduler (cron)
 * @requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Environment variables - secrets managed by Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// CORS headers for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Job interface matching database schema
interface Job {
  id: string;
  job_type: string;
  payload: any;            // Job-specific data
  customer_id: string | null;
  user_id: string;
  attempts: number;        // Retry counter
  started_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Job processor starting...');
    
    // Get next job using fair-share scheduling
    let { data: jobId, error: jobError } = await supabase.rpc('get_next_job');
    
    if (jobError) {
      console.error('Error getting next job via RPC:', jobError);
      jobId = null;
    }

    // Fallback: direct query for any pending job if RPC returned nothing
    if (!jobId) {
      const { data: anyPending, error: pendingErr } = await supabase
        .from('jobs')
        .select('id')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pendingErr) {
        console.error('Fallback pending job query failed:', pendingErr);
      }
      jobId = anyPending?.id ?? null;
    }

    if (!jobId) {
      console.log('No pending jobs');
      return new Response(JSON.stringify({ message: 'No pending jobs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch job details
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      console.error('Error fetching job:', fetchError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing job ${job.id} of type ${job.job_type}`);

    let result: any;
    let error: string | undefined;

    // Process based on job type
    switch (job.job_type) {
      case 'ocr_document':
        ({ result, error } = await processOcrDocument(job, supabase));
        break;
      
      case 'export_batch': {
        const exportResult = await processExportBatch(job, supabase);
        result = exportResult.result;
        error = undefined;
        break;
      }
      
      default:
        error = `Unknown job type: ${job.job_type}`;
    }

    // Update job status
    if (error) {
      await updateJobFailed(supabase, job, error);
    } else {
      await updateJobCompleted(supabase, job.id, result);
    }

    // Update metrics
    await updateMetrics(supabase, job, !!error);

    return new Response(
      JSON.stringify({ 
        jobId: job.id, 
        status: error ? 'failed' : 'completed',
        result,
        error 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Job processor error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processOcrDocument(job: Job, supabase: any) {
  const { imageData, extractionFields, projectId, batchId, documentId, isPdf, textData, fileUrl, file_url } = job.payload;

  try {
    // If no image/text data but a file URL is provided, download using signed URL
    let finalImageData = imageData;
    let finalTextData = textData;

    const effectiveFileUrl = fileUrl || file_url;
    if (!finalImageData && !finalTextData && effectiveFileUrl) {
      // Extract bucket and path from the URL
      const urlMatch = effectiveFileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (!urlMatch) throw new Error('Invalid storage URL format');
      
      const [, bucket, filePath] = urlMatch;
      
      // Use signed URL for authenticated download
      const { data: signedData, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 300); // 5 min expiry
      
      if (signError) throw new Error(`Failed to create signed URL: ${signError.message}`);
      
      const resp = await fetch(signedData.signedUrl);
      if (!resp.ok) throw new Error(`Failed to download file: ${resp.status}`);
      
      const buf = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      
      if (!contentType.includes('pdf')) {
        finalImageData = `data:${contentType};base64,${base64}`;
      }
    }

    // Call ocr-scan edge function
    const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('ocr-scan', {
      body: {
        imageData: finalImageData,
        isPdf,
        extractionFields,
        textData: finalTextData,
      }
    });

    if (ocrError) {
      console.error('OCR function error:', ocrError);
      return { error: `OCR processing failed: ${ocrError.message}` };
    }

    const { text: extractedText, metadata: extractedMetadata, documentType, confidence } = ocrResult;

    // Track cost (estimate based on document processing)
    const estimatedCost = 0.002; // Default estimate per document

    // Update tenant usage
    if (job.customer_id) {
      await supabase.rpc('update_tenant_usage', {
        _customer_id: job.customer_id,
        _job_type: 'ocr_document',
        _cost_usd: estimatedCost,
        _documents_count: 1,
        _failed: false
      });
    }

    // Prepare document update with classification
    const updateData: any = {
      extracted_text: extractedText,
      extracted_metadata: extractedMetadata || {},
      validation_status: 'pending'
    };
    
    // Add classification if available
    if (documentType) {
      updateData.extracted_metadata = {
        ...updateData.extracted_metadata,
        documentType,
        classificationConfidence: confidence || 0
      };
      
      // If confidence is high, set confidence score
      if (confidence && confidence >= 0.9) {
        updateData.confidence_score = confidence;
      }
    }

    // Update document in database
    const { error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    if (updateError) {
      return { error: `Failed to update document: ${updateError.message}` };
    }

    // Update batch counts
    if (batchId) {
      await supabase.rpc('increment', {
        table_name: 'batches',
        row_id: batchId,
        column_name: 'processed_documents'
      });
    }

    return { 
      result: { 
        documentId, 
        extractedText: extractedText.substring(0, 200) + '...',
        metadata: extractedMetadata,
        documentType,
        confidence
      } 
    };

  } catch (error: any) {
    console.error('OCR processing error:', error);
    return { error: error.message };
  }
}

async function processExportBatch(job: Job, supabase: any) {
  // Placeholder for batch export processing
  return { result: { message: 'Export processing not yet implemented' } };
}

async function updateJobCompleted(supabase: any, jobId: string, result: any) {
  await supabase
    .from('jobs')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

async function updateJobFailed(supabase: any, job: Job, errorMessage: string) {
  const newAttempts = job.attempts + 1;
  const maxAttempts = 3;

  if (newAttempts >= maxAttempts) {
    // Final failure
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        attempts: newAttempts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  } else {
    // Retry with exponential backoff
    const retryDelay = Math.pow(2, newAttempts) * 60; // 2min, 4min, 8min
    await supabase
      .from('jobs')
      .update({
        status: 'pending',
        error_message: errorMessage,
        attempts: newAttempts,
        scheduled_for: new Date(Date.now() + retryDelay * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

async function updateMetrics(supabase: any, job: Job, failed: boolean) {
  const now = new Date();
  const metricDate = now.toISOString().split('T')[0];
  const metricHour = now.getHours();

  const processingTime = job.started_at 
    ? Date.now() - new Date(job.started_at).getTime()
    : 0;

  try {
    await supabase.rpc('upsert_job_metric', {
      _customer_id: job.customer_id,
      _job_type: job.job_type,
      _metric_date: metricDate,
      _metric_hour: metricHour,
      _completed: !failed,
      _failed: failed,
      _processing_time_ms: processingTime,
    });
  } catch (err: any) {
    console.error('Failed to update metrics:', err);
  }
}
