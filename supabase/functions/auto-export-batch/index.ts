import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { batchId } = await req.json();

    // Set export_started_at timestamp to track export duration
    await supabase
      .from('batches')
      .update({ export_started_at: new Date().toISOString() })
      .eq('id', batchId);

    // Get batch with project info
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(`
        *,
        projects (
          id,
          name,
          export_types,
          metadata
        )
      `)
      .eq('id', batchId)
      .single();

    if (batchError) throw batchError;

    // Get validated documents
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('batch_id', batchId)
      .eq('validation_status', 'validated')
      .order('created_at', { ascending: false });

    if (docsError) throw docsError;

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No validated documents to export' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const project = batch.projects;
    const exportConfig = project?.metadata?.exportConfig || {};
    const exportTypes = project?.export_types || [];
    
    const exports: any[] = [];

    // Generate exports for each enabled type
    for (const exportType of exportTypes) {
      const config = exportConfig[exportType];
      if (!config?.enabled) continue;

      const destination = config.destination || '/exports/';
      let content = '';
      let mimeType = '';

      switch (exportType) {
        case 'csv':
          const metadataKeys = new Set<string>();
          documents.forEach(doc => {
            if (doc.extracted_metadata) {
              Object.keys(doc.extracted_metadata).forEach(key => metadataKeys.add(key));
            }
          });
          
          const headers = ['File Name', 'Date', ...Array.from(metadataKeys)];
          const rows = documents.map(doc => {
            const row: string[] = [
              doc.file_name,
              new Date(doc.created_at).toLocaleDateString(),
            ];
            metadataKeys.forEach(key => {
              row.push(doc.extracted_metadata?.[key] || '');
            });
            return row;
          });
          
          content = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
          ].join('\n');
          mimeType = 'text/csv';
          break;

        case 'json':
          const jsonData = {
            batch: {
              id: batch.id,
              name: batch.batch_name,
              status: batch.status,
              created_at: batch.created_at,
              total_documents: batch.total_documents,
              validated_documents: batch.validated_documents,
            },
            documents: documents.map(doc => ({
              file_name: doc.file_name,
              validation_status: doc.validation_status,
              page_number: doc.page_number,
              confidence_score: doc.confidence_score,
              file_type: doc.file_type,
              extracted_metadata: doc.extracted_metadata,
              extracted_text: doc.extracted_text,
            }))
          };
          content = JSON.stringify(jsonData, null, 2);
          mimeType = 'application/json';
          break;

        case 'xml':
          const xmlDocs = documents.map(doc => {
            const metadata = Object.entries(doc.extracted_metadata || {})
              .map(([key, value]) => `    <${key}>${value}</${key}>`)
              .join('\n');
            return `  <document>
    <file_name>${doc.file_name}</file_name>
    <validation_status>${doc.validation_status}</validation_status>
    <page_number>${doc.page_number}</page_number>
    <metadata>
${metadata}
    </metadata>
  </document>`;
          }).join('\n');

          content = `<?xml version="1.0" encoding="UTF-8"?>
<batch>
  <name>${batch.batch_name}</name>
  <status>${batch.status}</status>
  <documents>
${xmlDocs}
  </documents>
</batch>`;
          mimeType = 'application/xml';
          break;

        case 'txt':
          content = documents.map(doc => {
            const metadata = Object.entries(doc.extracted_metadata || {})
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n');
            return `File: ${doc.file_name}\nStatus: ${doc.validation_status}\nPage: ${doc.page_number}\n${metadata}\n\nExtracted Text:\n${doc.extracted_text || 'N/A'}\n\n${'='.repeat(80)}\n`;
          }).join('\n');
          mimeType = 'text/plain';
          break;
      }

      if (content) {
        exports.push({
          type: exportType,
          destination: destination,
          content: content,
          mimeType: mimeType,
          fileName: `${batch.batch_name}-${Date.now()}.${exportType}`
        });
      }
    }

    // Update batch with export timestamp and clear export_started_at
    await supabase
      .from('batches')
      .update({ 
        exported_at: new Date().toISOString(),
        export_started_at: null,
        metadata: {
          ...(batch.metadata || {}),
          exports: exports.map(e => ({
            type: e.type,
            destination: e.destination,
            fileName: e.fileName,
            exportedAt: new Date().toISOString()
          }))
        }
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Batch exported successfully to configured destinations`,
        exports: exports.map(e => ({
          type: e.type,
          destination: e.destination,
          fileName: e.fileName
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    // Log detailed error server-side only
    console.error('Error auto-exporting batch:', error);
    
    // Return safe generic message to client
    return new Response(
      JSON.stringify({ 
        error: 'Failed to export batch. Please try again.',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});