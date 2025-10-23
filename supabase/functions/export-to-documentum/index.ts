// Edge function to export validated documents to OpenText Documentum
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL validation helper to prevent SSRF attacks
function validateExternalUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTPS
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  // Block private IP ranges and localhost
  const hostname = url.hostname.toLowerCase();
  
  // Block localhost variations
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Localhost URLs are not allowed');
  }

  // Block private IP ranges (RFC 1918)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = hostname.match(ipv4Regex);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    // 10.0.0.0/8
    if (octets[0] === 10) throw new Error('Private IP addresses are not allowed');
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) throw new Error('Private IP addresses are not allowed');
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) throw new Error('Private IP addresses are not allowed');
    // 169.254.0.0/16 (link-local)
    if (octets[0] === 169 && octets[1] === 254) throw new Error('Link-local addresses are not allowed');
  }

  // Block IPv6 private ranges
  if (hostname.includes(':')) {
    if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) {
      throw new Error('Private IPv6 addresses are not allowed');
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    const { batchId } = await req.json();

    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'Batch ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get batch with project (including credentials)
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(`
        *,
        projects (
          id,
          name,
          extraction_fields,
          metadata
        )
      `)
      .eq('id', batchId)
      .single();

    if (batchError) throw batchError;

    // Extract Documentum credentials from project config
    const documentumConfig = batch.projects?.metadata?.export_config?.documentum;
    if (!documentumConfig?.enabled || !documentumConfig?.url || !documentumConfig?.username || !documentumConfig?.password) {
      return new Response(
        JSON.stringify({ error: 'Documentum is not configured for this project' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL to prevent SSRF attacks
    try {
      validateExternalUrl(documentumConfig.url);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: `Invalid Documentum URL: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const documentumUrl = documentumConfig.url;
    const username = documentumConfig.username;
    const password = documentumConfig.password;
    const repository = documentumConfig.repository || 'default';
    const cabinet = documentumConfig.cabinet || '/';

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

    console.log(`Exporting ${documents.length} documents to Documentum at ${documentumUrl}`);

    // Prepare documents for Documentum API
    const documentumDocuments = documents.map(doc => ({
      object_name: doc.file_name,
      r_object_type: 'dm_document',
      a_content_type: doc.file_type,
      properties: doc.extracted_metadata || {},
      content_url: doc.file_url,
    }));

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);
    
    // Send to Documentum REST API
    const documentumResponse = await fetch(
      `${documentumUrl}/dctm-rest/repositories/${repository}/folders/path:${cabinet}/documents`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authString}`,
        },
        body: JSON.stringify({
          name: batch.batch_name,
          type: 'dm_folder',
          documents: documentumDocuments,
        }),
      }
    );

    if (!documentumResponse.ok) {
      const errorText = await documentumResponse.text();
      console.error('Documentum API error:', errorText);
      throw new Error(`Documentum API error: ${documentumResponse.status}`);
    }

    const documentumResult = await documentumResponse.json();

    // Update batch metadata with export info
    await supabase
      .from('batches')
      .update({ 
        exported_at: new Date().toISOString(),
        metadata: {
          ...(batch.metadata || {}),
          documentumExport: {
            exportedAt: new Date().toISOString(),
            documentsCount: documents.length,
            documentumResponse: documentumResult,
          }
        }
      })
      .eq('id', batchId);

    // Auto-delete batch and documents after successful export
    await supabase
      .from('documents')
      .delete()
      .eq('batch_id', batchId);

    await supabase
      .from('batches')
      .delete()
      .eq('id', batchId);

    console.log(`Auto-deleted batch ${batchId} and its ${documents.length} documents after successful export`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully exported ${documents.length} documents to Documentum and cleared batch`,
        documentumResult,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error exporting to Documentum:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to export to Documentum. Please try again.',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
