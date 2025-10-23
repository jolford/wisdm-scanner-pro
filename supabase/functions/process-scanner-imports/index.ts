import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting scanner import processing...');

    // Get all active import configurations
    const { data: configs, error: configError } = await supabaseAdmin
      .from('scanner_import_configs')
      .select('*, projects(id, name, customer_id)')
      .eq('is_active', true);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active import configurations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    // Process each configuration
    for (const config of configs) {
      try {
        console.log(`Processing config ${config.id} for project ${config.project_id}`);

        // List files in the watch folder
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from('scanner-import')
          .list(config.watch_folder || '', {
            limit: 100,
            sortBy: { column: 'created_at', order: 'asc' }
          });

        if (listError) {
          console.error(`Error listing files for config ${config.id}:`, listError);
          continue;
        }

        if (!files || files.length === 0) {
          console.log(`No files found in ${config.watch_folder}`);
          results.push({
            configId: config.id,
            processed: 0,
            message: 'No files found'
          });
          continue;
        }

        // Filter out directories and already processed files
        const fileList = files.filter(f => !f.id.endsWith('/'));

        let processedCount = 0;
        let failedCount = 0;
        let currentBatchId = null;

        for (const file of fileList) {
          try {
            const filePath = config.watch_folder 
              ? `${config.watch_folder}/${file.name}`
              : file.name;

            // Check if file was already processed
            const { data: existingLog } = await supabaseAdmin
              .from('scanner_import_logs')
              .select('id')
              .eq('config_id', config.id)
              .eq('file_path', filePath)
              .single();

            if (existingLog) {
              console.log(`Skipping already processed file: ${filePath}`);
              continue;
            }

            // Create or get batch
            if (!currentBatchId && config.auto_create_batch) {
              const batchName = config.batch_name_template.replace(
                '{date}',
                new Date().toISOString().split('T')[0]
              );

              const { data: batch, error: batchError } = await supabaseAdmin
                .from('batches')
                .insert({
                  project_id: config.project_id,
                  customer_id: config.customer_id,
                  batch_name: batchName,
                  created_by: config.created_by,
                  status: 'new'
                })
                .select('id')
                .single();

              if (batchError) throw batchError;
              currentBatchId = batch.id;
            }

            // Download file from storage
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from('scanner-import')
              .download(filePath);

            if (downloadError) throw downloadError;

            // Upload to documents bucket
            const newFileName = `${currentBatchId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabaseAdmin.storage
              .from('documents')
              .upload(newFileName, fileData, {
                contentType: fileData.type,
                upsert: false
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('documents')
              .getPublicUrl(newFileName);

            // Create document record
            const { data: document, error: docError } = await supabaseAdmin
              .from('documents')
              .insert({
                project_id: config.project_id,
                batch_id: currentBatchId,
                file_name: file.name,
                file_type: fileData.type,
                file_url: publicUrl,
                uploaded_by: config.created_by,
                validation_status: 'pending'
              })
              .select('id')
              .single();

            if (docError) throw docError;

            // Log successful import
            await supabaseAdmin.from('scanner_import_logs').insert({
              config_id: config.id,
              file_name: file.name,
              file_path: filePath,
              batch_id: currentBatchId,
              document_id: document.id,
              status: 'success'
            });

            // Move file to processed folder
            const processedPath = `processed/${config.watch_folder}/${file.name}`;
            await supabaseAdmin.storage
              .from('scanner-import')
              .move(filePath, processedPath);

            processedCount++;
            console.log(`Successfully imported: ${file.name}`);

          } catch (fileError: any) {
            failedCount++;
            console.error(`Error processing file ${file.name}:`, fileError);

            // Log failed import
            await supabaseAdmin.from('scanner_import_logs').insert({
              config_id: config.id,
              file_name: file.name,
              file_path: config.watch_folder ? `${config.watch_folder}/${file.name}` : file.name,
              status: 'failed',
              error_message: fileError.message
            });
          }
        }

        // Update last check time
        await supabaseAdmin
          .from('scanner_import_configs')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', config.id);

        results.push({
          configId: config.id,
          projectId: config.project_id,
          processed: processedCount,
          failed: failedCount,
          batchId: currentBatchId
        });

      } catch (configError: any) {
        console.error(`Error processing config ${config.id}:`, configError);
        results.push({
          configId: config.id,
          error: configError.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${configs.length} configurations`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-scanner-imports:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});