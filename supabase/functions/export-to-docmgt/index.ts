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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batchId, docmgtUrl, docmgtApiKey } = await req.json();

    if (!docmgtUrl || !docmgtApiKey) {
      return new Response(
        JSON.stringify({ error: 'Docmgt URL and API key are required' }),
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

    console.log(`Exporting ${documents.length} documents to Docmgt at ${docmgtUrl}`);

    // Prepare documents for Docmgt API
    const docmgtDocuments = documents.map(doc => ({
      fileName: doc.file_name,
      fileType: doc.file_type,
      fileUrl: doc.file_url,
      metadata: doc.extracted_metadata || {},
      fullText: doc.extracted_text || '',
      page: doc.page_number,
      confidence: doc.confidence_score,
      validationStatus: doc.validation_status,
      validatedAt: doc.validated_at,
    }));

    // Send to Docmgt API
    const docmgtResponse = await fetch(`${docmgtUrl}/api/v1/documents/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': docmgtApiKey,
      },
      body: JSON.stringify({
        batch: {
          name: batch.batch_name,
          project: batch.projects?.name,
          totalDocuments: batch.total_documents,
          validatedDocuments: batch.validated_documents,
          status: batch.status,
        },
        documents: docmgtDocuments,
      }),
    });

    if (!docmgtResponse.ok) {
      const errorText = await docmgtResponse.text();
      console.error('Docmgt API error:', errorText);
      throw new Error(`Docmgt API error: ${docmgtResponse.status}`);
    }

    const docmgtResult = await docmgtResponse.json();

    // Update batch metadata with export info
    await supabase
      .from('batches')
      .update({ 
        exported_at: new Date().toISOString(),
        metadata: {
          ...(batch.metadata || {}),
          docmgtExport: {
            exportedAt: new Date().toISOString(),
            documentsCount: documents.length,
            docmgtResponse: docmgtResult,
          }
        }
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully exported ${documents.length} documents to Docmgt`,
        docmgtResult,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error exporting to Docmgt:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to export to Docmgt. Please try again.',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
