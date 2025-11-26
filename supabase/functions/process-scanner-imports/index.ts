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

        // List all items in the watch folder (including directories)
        const { data: items, error: listError } = await supabaseAdmin.storage
          .from('scanner-import')
          .list(config.watch_folder || '', {
            limit: 100,
            sortBy: { column: 'created_at', order: 'asc' }
          });

        if (listError) {
          console.error(`Error listing items for config ${config.id}:`, listError);
          continue;
        }

        if (!items || items.length === 0) {
          console.log(`No items found in ${config.watch_folder}`);
          results.push({
            configId: config.id,
            processed: 0,
            message: 'No items found'
          });
          continue;
        }

        // Separate directories from files
        const directories = items.filter(item => item.id && item.id.endsWith('/'));
        const rootFiles = items.filter(item => !item.id || !item.id.endsWith('/'));

        let totalProcessedCount = 0;
        let totalFailedCount = 0;

        // Process subdirectories (each becomes a separate batch)
        for (const dir of directories) {
          try {
            const dirName = dir.name;
            const dirPath = config.watch_folder 
              ? `${config.watch_folder}/${dirName}`
              : dirName;

            console.log(`Processing subdirectory: ${dirPath}`);

            // List files within this subdirectory
            const { data: subFiles, error: subListError } = await supabaseAdmin.storage
              .from('scanner-import')
              .list(dirPath, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'asc' }
              });

            if (subListError || !subFiles || subFiles.length === 0) {
              console.log(`No files in subdirectory ${dirPath}`);
              continue;
            }

            // Filter out any nested directories (only process files)
            const filesInDir = subFiles.filter(f => !f.id || !f.id.endsWith('/'));

            if (filesInDir.length === 0) {
              console.log(`No files to process in ${dirPath}`);
              continue;
            }

            // Create a batch for this subdirectory
            let subDirBatchId = null;
            
            if (config.auto_create_batch) {
              const batchName = config.batch_name_template
                .replace('{date}', new Date().toISOString().split('T')[0])
                .replace('{folder}', dirName)
                + ` - ${dirName}`;

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

              if (batchError) {
                console.error(`Error creating batch for ${dirName}:`, batchError);
                continue;
              }
              subDirBatchId = batch.id;
              console.log(`Created batch ${subDirBatchId} for subdirectory ${dirName}`);
            }

            // Process files in this subdirectory
            for (const file of filesInDir) {
              try {
                const filePath = `${dirPath}/${file.name}`;

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

                // Download file from storage
                const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                  .from('scanner-import')
                  .download(filePath);

                if (downloadError) throw downloadError;

                // Upload to documents bucket
                const newFileName = `${subDirBatchId}/${Date.now()}_${file.name}`;
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
                    batch_id: subDirBatchId,
                    file_name: file.name,
                    file_type: fileData.type,
                    file_url: publicUrl,
                    uploaded_by: config.created_by,
                    validation_status: 'pending'
                  })
                  .select('id')
                  .single();

                if (docError) throw docError;

                // Create OCR job
                const { error: jobError } = await supabaseAdmin
                  .from('jobs')
                  .insert({
                    job_type: 'ocr_document',
                    user_id: config.created_by,
                    customer_id: config.customer_id,
                    priority: 'normal',
                    payload: {
                      documentId: document.id,
                      fileUrl: publicUrl,
                      projectId: config.project_id,
                      batchId: subDirBatchId,
                      isPdf: false
                    },
                    status: 'pending'
                  });

                if (jobError) {
                  console.error(`Failed to create job for document ${document.id}:`, jobError);
                }

                // Log successful import
                await supabaseAdmin.from('scanner_import_logs').insert({
                  config_id: config.id,
                  file_name: file.name,
                  file_path: filePath,
                  batch_id: subDirBatchId,
                  document_id: document.id,
                  status: 'success'
                });

                // Move file to processed folder (preserve subdirectory structure)
                const processedPath = `processed/${dirPath}/${file.name}`;
                await supabaseAdmin.storage
                  .from('scanner-import')
                  .move(filePath, processedPath);

                totalProcessedCount++;
                console.log(`Successfully imported: ${file.name} from ${dirName}`);

              } catch (fileError: any) {
                totalFailedCount++;
                console.error(`Error processing file ${file.name} in ${dirName}:`, fileError);

                await supabaseAdmin.from('scanner_import_logs').insert({
                  config_id: config.id,
                  file_name: file.name,
                  file_path: `${dirPath}/${file.name}`,
                  status: 'failed',
                  error_message: fileError.message
                });
              }
            }
          } catch (dirError: any) {
            console.error(`Error processing subdirectory ${dir.name}:`, dirError);
            totalFailedCount++;
          }
        }

        // Process root-level files (if any)
        if (rootFiles.length > 0) {
          let rootBatchId = null;

          if (config.auto_create_batch) {
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

            if (!batchError) {
              rootBatchId = batch.id;
              console.log(`Created batch ${rootBatchId} for root-level files`);
            }
          }

          for (const file of rootFiles) {
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

              // Download file from storage
              const { data: fileData, error: downloadError } = await supabaseAdmin.storage
                .from('scanner-import')
                .download(filePath);

              if (downloadError) throw downloadError;

              // Upload to documents bucket
              const newFileName = `${rootBatchId}/${Date.now()}_${file.name}`;
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
                  batch_id: rootBatchId,
                  file_name: file.name,
                  file_type: fileData.type,
                  file_url: publicUrl,
                  uploaded_by: config.created_by,
                  validation_status: 'pending'
                })
                .select('id')
                .single();

              if (docError) throw docError;

              // Create OCR job
              const { error: jobError } = await supabaseAdmin
                .from('jobs')
                .insert({
                  job_type: 'ocr_document',
                  user_id: config.created_by,
                  customer_id: config.customer_id,
                  priority: 'normal',
                  payload: {
                    documentId: document.id,
                    fileUrl: publicUrl,
                    projectId: config.project_id,
                    batchId: rootBatchId,
                    isPdf: false
                  },
                  status: 'pending'
                });

              if (jobError) {
                console.error(`Failed to create job for document ${document.id}:`, jobError);
              }

              // Log successful import
              await supabaseAdmin.from('scanner_import_logs').insert({
                config_id: config.id,
                file_name: file.name,
                file_path: filePath,
                batch_id: rootBatchId,
                document_id: document.id,
                status: 'success'
              });

              // Move file to processed folder
              const processedPath = `processed/${config.watch_folder}/${file.name}`;
              await supabaseAdmin.storage
                .from('scanner-import')
                .move(filePath, processedPath);

              totalProcessedCount++;
              console.log(`Successfully imported root file: ${file.name}`);

            } catch (fileError: any) {
              totalFailedCount++;
              console.error(`Error processing root file ${file.name}:`, fileError);

              await supabaseAdmin.from('scanner_import_logs').insert({
                config_id: config.id,
                file_name: file.name,
                file_path: config.watch_folder ? `${config.watch_folder}/${file.name}` : file.name,
                status: 'failed',
                error_message: fileError.message
              });
            }
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
          processed: totalProcessedCount,
          failed: totalFailedCount,
          subdirectoriesProcessed: directories.length,
          rootFilesProcessed: rootFiles.length
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