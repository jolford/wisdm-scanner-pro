import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  projectId: string;
  batchId?: string;
  batchName?: string;
  files: Array<{
    name: string;
    data: string; // base64
    type: string;
  }>;
  autoProcessOCR?: boolean;
}

// Declare EdgeRuntime global for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ImportRequest = await req.json();
    const { projectId, batchId, batchName, files, autoProcessOCR = false } = body;

    if (!projectId || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'projectId and files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, customer_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create batch
    let currentBatchId = batchId;
    if (!currentBatchId) {
      const { data: newBatch, error: batchError } = await supabase
        .from('batches')
        .insert({
          project_id: projectId,
          batch_name: batchName || `Import ${new Date().toISOString()}`,
          created_by: user.id,
          customer_id: project.customer_id,
          total_documents: files.length,
          status: 'new',
        })
        .select('id')
        .single();

      if (batchError) {
        throw new Error(`Failed to create batch: ${batchError.message}`);
      }
      currentBatchId = newBatch.id;
    } else {
      // Update existing batch document count by fetching current count and incrementing
      const { data: currentBatch } = await supabase
        .from('batches')
        .select('total_documents')
        .eq('id', currentBatchId)
        .single();
      
      await supabase
        .from('batches')
        .update({ 
          total_documents: (currentBatch?.total_documents || 0) + files.length
        })
        .eq('id', currentBatchId);
    }

    const uploadedDocuments = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        // Decode base64 file data
        const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        
        // Upload to storage
        const fileName = `${currentBatchId}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, fileData, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          errors.push({ file: file.name, error: uploadError.message });
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        // Create document record
        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            batch_id: currentBatchId,
            file_name: file.name,
            file_type: file.type,
            file_url: publicUrl,
            uploaded_by: user.id,
            validation_status: 'pending',
          })
          .select('id')
          .single();

        if (docError) {
          errors.push({ file: file.name, error: docError.message });
          continue;
        }

        uploadedDocuments.push({
          id: document.id,
          fileName: file.name,
          url: publicUrl,
        });
      } catch (error: any) {
        errors.push({ file: file.name, error: error.message });
      }
    }

    // Trigger parallel OCR processing for the entire batch if auto-process is enabled
    if (autoProcessOCR && uploadedDocuments.length > 0 && currentBatchId) {
      // Fire-and-forget: run OCR in the background so the import response returns quickly
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            await supabase.functions.invoke('parallel-ocr-batch', {
              body: {
                batchId: currentBatchId,
                maxParallel: 8, // Process 8 documents in parallel
              },
            });
          } catch (ocrError: any) {
            console.error('OCR batch processing error:', ocrError);
            // Intentionally do not throw – import should still be considered successful
          }
        })()
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchId: currentBatchId,
        uploaded: uploadedDocuments.length,
        failed: errors.length,
        documents: uploadedDocuments,
        errors: errors,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
