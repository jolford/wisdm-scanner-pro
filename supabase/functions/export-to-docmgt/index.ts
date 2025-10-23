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

    const { batchId, apiBase, recordTypeId: overrideRecordTypeId } = await req.json();

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

    // Normalize URL (remove trailing slash)
    const normalizedDocmgtUrl = docmgtUrl.replace(/\/+$/, '');

    // Try common base path variants (some DocMgt installs use /V4, /V4API, /DocMgt, or /api)
    let baseCandidates = Array.from(new Set([
      normalizedDocmgtUrl,
      `${normalizedDocmgtUrl}/V4`,
      `${normalizedDocmgtUrl}/v4`,
      `${normalizedDocmgtUrl}/V4API`,
      `${normalizedDocmgtUrl}/v4api`,
      `${normalizedDocmgtUrl}/DocMgt`,
      `${normalizedDocmgtUrl}/docmgt`,
      `${normalizedDocmgtUrl}/api`,
    ])).map(u => u.replace(/\/+$/, ''));

    if (apiBase) {
      baseCandidates = [apiBase.replace(/\/+$/, '')];
      console.log('DocMgt override base', baseCandidates[0]);
    }

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);

    // Resolve RecordType by name or ID (allow override)
    const recordTypeEndpoints = ['/recordtypes','/rest/recordtypes','/rest/records/types','/api/recordtypes','/api/records/types'];
    let recordTypeId: number | null = overrideRecordTypeId ? Number(overrideRecordTypeId) : null;
    if (!recordTypeId && project && !isNaN(Number(project))) {
      recordTypeId = Number(project);
    }
    if (!recordTypeId) {
      for (const base of baseCandidates) {
        for (const ep of recordTypeEndpoints) {
          try {
            const rtResp = await fetch(`${base}${ep}`, {
              method: 'GET',
              headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' },
            });
            const rtCT = rtResp.headers.get('content-type') || '';
            const preview = await rtResp.text();
            if (rtResp.ok && (rtCT.includes('application/json') || preview.startsWith('[') || preview.startsWith('{'))) {
              let rts: any = null; try { rts = JSON.parse(preview); } catch {}
              const found = Array.isArray(rts)
                ? rts.find((r: any) => String(r.ID) === String(project) || r.Name === project || r.name === project)
                : null;
              recordTypeId = found?.ID ?? (Array.isArray(rts) && rts.length ? rts[0].ID ?? null : null);
              console.log('DocMgt record types resolved via', `${base}${ep}`, 'recordTypeId:', recordTypeId);
              break;
            } else {
              console.warn('DocMgt recordtypes probe failed', { url: `${base}${ep}`, status: rtResp.status, ct: rtCT, preview: preview.slice(0,120) });
            }
          } catch (e) {
            console.warn('Could not resolve DocMgt RecordType list at', `${base}${ep}`, e);
          }
        }
        if (recordTypeId) break;
      }
    } else {
      console.log('DocMgt using override recordTypeId', recordTypeId);
    }

    // Prepare documents for Docmgt API (create records)
    const fieldMappings: Record<string, string> = docmgtConfig.fieldMappings || {};
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

      // Build both objects array (Variables) and simple key map (Fields)
      const variables = Object.entries(metadata).map(([key, value]) => ({
        VariableName: fieldMappings[key] || key,
        DataName: fieldMappings[key] || key,
        DataValue: value,
      }));
      const fieldsMap: Record<string, any> = {};
      variables.forEach(v => { fieldsMap[v.VariableName] = v.DataValue; });

      // Ensure RecordType is explicitly provided for DocMgt APIs
      if (project) {
        // Add to map and variables if not already present
        if (!fieldsMap.RecordType) fieldsMap.RecordType = project;
        const hasRecordTypeVar = variables.some(v => v.VariableName === 'RecordType' || v.DataName === 'RecordType');
        if (!hasRecordTypeVar) {
          variables.push({ VariableName: 'RecordType', DataName: 'RecordType', DataValue: project });
        }
      }

      // Also prepare a Field array format used by some DocMgt endpoints
      const fieldArray = Object.entries(fieldsMap).map(([FieldName, FieldValue]) => ({ FieldName, FieldValue }));

      const payloadCandidates = recordTypeId
        ? [
            { RecordTypeID: recordTypeId, Variables: variables },
            { RecordTypeID: recordTypeId, Fields: fieldsMap },
            { RecordTypeID: recordTypeId, Fields: fieldArray },
          ]
        : [
            { RecordTypeName: project, Variables: variables },
            { RecordTypeName: project, Fields: fieldsMap },
            { RecordTypeName: project, Fields: fieldArray },
            { Fields: fieldsMap },
            { Fields: fieldArray },
            { RecordType: project, Variables: variables },
            { RecordType: project, Fields: fieldsMap },
            { RecordType: project, Fields: fieldArray },
          ];

      let lastError: string | null = null;
      let success = false;
      let recordId: string | number | null = null;
      
      // Step 1: Create the record with metadata
      const recordCreateEndpoints = apiBase
        ? ['/rest/record','/rest/records','/record','/records']
        : [
            '/records',
            '/record',
            '/rest/records',
            '/rest/record',
            '/api/records',
            '/api/record',
            '/rest/records/add',
            '/rest/record/add',
            '/api/records/add',
            '/api/record/create',
          ];

      for (const base of baseCandidates) {
        for (const endpoint of recordCreateEndpoints) {
          for (const body of payloadCandidates) {
            try {
              const resp = await fetch(`${base}${endpoint}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Basic ${authString}`,
                },
                body: JSON.stringify(body),
              });
              const ct = resp.headers.get('content-type') || '';
              const text = await resp.text();
              if (resp.ok && (ct.includes('application/json') || text.startsWith('{'))) {
                let json: any = null;
                try { json = JSON.parse(text); } catch {}
                
                // Extract record ID from response
                recordId = json?.ID || json?.id || json?.RecordID || json?.RecordId;
                
                exportResults.push({ 
                  success: true, 
                  request: { url: `${base}${endpoint}`, body }, 
                  response: json || text,
                  recordId 
                });
                success = true;
                break;
              } else {
                lastError = text || `HTTP ${resp.status}`;
                console.error('Docmgt API error:', { url: `${base}${endpoint}`, lastError });
                if (lastError?.toLowerCase().includes('no record type')) {
                  console.warn('DocMgt indicates the Record Type is not found or user lacks rights. Verify the selected Record Type and that the account has Create rights.');
                }
              }
            } catch (err: any) {
              lastError = err.message;
              console.error('Docmgt request error:', { url: `${base}${endpoint}`, err });
            }
            if (success) break;
          }
          if (success) break;
        }
        if (success) break;
      }

      // Step 2: Upload document file if record was created and file exists
      if (success && recordId && fileBlob) {
        try {
          const formData = new FormData();
          formData.append('file', fileBlob, fileName);
          
          // Try multiple file upload endpoints
           const uploadEndpoints = apiBase
            ? [
                `/rest/records/${recordId}/files`,
                `/rest/records/${recordId}/attachments`,
              ]
            : [
                `/records/${recordId}/files`,
                `/records/${recordId}/attachments`,
                `/files?recordId=${recordId}`,
                `/rest/records/${recordId}/files`,
                `/rest/records/${recordId}/attachments`,
                `/rest/files?recordId=${recordId}`,
              ];
          
          let fileUploaded = false;
          for (const endpoint of uploadEndpoints) {
            try {
               const uploadResp = await fetch(`${(apiBase ? baseCandidates[0] : normalizedDocmgtUrl)}${endpoint}`, {
                 method: 'POST',
                 headers: {
                   'Authorization': `Basic ${authString}`,
                 },
                 body: formData,
               });
              
              if (uploadResp.ok) {
                console.log(`File uploaded successfully to ${endpoint} for record ${recordId}`);
                exportResults[exportResults.length - 1].fileUploaded = true;
                exportResults[exportResults.length - 1].fileName = fileName;
                fileUploaded = true;
                break;
              }
            } catch (uploadErr) {
              console.warn(`Failed to upload file to ${endpoint}:`, uploadErr);
            }
          }
          
          if (!fileUploaded) {
            console.warn(`File upload failed for record ${recordId} - tried all endpoints`);
            exportResults[exportResults.length - 1].fileUploadWarning = 'File could not be uploaded to DocMgt';
          }
        } catch (fileErr: any) {
          console.error(`Error uploading file for record ${recordId}:`, fileErr);
          exportResults[exportResults.length - 1].fileUploadError = fileErr.message;
        }
      } else if (success && !fileBlob) {
        exportResults[exportResults.length - 1].fileUploadWarning = 'No file available to upload';
      }

      if (!success) exportResults.push({ success: false, error: lastError, tried: payloadCandidates });
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
