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

    const { batchId, recordTypeId: overrideRecordTypeId, docmgtUrl: bodyUrl, username: bodyUser, password: bodyPass, project: bodyProject } = await req.json();

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
      .maybeSingle();

    if (batchError) throw batchError;
    
    if (!batch) {
      return new Response(
        JSON.stringify({ error: 'Batch not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract Docmgt credentials from project config (support legacy metadata path)
    const projectMeta = batch.projects?.metadata || {};
    const baseDocmgtConfig = batch.projects?.docmgt_config || projectMeta?.export_config?.docmgt || {};
    const inferredEnabled = baseDocmgtConfig?.enabled ?? Boolean(bodyUrl && (bodyUser || bodyPass));
    const docmgtConfig = {
      ...baseDocmgtConfig,
      enabled: inferredEnabled,
      url: bodyUrl || baseDocmgtConfig.url,
      username: bodyUser || baseDocmgtConfig.username,
      password: bodyPass || baseDocmgtConfig.password,
      project: bodyProject || baseDocmgtConfig.project,
      recordTypeId: overrideRecordTypeId ?? baseDocmgtConfig.recordTypeId,
    } as any;

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
    console.log('DocMgt auth user:', username);


    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);

    // Use override RecordTypeID or get from config (recordTypeId field takes precedence over project field)
    let recordTypeId: number | null = null;
    
    if (overrideRecordTypeId) {
      recordTypeId = Number(overrideRecordTypeId);
    } else if (docmgtConfig.recordTypeId) {
      recordTypeId = Number(docmgtConfig.recordTypeId);
    } else if (project && !isNaN(Number(project))) {
      recordTypeId = Number(project);
    }
    
    console.log('DocMgt using RecordTypeID:', recordTypeId);
    
    // Validate RecordTypeID by fetching available record types first
    let availableRecordTypes: any[] = [];
    let recordTypeValid = false;
    
    if (recordTypeId) {
      const endpoints = ['/rest/recordtypes', '/rest/records/types', '/rest/recordtypes/list', '/rest/recordtypes/all'];
      for (const ep of endpoints) {
        try {
          const resp = await fetch(`${baseUrl}${ep}`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
            },
          });
          const ct = resp.headers.get('content-type') || '';
          if (resp.ok && ct.includes('application/json')) {
            availableRecordTypes = await resp.json();
            console.log(`Fetched ${availableRecordTypes.length} available RecordTypes from ${ep}`);
            break;
          }
        } catch (e) {
          console.warn(`Failed to fetch record types from ${ep}:`, e);
        }
      }
      
      // Check if the configured RecordTypeID is in the list of available types
      if (availableRecordTypes.length > 0) {
        const found = availableRecordTypes.find((rt: any) => {
          const rtId = rt.ID ?? rt.id ?? rt.RecordTypeId ?? rt.RecordTypeID;
          return rtId && Number(rtId) === recordTypeId;
        });
        
        if (found) {
          recordTypeValid = true;
          console.log(`Validated RecordTypeID ${recordTypeId} - Name: ${found.Name || found.name || 'Unknown'}`);
        } else {
          // RecordTypeID not found - return helpful error with available options
          const availableIds = availableRecordTypes.map((rt: any) => {
            const id = rt.ID ?? rt.id ?? rt.RecordTypeId ?? rt.RecordTypeID;
            const name = rt.Name || rt.name || rt.RecordTypeName || 'Unnamed';
            return { id, name };
          }).filter(rt => rt.id);
          
          console.error(`RecordTypeID ${recordTypeId} not found. Available RecordTypes:`, availableIds);
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: `RecordTypeID ${recordTypeId} not found or you don't have access to it.`,
              availableRecordTypes: availableIds,
              message: availableIds.length > 0 
                ? `Available RecordTypes: ${availableIds.map(rt => `${rt.name} (ID: ${rt.id})`).join(', ')}`
                : 'No accessible RecordTypes found. Please verify your credentials have the correct permissions.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      }
    }
    // Map WISDM metadata keys to DocMgt variable names if provided
    const fieldMappings: Record<string, string> = (docmgtConfig as any).fieldMappings || {};

    const exportResults = [] as any[];
    let successDocCount = 0;

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
        lastError = 'DocMgt RecordTypeID not configured. Please set the RecordTypeID in project settings or override in export request.';
        exportResults.push({ success: false, error: lastError, fileName });
        continue;
      }

      // Step 1: Create Record
      try {
        const recordPayload = { 
          RecordTypeID: recordTypeId, 
          RecordTypeId: recordTypeId, // compatibility: some instances expect camel-case Id
          Datas: datasArray 
        } as any;
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
          
          // Add specific error message for insufficient rights
          if (text.includes('Insufficient Rights') || text.includes('No Record Type Found')) {
            lastError = `DocMgt RecordTypeID ${recordTypeId} not found or insufficient permissions. Please verify the RecordTypeID in project settings.`;
          }
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
              successDocCount++;

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

    const successCount = successDocCount;

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

    // Auto-delete batch and documents only if ALL documents exported successfully
    if (successCount === documents.length && documents.length > 0) {
      // Delete all documents in the batch
      await supabase
        .from('documents')
        .delete()
        .eq('batch_id', batchId);

      // Delete the batch itself
      await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

      console.log(`Auto-deleted batch ${batchId} and its ${documents.length} documents after successful export`);
    }

    const clearedText = successCount === documents.length && documents.length > 0 ? ' and cleared batch' : '';

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        message: `Successfully exported ${successCount} of ${documents.length} documents to Docmgt${clearedText}`,
        results: exportResults,
        // Help UI surface choices if there was a RecordType-related failure
        availableRecordTypes: (Array.isArray(availableRecordTypes) ? availableRecordTypes.map((rt: any) => ({
          id: rt.ID ?? rt.id ?? rt.RecordTypeId ?? rt.RecordTypeID,
          name: rt.Name || rt.name || rt.RecordTypeName || 'Unnamed'
        })).filter((rt: any) => rt.id) : []),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error exporting to Docmgt:', error);
    
    // Provide detailed error message
    let errorMessage = 'Failed to export to Docmgt';
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Add stack trace to logs for debugging
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        details: error.toString(),
        availableRecordTypes: [],
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
