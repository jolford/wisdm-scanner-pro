// Edge function to export validated documents to Microsoft SharePoint
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

    // Extract SharePoint credentials from project config
    const sharepointConfig = batch.projects?.metadata?.export_config?.sharepoint;
    if (!sharepointConfig?.enabled || !sharepointConfig?.url || !sharepointConfig?.accessToken) {
      return new Response(
        JSON.stringify({ error: 'SharePoint is not configured for this project' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL to prevent SSRF attacks
    try {
      validateExternalUrl(sharepointConfig.url);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: `Invalid SharePoint URL: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sharepointUrl = sharepointConfig.url;
    const accessToken = sharepointConfig.accessToken;
    const libraryName = sharepointConfig.library || 'Documents';
    const folderPath = sharepointConfig.folder || '/';

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

    console.log(`Exporting ${documents.length} documents to SharePoint at ${sharepointUrl}`);

    // Prepare documents for SharePoint API
    const sharepointDocuments = documents.map(doc => ({
      Title: doc.file_name,
      FileLeafRef: doc.file_name,
      ContentType: doc.file_type,
      Metadata: doc.extracted_metadata || {},
      FileUrl: doc.file_url,
    }));

    // Send to SharePoint REST API
    const sharepointResponse = await fetch(
      `${sharepointUrl}/_api/web/lists/getbytitle('${libraryName}')/items`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json;odata=verbose',
        },
        body: JSON.stringify({
          __metadata: { type: 'SP.ListItem' },
          Title: batch.batch_name,
          FolderPath: folderPath,
          Documents: sharepointDocuments,
        }),
      }
    );

    if (!sharepointResponse.ok) {
      const errorText = await sharepointResponse.text();
      console.error('SharePoint API error:', errorText);
      throw new Error(`SharePoint API error: ${sharepointResponse.status}`);
    }

    const sharepointResult = await sharepointResponse.json();

    // Update batch metadata with export info
    await supabase
      .from('batches')
      .update({ 
        exported_at: new Date().toISOString(),
        metadata: {
          ...(batch.metadata || {}),
          sharepointExport: {
            exportedAt: new Date().toISOString(),
            documentsCount: documents.length,
            sharepointResponse: sharepointResult,
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
        message: `Successfully exported ${documents.length} documents to SharePoint and cleared batch`,
        sharepointResult,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error exporting to SharePoint:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to export to SharePoint. Please try again.',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
