import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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

    const { batchId, recordTypeId: overrideRecordTypeId } = await req.json();

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

    // Extract Docmgt credentials from project config (support legacy metadata path)
    const projectMeta = batch.projects?.metadata || {};
    const docmgtConfig = batch.projects?.docmgt_config || projectMeta?.export_config?.docmgt;
    if (!docmgtConfig?.enabled || !docmgtConfig?.url || !docmgtConfig?.username || !docmgtConfig?.password) {
      return new Response(
        JSON.stringify({ error: 'Docmgt is not configured for this project' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL to prevent SSRF attacks
    try {
      validateExternalUrl(docmgtConfig.url);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: `Invalid Docmgt URL: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const docmgtUrl = docmgtConfig.url;
    const username = docmgtConfig.username;
    const password = docmgtConfig.password;
    const project = docmgtConfig.project;

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

    // DocMgt REST API uses /rest/ prefix directly from base URL
    const baseUrl = docmgtUrl
      .replace(/\/+$/, '')
      .replace(/\/(rest|v4api|api)$/i, '');
    console.log('DocMgt base URL normalized:', baseUrl);


    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);

    // Use override RecordTypeID or parse from project config
    let recordTypeId: number | null = overrideRecordTypeId ? Number(overrideRecordTypeId) : null;
    if (!recordTypeId && project && !isNaN(Number(project))) {
      recordTypeId = Number(project);
    }
    console.log('DocMgt using RecordTypeID:', recordTypeId);

    // Map WISDM metadata keys to DocMgt variable names if provided
    const fieldMappings: Record<string, string> = (docmgtConfig as any).fieldMappings || {};

    const exportResults = [] as any[];

    for (const doc of documents) {
      const metadata = (doc.extracted_metadata || {}) as Record<string, any>;

      // Download document file from Supabase storage
      let fileBlob: Blob | null = null;
      let fileName = doc.file_name || 'document';
      try {
        if (doc.file_url) {
          // Extract storage path from URL
          const urlParts = doc.file_url.split('/storage/v1/object/public/documents/');
          const storagePath = urlParts[1];
          
          if (storagePath) {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('documents')
              .download(storagePath);
            
            if (!downloadError && fileData) {
              fileBlob = fileData;
              console.log(`Downloaded file ${fileName} (${fileBlob.size} bytes)`);
            } else {
              console.warn(`Failed to download file for doc ${doc.id}:`, downloadError);
            }
          }
        }
      } catch (err) {
        console.warn(`Error downloading file for doc ${doc.id}:`, err);
      }

      // Build DocMgt record payload from metadata
      const datasArray = Object.entries(metadata).map(([key, value]) => ({
        DataName: fieldMappings[key] || key,
        DataValue: String(typeof value === 'object' && value && 'value' in (value as any) ? (value as any).value : value ?? ''),
      }));

      let lastError: string | null = null;
      let success = false;
      let recordId: number | string | null = null;
      let documentId: number | string | null = null;

      // Step 1: Ensure we have a RecordTypeID
      if (!recordTypeId) {
        lastError = 'DocMgt RecordTypeID not configured';
        exportResults.push({ success: false, error: lastError, fileName });
        continue;
      }

      // Step 1: Create Record
      try {
        const recordPayload = { RecordTypeID: recordTypeId, Datas: datasArray } as any;
        const createRecordUrl = `${baseUrl}/rest/records`;
        console.log('Creating DocMgt record at:', createRecordUrl, 'payload:', recordPayload);

        const resp = await fetch(createRecordUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Basic ${authString}`,
          },
          body: JSON.stringify(recordPayload),
        });

        const text = await resp.text();
        if (resp.ok) {
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          recordId = json?.ID || json?.id || json?.RecordID || json?.RecordId;
          success = !!recordId;
          exportResults.push({ step: 'record', success, request: { url: createRecordUrl }, response: json || text, recordId });
        } else {
          lastError = text || `HTTP ${resp.status}`;
          console.error('DocMgt create record error:', { url: createRecordUrl, status: resp.status, response: text.slice(0, 500) });
        }
      } catch (err: any) {
        lastError = err.message;
        console.error('DocMgt record request error:', err);
      }

      // Step 2: Create Document attached to record
      if (success && recordId) {
        try {
          const documentPayload = {
            RecordID: recordId,
            Name: fileName,
            FileName: fileName,
            Status: 1,
          } as any;

          const createDocUrl = `${baseUrl}/rest/documents`;
          console.log('Creating DocMgt document at:', createDocUrl, 'payload:', documentPayload);

          const resp = await fetch(createDocUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Basic ${authString}`,
            },
            body: JSON.stringify(documentPayload),
          });

          const text = await resp.text();
          if (resp.ok) {
            let json: any = null;
            try { json = JSON.parse(text); } catch {}
            documentId = json?.ID || json?.id;
            exportResults.push({ step: 'document', success: !!documentId, request: { url: createDocUrl }, response: json || text, recordId, documentId });
            success = !!documentId;
          } else {
            lastError = text || `HTTP ${resp.status}`;
            console.error('DocMgt create document error:', { url: createDocUrl, status: resp.status, response: text.slice(0, 500) });
          }
        } catch (err: any) {
          lastError = err.message;
          console.error('DocMgt document request error:', err);
        }
      }

      // Step 3: Upload file binary
      if (success && documentId && fileBlob) {
        try {
          const uploadUrl = `${baseUrl}/rest/documents/${documentId}/binary`;
          console.log(`Uploading file to ${uploadUrl}`);
          const uploadResp = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/octet-stream',
            },
            body: fileBlob,
          });

          if (uploadResp.ok) {
            exportResults.push({ step: 'upload', success: true, documentId, recordId, fileName });

            // Optional finalize call if supported
            try {
              const finalizeUrl = `${baseUrl}/rest/documents/${documentId}/uploadcomplete`;
              const finalizeResp = await fetch(finalizeUrl, { headers: { 'Authorization': `Basic ${authString}` } });
              if (finalizeResp.ok) {
                exportResults.push({ step: 'finalize', success: true, documentId });
              }
            } catch {}
          } else {
            const errorText = await uploadResp.text();
            console.warn(`File upload failed for document ${documentId}:`, errorText);
            exportResults.push({ step: 'upload', success: false, documentId, error: errorText.slice(0, 200) });
          }
        } catch (fileErr: any) {
          exportResults.push({ step: 'upload', success: false, documentId, error: fileErr.message });
          console.error(`Error uploading file for document ${documentId}:`, fileErr);
        }
      } else if (success && !fileBlob) {
        exportResults.push({ step: 'upload', success: false, warning: 'No file available to upload', recordId, documentId });
      }

      if (!success) {
        exportResults.push({ success: false, error: lastError, recordId, documentId, fileName });
      }

    }

    const successCount = exportResults.filter(r => r.success).length;

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
            successCount,
            results: exportResults,
          }
        }
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        message: `Successfully exported ${successCount} of ${documents.length} documents to Docmgt`,
        results: exportResults,
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
