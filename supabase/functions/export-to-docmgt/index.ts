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

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);

    // Resolve RecordType by name or ID
    let recordTypeId: number | null = null;
    try {
      const rtResp = await fetch(`${normalizedDocmgtUrl}/rest/recordtypes`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' },
      });
      const rtCT = rtResp.headers.get('content-type') || '';
      if (rtResp.ok && rtCT.includes('application/json')) {
        const rts = await rtResp.json();
        const found = Array.isArray(rts)
          ? rts.find((r: any) => String(r.ID) === String(project) || r.Name === project || r.name === project)
          : null;
        recordTypeId = found?.ID ?? null;
        if (!recordTypeId && Array.isArray(rts) && rts.length) recordTypeId = rts[0].ID ?? null;
      }
    } catch (e) {
      console.warn('Could not resolve DocMgt RecordType list', e);
    }

    // Prepare documents for Docmgt API (create records)
    const fieldMappings: Record<string, string> = docmgtConfig.fieldMappings || {};
    const exportResults = [] as any[];

    for (const doc of documents) {
      const metadata = (doc.extracted_metadata || {}) as Record<string, any>;

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

      const payloadCandidates = [
        { RecordTypeID: recordTypeId ?? undefined, RecordTypeName: project, Variables: variables },
        { RecordTypeID: recordTypeId ?? undefined, RecordTypeName: project, Fields: fieldsMap },
        { RecordTypeName: project, Variables: variables },
        { Fields: fieldsMap },
        // Array-based fields
        { RecordTypeID: recordTypeId ?? undefined, RecordTypeName: project, Fields: fieldArray },
        { RecordTypeName: project, Fields: fieldArray },
        { Fields: fieldArray },
        // Top-level RecordType variants (some DocMgt instances expect this)
        { RecordType: project, Variables: variables },
        { RecordType: project, Fields: fieldsMap },
        { RecordType: project, Fields: fieldArray },
      ];

      let lastError: string | null = null;
      let success = false;
      for (const body of payloadCandidates) {
        try {
          const resp = await fetch(`${normalizedDocmgtUrl}/rest/records`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authString}`,
            },
            body: JSON.stringify(body),
          });
          const ct = resp.headers.get('content-type') || '';
          const text = await resp.text();
          if (resp.ok && (ct.includes('application/json') || text.startsWith('{'))) {
            let json: any = null;
            try { json = JSON.parse(text); } catch {}
            exportResults.push({ success: true, request: body, response: json || text });
            success = true;
            break;
          } else {
            lastError = text || `HTTP ${resp.status}`;
            console.error('Docmgt API error:', lastError);
          }
        } catch (err: any) {
          lastError = err.message;
          console.error('Docmgt request error:', err);
        }
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
