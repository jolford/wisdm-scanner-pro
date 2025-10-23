import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

        // Helper: create a File in FileBound for this project (or return existing)
        async function ensureFile(): Promise<string> {
          // Build 'File' payload using FileBound documented schema
          // 1) Fetch project field definitions to map names -> ordinal indices
          let projectFields: any[] = [];
          try {
            const fieldsRes = await fetch(`${baseUrl}/api/projects/${projectId}/fields`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
              }
            });
            if (fieldsRes.ok) {
              projectFields = await fieldsRes.json().catch(() => []);
            }
          } catch (_) {}

          // 2) Convert our indexFields object to FileBound "field" array (index 1..20)
          const fieldsArray: string[] = new Array(21).fill("");
          // Many instances ignore index 0
          fieldsArray[0] = 'not used - ignore';

          const getIndexFromName = (name: string): number | undefined => {
            // Accept F1/F2/... direct mapping
            const m = /^F(\d{1,2})$/i.exec(name.trim());
            if (m) {
              const idx = parseInt(m[1], 10);
              if (!Number.isNaN(idx) && idx >= 1 && idx <= 20) return idx;
            }
            // Try to locate by field name in project fields metadata
            const match = projectFields.find((f: any) => {
              const candidates = [f?.Name, f?.name, f?.FieldName, f?.fieldName, f?.DisplayName, f?.displayName];
              return candidates.some((n: any) => typeof n === 'string' && n.toLowerCase() === name.toLowerCase());
            });
            if (match) {
              const possibleIdx = match?.FieldNumber ?? match?.fieldNumber ?? match?.Index ?? match?.index ?? match?.Number ?? match?.number;
              if (typeof possibleIdx === 'number') return possibleIdx;
              // Some APIs return F# as Key
              const key = match?.Key ?? match?.key;
              if (typeof key === 'string') {
                const km = /^F(\d{1,2})$/i.exec(key);
                if (km) return parseInt(km[1], 10);
              }
            }
            return undefined;
          };

          for (const [ecmField, valueRaw] of Object.entries(indexFields)) {
            const value = valueRaw as any;
            if (value === undefined || value === null || value === '') continue;
            const idx = getIndexFromName(String(ecmField));
            if (idx !== undefined) fieldsArray[idx] = String(value);
          }

          // Build multiple payload shapes since FileBound instances vary
          const fieldsObj: Record<string, string> = {};
          for (let i = 1; i <= 20; i++) {
            const v = fieldsArray[i];
            if (v) fieldsObj[`F${i}`] = v;
          }
          const fieldsSlice = fieldsArray.slice(1); // F1..F20 only
          const indexArrayByNumber = Object.entries(fieldsObj).map(([k, v]) => ({ Index: parseInt(k.slice(1), 10), Value: v }));
          const indexArrayByFieldNumber = Object.entries(fieldsObj).map(([k, v]) => ({ FieldNumber: parseInt(k.slice(1), 10), Value: v }));
          const indexArrayByName = Object.entries(fieldsObj).map(([k, v]) => ({ Name: k, Value: v }));

          const fileBodies = [
            { field: fieldsArray, notes: doc.file_name || '', projectId },
            { Field: fieldsArray, Notes: doc.file_name || '', ProjectId: projectId },
            { ProjectId: projectId, Fields: fieldsSlice, Notes: doc.file_name || '' },
            { ProjectId: projectId, IndexFields: fieldsObj, Notes: doc.file_name || '' },
            { ProjectId: projectId, IndexFields: indexArrayByNumber, Notes: doc.file_name || '' },
            { ProjectId: projectId, IndexFields: indexArrayByFieldNumber, Notes: doc.file_name || '' },
            { ProjectId: projectId, IndexFields: indexArrayByName, Notes: doc.file_name || '' },
            { projectId, indexFields: fieldsObj, notes: doc.file_name || '' },
            { projectId, field: fieldsSlice, notes: doc.file_name || '' },
          ];

          // Helper: find a file by index fields using FileBound filter syntax
          const findFileByFields = async (): Promise<string | undefined> => {
            // Build filters like: ProjectId_8,1_123,2_ABC
            const fieldParts: string[] = [];
            for (let i = 1; i <= 20; i++) {
              const v = fieldsArray[i];
              if (v) fieldParts.push(`${i}_${encodeURIComponent(String(v))}`);
            }
            const attempts = [
              [`ProjectId_${projectId}`, ...fieldParts],
              [`projectid_${projectId}`, ...fieldParts],
              fieldParts,
            ];
            for (const parts of attempts) {
              if (!parts.length) continue;
              const url = `${baseUrl}/api/files?filter=${parts.join(',')}`;
              const r = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
              });
              if (!r.ok) continue;
              const arr = await r.json().catch(() => []);
              if (Array.isArray(arr) && arr.length) {
                const f = arr[0];
                const id = f?.FileId ?? f?.Id ?? f?.fileId ?? f?.id;
                if (id) return String(id);
              }
            }
            return undefined;
          };


          const createEndpoints = [
            { url: `${baseUrl}/api/projects/${projectId}/files`, method: 'PUT' as const },
            { url: `${baseUrl}/api/projects/${projectId}/files`, method: 'POST' as const },
            { url: `${baseUrl}/api/files`, method: 'PUT' as const },
            { url: `${baseUrl}/api/files`, method: 'POST' as const },
          ];

          for (const body of fileBodies) {
            for (const ep of createEndpoints) {
              const res = await fetch(ep.url, {
                method: ep.method,
                headers: {
                  'Authorization': `Basic ${authString}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(body)
              });
              if (res.ok || res.status === 201) {
                let fid: string | undefined;
                // Some instances return identifiers via headers
                const headerKeys = ['Location', 'Content-Location', 'X-Entity-Id', 'EntityId', 'X-Resource-Id'];
                for (const hk of headerKeys) {
                  const hv = res.headers.get(hk) || res.headers.get(hk.toLowerCase());
                  if (hv && !fid) {
                    const m = hv.match(/(?:files|documents)\/(\d+|[a-f0-9-]+)$/i) || hv.match(/(\d+|[a-f0-9-]+)$/i);
                    if (m) fid = m[1];
                  }
                }
                if (!fid) {
                  const txt = await res.text();
                  try {
                    const j = JSON.parse(txt);
                    fid = j.FileId ?? j.fileId ?? j.Id ?? j.id ?? j?.Data?.FileId ?? j?.Data?.fileId ?? j?.Result?.FileId ?? j?.Result?.Id;
                  } catch {
                    const m2 = (txt || '').match(/(?:FileId|Id)[^\d]*(\d+)/i);
                    if (m2) fid = m2[1];
                  }
                }
                if (fid) return String(fid);
                // Fallback: search for file by index fields if API didn't return id
                const altId = await findFileByFields();
                if (altId) return String(altId);
                console.warn('FileBound create file: success response without id', { endpoint: ep, status: res.status });
              } else {
                const t = await res.text();
                console.warn('FileBound create file failed', { endpoint: ep, status: res.status, body: (t || '').slice(0, 500) });
              }
            }
          }

          // Last resort: try legacy IndexFields contract if instance supports it
          const legacyBodies = [
            { ProjectId: projectId, IndexFields: indexFields },
            { projectId: projectId, indexFields: indexFields },
            {
              ProjectId: projectId,
              IndexFields: Object.entries(indexFields).map(([Name, Value]) => ({ Name, Value }))
            }
          ];
          const legacyEndpoints = [
            { url: `${baseUrl}/api/projects/${projectId}/files`, method: 'PUT' as const },
            { url: `${baseUrl}/api/files`, method: 'PUT' as const },
          ];
          for (const body of legacyBodies) {
            for (const ep of legacyEndpoints) {
              const res = await fetch(ep.url, {
                method: ep.method,
                headers: {
                  'Authorization': `Basic ${authString}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(body)
              });
              if (res.ok) {
                let fid: string | undefined;
                const loc = res.headers.get('Location') || res.headers.get('location');
                if (loc) {
                  const m = loc.match(/files\/(\d+|[a-f0-9-]+)$/i);
                  if (m) fid = m[1];
                }
                if (!fid) {
                  const j = await res.json().catch(() => ({}));
                  fid = j.FileId ?? j.Id ?? j.fileId ?? j.id;
                }
                if (fid) return String(fid);
              } else {
                const t = await res.text();
                console.warn('FileBound legacy create file failed', ep, (t || '').slice(0, 300));
              }
            }
          }

          throw new Error('Unable to create or locate FileBound file');
        }

        function getExtension(fileName: string, ct: string): string {
          const fromName = (fileName?.split('.')?.pop() || '').toLowerCase();
          if (fromName) return fromName;
          if (ct === 'application/pdf') return 'pdf';
          if (ct.includes('png')) return 'png';
          if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
          return 'bin';
        }

        const fileId = await ensureFile();

        // Upload the document content to the created file
        const b64 = toBase64(bytes);
        const ext = getExtension(doc.file_name || '', contentType);

        const uploadPayloads = [
          {
            Name: doc.file_name,
            Extension: ext,
            AllowSaveBinaryData: true,
            BinaryData: b64,
            ContentType: contentType,
          },
          {
            name: doc.file_name,
            extension: ext,
            allowSaveBinaryData: true,
            binaryData: b64,
            contentType,
          },
        ];

        const uploadEndpoints = [
          { url: `${baseUrl}/api/documents/${fileId}`, method: 'PUT' },
          { url: `${baseUrl}/api/files/${fileId}/documents`, method: 'POST' },
        ];

        let uploaded = false;
        let lastError: any = null;
        for (const body of uploadPayloads) {
          for (const ep of uploadEndpoints) {
            const res = await fetch(ep.url, {
              method: ep.method,
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body)
            });
            if (res.ok) {
              const okJson = await res.json().catch(() => ({}));
              successes.push({ id: doc.id, result: okJson, fileId });
              uploaded = true;
              break;
            } else {
              const t = await res.text();
              lastError = { status: res.status, details: (t || '').slice(0, 500) };
              console.warn('FileBound document upload failed', ep, lastError);
            }
          }
          if (uploaded) break;
        }

        if (!uploaded) {
          failures.push({ id: doc.id, error: 'Upload failed', ...lastError });
        }
      } catch (e: any) {
        console.warn('Export error for document', { id: doc.id, url: doc.redacted_file_url || doc.file_url, message: e?.message });
        failures.push({ id: doc.id, error: e?.message || String(e) });
      }
    }

    if (successes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'All FileBound uploads failed', failures }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        partial: failures.length > 0,
        message: `Exported ${successes.length}/${documents.length} document(s) to FileBound${failures.length ? ' (some failed)' : ''}`,
        result: fileboundResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
