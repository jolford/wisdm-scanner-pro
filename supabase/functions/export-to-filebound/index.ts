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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use user's JWT token to respect RLS policies
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { batchId, fileboundUrl, username, password, project } = await req.json();

    if (!fileboundUrl || !username || !password || !project) {
      return new Response(
        JSON.stringify({ error: 'Filebound URL, username, password, and project are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get batch with documents
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(`
        *,
        projects (
          id,
          name,
          extraction_fields
        )
      `)
      .eq('id', batchId)
      .single();

    if (batchError) throw batchError;

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

    console.log(`Exporting ${documents.length} documents to Filebound at ${fileboundUrl}`);

    // Prepare documents for Filebound API
    const fileboundDocuments = documents.map(doc => ({
      documentName: doc.file_name,
      documentType: doc.file_type,
      metadata: doc.extracted_metadata || {},
      extractedText: doc.extracted_text || '',
      fileUrl: doc.file_url,
      pageNumber: doc.page_number,
      confidenceScore: doc.confidence_score,
    }));

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);
    
    // Send to Filebound API
    const fileboundResponse = await fetch(`${fileboundUrl}/api/documents/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify({
        project: project,
        batchName: batch.batch_name,
        projectName: batch.projects?.name,
        documents: fileboundDocuments,
      }),
    });

    if (!fileboundResponse.ok) {
      const errorText = await fileboundResponse.text();
      console.error('Filebound API error:', errorText);
      throw new Error(`Filebound API error: ${fileboundResponse.status}`);
    }

    const fileboundResult = await fileboundResponse.json();

    // Update batch metadata with export info
    await supabase
      .from('batches')
      .update({ 
        exported_at: new Date().toISOString(),
        metadata: {
          ...(batch.metadata || {}),
          fileboundExport: {
            exportedAt: new Date().toISOString(),
            documentsCount: documents.length,
            fileboundResponse: fileboundResult,
          }
        }
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully exported ${documents.length} documents to Filebound`,
        fileboundResult,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error exporting to Filebound:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to export to Filebound. Please try again.',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
