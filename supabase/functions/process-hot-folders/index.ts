import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting hot folder monitoring process...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active scanner import configs (hot folders)
    const { data: configs, error: configError } = await supabase
      .from('scanner_import_configs')
      .select(`
        *,
        projects (
          id,
          name,
          customer_id
        )
      `)
      .eq('is_active', true);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    console.log(`Found ${configs?.length || 0} active hot folder configs`);

    let totalProcessed = 0;
    let totalErrors = 0;
    const results = [];

    for (const config of configs || []) {
      console.log(`Processing hot folder: ${config.watch_folder} for project ${config.projects?.name}`);
      
      try {
        // In a real implementation, this would:
        // 1. Connect to network share or local folder via SMB/NFS
        // 2. List files in the watch folder
        // 3. Filter for supported file types (PDF, TIFF, JPEG, PNG)
        // 4. For each file:
        //    - Upload to Supabase storage
        //    - Create document record
        //    - Optionally create/add to batch
        //    - Move/delete source file
        //    - Log import
        
        // NOTE: Actual file system access from Deno edge functions is limited
        // This is a placeholder that demonstrates the workflow
        // In production, you'd use a desktop agent or server-side service
        
        const mockFiles: string[] = []; // Would be real files from folder scan
        
        if (mockFiles.length === 0) {
          console.log(`No files found in ${config.watch_folder}`);
          
          // Update last check time
          await supabase
            .from('scanner_import_configs')
            .update({ last_check_at: new Date().toISOString() })
            .eq('id', config.id);
          
          results.push({
            config_id: config.id,
            folder: config.watch_folder,
            files_processed: 0,
            success: true
          });
          continue;
        }

        // Process each file
        for (const file of mockFiles) {
          try {
            // Create batch if auto_create_batch is enabled and no recent batch exists
            let batchId = null;
            if (config.auto_create_batch) {
              const batchName = config.batch_name_template.replace(
                '{date}',
                new Date().toISOString().split('T')[0]
              );
              
              // Check for existing batch from today
              const { data: existingBatch } = await supabase
                .from('batches')
                .select('id')
                .eq('project_id', config.project_id)
                .eq('batch_name', batchName)
                .gte('created_at', new Date().toISOString().split('T')[0])
                .single();
              
              if (existingBatch) {
                batchId = existingBatch.id;
              } else {
                // Create new batch
                const { data: newBatch, error: batchError } = await supabase
                  .from('batches')
                  .insert({
                    project_id: config.project_id,
                    batch_name: batchName,
                    created_by: config.created_by,
                    customer_id: config.customer_id,
                    status: 'new',
                    metadata: { source: 'hot_folder', config_id: config.id }
                  })
                  .select('id')
                  .single();
                
                if (!batchError && newBatch) {
                  batchId = newBatch.id;
                }
              }
            }

            // Upload file to storage
            // const { data: uploadData, error: uploadError } = await supabase.storage
            //   .from('documents')
            //   .upload(`${config.project_id}/${file.name}`, file);

            // Create document record
            // const { error: docError } = await supabase
            //   .from('documents')
            //   .insert({...});

            // Log successful import
            await supabase
              .from('scanner_import_logs')
              .insert({
                config_id: config.id,
                file_name: 'example.pdf', // file.name
                file_path: config.watch_folder,
                status: 'success',
                batch_id: batchId,
                document_id: null // Would be actual doc ID
              });

            totalProcessed++;
          } catch (fileError) {
            console.error(`Error processing file:`, fileError);
            
            // Log failed import
            await supabase
              .from('scanner_import_logs')
              .insert({
                config_id: config.id,
                file_name: 'error-file.pdf',
                file_path: config.watch_folder,
                status: 'failed',
                error_message: fileError instanceof Error ? fileError.message : 'Unknown error'
              });
            
            totalErrors++;
          }
        }

        // Update last check time
        await supabase
          .from('scanner_import_configs')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', config.id);

        results.push({
          config_id: config.id,
          folder: config.watch_folder,
          files_processed: mockFiles.length,
          success: true
        });

      } catch (configError) {
        console.error(`Error processing config ${config.id}:`, configError);
        
        // Update config with error
        await supabase
          .from('scanner_import_configs')
          .update({ 
            last_check_at: new Date().toISOString(),
            last_error: configError instanceof Error ? configError.message : 'Unknown error'
          })
          .eq('id', config.id);
        
        results.push({
          config_id: config.id,
          folder: config.watch_folder,
          error: configError instanceof Error ? configError.message : 'Unknown error',
          success: false
        });
        totalErrors++;
      }
    }

    console.log(`Hot folder processing complete. Processed: ${totalProcessed}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total_configs: configs?.length || 0,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Hot folder processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
