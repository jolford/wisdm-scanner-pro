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
          metadata
        )
      `)
      .eq('id', batchId)
      .maybeSingle();

    if (batchError) throw batchError;

    if (!batch) {
      return new Response(
        JSON.stringify({ error: 'Batch not found', success: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract Filebound credentials from project config (support multiple storage locations)
    const fileboundConfig = (batch.projects as any)?.filebound_config 
      || (batch.projects as any)?.metadata?.export_config?.filebound
      || (batch.projects as any)?.metadata?.exportConfig?.filebound;

    if (!fileboundConfig?.enabled || !fileboundConfig?.url || !fileboundConfig?.username || !fileboundConfig?.password) {
      return new Response(
        JSON.stringify({ error: 'Filebound is not configured for this project' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL to prevent SSRF attacks
    try {
      validateExternalUrl(fileboundConfig.url);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: `Invalid Filebound URL: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileboundUrl = fileboundConfig.url;
    const username = fileboundConfig.username;
    const password = fileboundConfig.password;
    const project = fileboundConfig.project;

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

    // Helper: resolve projectId (config may store name or id)
    const baseUrl = fileboundUrl.replace(/\/$/, '');
    const authString = btoa(`${username}:${password}`);

    const projectsResp = await fetch(`${baseUrl}/api/projects`, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' },
    });
    if (!projectsResp.ok) {
      const errText = await projectsResp.text();
      console.error('Filebound list projects error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to list FileBound projects', status: projectsResp.status, details: (errText || '').slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const projectsArr: any[] = await projectsResp.json();

    const projectMatch = projectsArr.find((p: any) => {
      const pid = String(p.ProjectId ?? p.Id ?? p.id ?? '');
      const pname = String(p.ProjectName ?? p.Name ?? p.name ?? '');
      return pid === String(project) || pname.toLowerCase() === String(project).toLowerCase();
    });
    const projectId = projectMatch?.ProjectId ?? projectMatch?.Id ?? projectMatch?.id;
    if (!projectId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configured FileBound project not found', configured: project, available: projectsArr?.length ?? 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: build index fields per document using fieldMappings
    const fieldMappings = (fileboundConfig.fieldMappings || {}) as Record<string, string>;
    const buildIndexFields = (doc: any) => {
      const out: Record<string, any> = {};
      for (const [localField, ecmField] of Object.entries(fieldMappings)) {
        if (!ecmField) continue;
        const val = (doc.extracted_metadata || {})[localField];
        if (val !== undefined && val !== null && val !== '') out[ecmField] = val;
      }
      return out;
    };

    // Helper: download file bytes (supports private Supabase Storage URLs)
    async function downloadBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
      try {
        const storageUrl = Deno.env.get('SUPABASE_URL');
        if (storageUrl && url.startsWith(storageUrl) && url.includes('/storage/v1/object/')) {
          // Match /storage/v1/object/(sign|public|authenticated)/bucket/path
          const match = url.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
          if (match) {
            const bucket = match[1];
            const objectPath = decodeURIComponent(match[2]);
            const { data, error } = await supabase.storage.from(bucket).download(objectPath);
            if (error) throw error;
            const ab = new Uint8Array(await data.arrayBuffer());
            const ct = data.type || 'application/octet-stream';
            return { bytes: ab, contentType: ct };
          }
        }
        // Fallback to direct fetch (for external URLs or non-storage patterns)
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download document: ${res.status}`);
        const ab = new Uint8Array(await res.arrayBuffer());
        const ct = res.headers.get('content-type') || 'application/octet-stream';
        return { bytes: ab, contentType: ct };
      } catch (e) {
        throw e;
      }
    }

    function toBase64(u8: Uint8Array): string {
      // Convert Uint8Array to base64 in Deno
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk) {
        const sub = u8.subarray(i, i + chunk);
        binary += String.fromCharCode.apply(null, Array.from(sub) as any);
      }
      return btoa(binary);
    }

    // Try uploading each document individually to maximize success
    const successes: any[] = [];
    const failures: any[] = [];

    for (const doc of documents) {
      try {
        const { bytes, contentType } = await downloadBytes(doc.redacted_file_url || doc.file_url);
        const indexFields = buildIndexFields(doc);

        // Attempt 1: multipart upload to project-specific endpoint
        const form = new FormData();
        form.append('file', new Blob([bytes as unknown as BlobPart], { type: contentType }), doc.file_name);
        form.append('fileName', doc.file_name);
        form.append('projectId', String(projectId));
        form.append('indexFields', JSON.stringify(indexFields));

        let resp = await fetch(`${baseUrl}/api/projects/${projectId}/documents`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${authString}` },
          body: form,
        });

        // Fallback 2: JSON import with base64 content
        if (!resp.ok) {
          const b64 = toBase64(bytes);
          resp = await fetch(`${baseUrl}/api/documents/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authString}`,
            },
            body: JSON.stringify({
              projectId: projectId,
              batch: { name: batch.batch_name, projectName: batch.projects?.name },
              documents: [{
                fileName: doc.file_name,
                contentBase64: b64,
                contentType,
                indexFields,
              }],
            }),
          });
        }

        if (!resp.ok) {
          const errT = await resp.text();
          failures.push({ id: doc.id, status: resp.status, error: (errT || '').slice(0, 500) });
        } else {
          const okJson = await resp.json().catch(() => ({}));
          successes.push({ id: doc.id, result: okJson });
        }
      } catch (e: any) {
        failures.push({ id: doc.id, error: e?.message || String(e) });
      }
    }

    if (successes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'All FileBound uploads failed', failures }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Partial success: still mark exported, include details
    const fileboundResult = { successesCount: successes.length, failuresCount: failures.length, failures };

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
            successesCount: successes.length,
            failuresCount: failures.length,
            failures,
          }
        }
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Exported ${successes.length} document(s) to FileBound${failures.length ? ' (some failed)' : ''}`,
        result: fileboundResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: failures.length ? 207 : 200 }
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
