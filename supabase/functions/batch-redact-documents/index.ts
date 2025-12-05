import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchRedactRequest {
  documentIds: string[];
  preset?: string;
  customKeyword?: string;
  categories?: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body: BatchRedactRequest = await req.json();
    const { documentIds, preset, customKeyword, categories } = body;

    if (!documentIds || documentIds.length === 0) {
      throw new Error('No document IDs provided');
    }

    console.log(`Batch redaction request: ${documentIds.length} documents, preset: ${preset}`);

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    // Process each document
    for (const docId of documentIds) {
      try {
        // Fetch document
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('id, file_url, extracted_text, word_bounding_boxes, project_id')
          .eq('id', docId)
          .single();

        if (docError || !doc) {
          results.failed.push({ id: docId, error: 'Document not found' });
          continue;
        }

        // Call auto-redact function for each document
        const { data: redactResult, error: redactError } = await supabase.functions.invoke(
          'auto-redact-ab1466',
          {
            body: {
              documentId: docId,
              extractedText: doc.extracted_text,
              wordBoundingBoxes: doc.word_bounding_boxes,
              forceRedaction: true,
              // Pass redaction configuration
              redactionConfig: {
                preset,
                customKeyword,
                categories,
              }
            }
          }
        );

        if (redactError) {
          console.error(`Redaction failed for ${docId}:`, redactError);
          results.failed.push({ id: docId, error: redactError.message });
        } else {
          results.success.push(docId);
        }
      } catch (docProcessError: any) {
        console.error(`Error processing document ${docId}:`, docProcessError);
        results.failed.push({ id: docId, error: docProcessError.message });
      }
    }

    // Log audit entry
    await supabase.from('audit_trail').insert({
      user_id: user.id,
      action_type: 'batch_redaction',
      entity_type: 'documents',
      metadata: {
        document_count: documentIds.length,
        success_count: results.success.length,
        failed_count: results.failed.length,
        preset,
        categories,
      },
      success: results.failed.length === 0,
    });

    return new Response(
      JSON.stringify({
        message: `Processed ${documentIds.length} documents`,
        results,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Batch redaction error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 500 
      }
    );
  }
});
