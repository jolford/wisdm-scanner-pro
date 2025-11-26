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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { batchId, projectId } = await req.json();

    if (!batchId || !projectId) {
      throw new Error('Missing batchId or projectId');
    }

    console.log('Starting Resware export for batch:', batchId);

    // Get project configuration
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('metadata, extraction_fields')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const reswareConfig = project.metadata?.export_config?.resware;
    if (!reswareConfig?.enabled) {
      throw new Error('Resware integration not enabled for this project');
    }

    // Get batch documents with extracted data
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('batch_id', batchId)
      .eq('validation_status', 'validated');

    if (docsError) {
      throw new Error(`Failed to fetch documents: ${docsError.message}`);
    }

    if (!documents || documents.length === 0) {
      throw new Error('No validated documents found in batch');
    }

    console.log(`Found ${documents.length} validated documents to export`);

    // Build Resware API request
    const reswareApiUrl = reswareConfig.url || reswareConfig.apiUrl;
    const reswareUsername = reswareConfig.username;
    const reswarePassword = reswareConfig.password;
    const orderId = reswareConfig.orderId || 'default';

    if (!reswareApiUrl || !reswareUsername || !reswarePassword) {
      throw new Error('Resware connection not configured properly');
    }

    // Process each document
    const exportResults = [];
    for (const doc of documents) {
      try {
        console.log('Exporting document:', doc.id);

        // Map extracted metadata to Resware fields
        const metadata = doc.extracted_metadata || {};
        const fieldMapping = reswareConfig.fieldMapping || {};

        // Build Resware payload with mapped fields
        const reswarePayload: any = {
          orderId: orderId,
          documentType: doc.document_type || 'Mortgage Application',
          documentId: doc.id,
          fileName: doc.file_name,
          uploadDate: doc.created_at,
          confidence: doc.confidence_score,
          borrowerInfo: {},
          loanDetails: {},
          customFields: {},
        };

        // Map borrower information fields
        const borrowerFields = ['Borrower Name', 'Social Security Number', 'Date of Birth', 
                               'Work Phone', 'Current Address', 'City', 'State', 'Zip', 'Citizenship'];
        borrowerFields.forEach(field => {
          const mappedField = fieldMapping[field] || field;
          if (metadata[field]) {
            reswarePayload.borrowerInfo[mappedField] = metadata[field];
          }
        });

        // Map loan details fields
        const loanFields = ['Loan Identifier', 'Monthly Income', 'Base Income', 'Overtime',
                           'Business Name', 'Business Address'];
        loanFields.forEach(field => {
          const mappedField = fieldMapping[field] || field;
          if (metadata[field]) {
            reswarePayload.loanDetails[mappedField] = metadata[field];
          }
        });

        // Map any custom fields not in standard categories
        Object.keys(metadata).forEach(key => {
          if (!borrowerFields.includes(key) && !loanFields.includes(key)) {
            const mappedField = fieldMapping[key] || key;
            reswarePayload.customFields[mappedField] = metadata[key];
          }
        });

        // Download document file for upload
        const { data: fileData, error: fileError } = await supabaseAdmin
          .storage
          .from('documents')
          .download(doc.file_url.split('/documents/')[1]);

        if (fileError) {
          throw new Error(`Failed to download document: ${fileError.message}`);
        }

        // Create multipart form data for file upload
        const formData = new FormData();
        formData.append('file', fileData, doc.file_name);
        formData.append('metadata', JSON.stringify(reswarePayload));

        // Send to Resware API
        const reswareResponse = await fetch(`${reswareApiUrl}/api/documents/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${reswareUsername}:${reswarePassword}`)}`,
          },
          body: formData,
        });

        if (!reswareResponse.ok) {
          const errorText = await reswareResponse.text();
          throw new Error(`Resware API error: ${reswareResponse.status} - ${errorText}`);
        }

        const reswareResult = await reswareResponse.json();
        console.log('Resware export successful:', reswareResult);

        exportResults.push({
          documentId: doc.id,
          success: true,
          reswareId: reswareResult.id || reswareResult.documentId,
        });

      } catch (docError: any) {
        console.error('Error exporting document:', doc.id, docError);
        exportResults.push({
          documentId: doc.id,
          success: false,
          error: docError.message,
        });
      }
    }

    // Update batch export status
    await supabaseAdmin
      .from('batches')
      .update({ exported_at: new Date().toISOString() })
      .eq('id', batchId);

    const successCount = exportResults.filter(r => r.success).length;
    console.log(`Export complete: ${successCount}/${documents.length} documents exported to Resware`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Exported ${successCount}/${documents.length} documents to Resware`,
        results: exportResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Resware export error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
