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

    // Set export_started_at timestamp to track export duration
    await supabase
      .from('batches')
      .update({ export_started_at: new Date().toISOString() })
      .eq('id', batchId);

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
      .order('page_number', { ascending: true });

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

    // Get batch notes from metadata
    const batchNotes = (batch.metadata as any)?.notes || batch.notes || '';
    
    // Check if separators/dividers are configured
    const exportSeparators = fileboundConfig.includeSeparators !== false; // default true
    const exportDividers = fileboundConfig.includeDividers !== false; // default true

    console.log(`Exporting ${documents.length} documents to Filebound at ${fileboundUrl}`);

    // Helper: resolve projectId (config may store name or id)
    const baseUrl = fileboundUrl.replace(/\/$/, '');
    const authString = btoa(`${username}:${password}`);

    // Try projects endpoint across versions
    const projectUrls = [
      `${baseUrl}/api/projects`,
      `${baseUrl}/api/v1/projects`,
      `${baseUrl}/api/v2/projects`,
    ];
    let projectsResp: Response | null = null;
    let projectsArr: any[] = [];
    for (const url of projectUrls) {
      const r = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' },
      });
      if (r.ok) { projectsResp = r; break; }
      const errText = await r.text();
      console.warn('Filebound list projects error:', { url, status: r.status, body: (errText || '').slice(0, 300) });
    }
    if (!projectsResp) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to list FileBound projects (no endpoint matched)' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    projectsArr = await projectsResp.json();

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
    const batchCustomFields = (batch.metadata as any)?.custom_fields || {};
    
    const buildIndexFields = (doc: any) => {
      const out: Record<string, any> = {};
      
      // Add batch-level custom fields first
      for (const [batchField, batchValue] of Object.entries(batchCustomFields)) {
        // Check if this batch field is mapped to an ECM field
        const mappedField = fieldMappings[batchField];
        if (mappedField && batchValue !== undefined && batchValue !== null && batchValue !== '') {
          out[mappedField] = batchValue;
        } else if (!mappedField && batchValue !== undefined && batchValue !== null && batchValue !== '') {
          // If not mapped, include with original name
          out[batchField] = batchValue;
        }
      }
      
      // Add document-level extracted fields
      for (const [localField, ecmField] of Object.entries(fieldMappings)) {
        if (!ecmField) continue;
        const val = (doc.extracted_metadata || {})[localField];
        if (val !== undefined && val !== null && val !== '') out[ecmField] = val;
      }
      
      // Always include batch name
      out['Batch Name'] = batch.batch_name;
      
      return out;
    };

    // Helper: download file bytes (supports private Supabase Storage URLs)
    async function downloadBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
      try {
        const storageUrl = Deno.env.get('SUPABASE_URL');
        
        // Always try storage SDK first for Supabase URLs
        if (storageUrl && url.includes(storageUrl)) {
          // Extract storage path from any Supabase storage URL format
          let filePath: string | null = null;
          try {
            const u = new URL(url);
            // Match /documents/path or /storage/v1/object/.../documents/path
            const m = u.pathname.match(/\/documents\/(.+)$/);
            filePath = m ? decodeURIComponent(m[1]) : null;
          } catch {
            const m = url.match(/\/documents\/(.+?)(?:\?|#|$)/);
            filePath = m ? decodeURIComponent(m[1]) : null;
          }
          
          if (filePath) {
            try {
              const { data, error } = await supabase.storage.from('documents').download(filePath);
              if (!error && data) {
                const ab = new Uint8Array(await data.arrayBuffer());
                const ct = data.type || 'application/octet-stream';
                return { bytes: ab, contentType: ct };
              }
            } catch (storageErr) {
              console.warn('Storage SDK download failed, will try direct fetch:', storageErr);
            }
          }
        }
        
        // Fallback to direct fetch (for external URLs or if storage failed)
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download document: ${res.status} ${res.statusText}`);
        const ab = new Uint8Array(await res.arrayBuffer());
        const ct = res.headers.get('content-type') || 'application/octet-stream';
        return { bytes: ab, contentType: ct };
      } catch (e) {
        console.error('downloadBytes error for URL:', url, e);
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

    // Helper: Create divider in FileBound
    async function createDivider(position: 'start' | 'end', projectId: string): Promise<void> {
      if (!exportDividers) return;
      
      try {
        const dividerPayload = {
          ProjectId: projectId,
          DocumentType: 'DIVIDER',
          Notes: `========== Batch ${position === 'start' ? 'START' : 'END'}: ${batch.batch_name} ==========`,
          IsDivider: true,
          BatchName: batch.batch_name,
          BatchId: batchId
        };
        
        const dividerEndpoints = [
          `${baseUrl}/api/projects/${projectId}/files`,
          `${baseUrl}/api/files`,
        ];
        
        for (const url of dividerEndpoints) {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dividerPayload)
          });
          
          if (res.ok || res.status === 201) {
            console.log(`Batch ${position} divider created successfully`);
            break;
          }
        }
      } catch (error) {
        console.warn(`Failed to create ${position} divider:`, error);
      }
    }

    // Insert batch start divider
    await createDivider('start', projectId);

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

          // Build comprehensive notes including batch notes and document validation notes
          const noteParts: string[] = [];
          if (batchNotes) noteParts.push(`Batch: ${batchNotes}`);
          if (doc.validation_notes) noteParts.push(`Document: ${doc.validation_notes}`);
          if (!noteParts.length) noteParts.push(doc.file_name || '');
          const combinedNotes = noteParts.join(' | ');

          const fileBodies = [
            { field: fieldsArray, notes: combinedNotes, projectId },
            { Field: fieldsArray, Notes: combinedNotes, ProjectId: projectId },
            { ProjectId: projectId, Fields: fieldsSlice, Notes: combinedNotes },
            { ProjectId: projectId, IndexFields: fieldsObj, Notes: combinedNotes },
            { ProjectId: projectId, IndexFields: indexArrayByNumber, Notes: combinedNotes },
            { ProjectId: projectId, IndexFields: indexArrayByFieldNumber, Notes: combinedNotes },
            { ProjectId: projectId, IndexFields: indexArrayByName, Notes: combinedNotes },
            { projectId, indexFields: fieldsObj, notes: combinedNotes },
            { projectId, field: fieldsSlice, notes: combinedNotes },
          ];

          // Helper: find a file by index fields using FileBound filter syntax
          const findFileByFields = async (): Promise<string | undefined> => {
            // Build a conservative filter: only 1 safe text field to avoid FileBound 500s
            const valueAt = (i: number) => (fieldsArray[i] || '').toString();
            const isSafeText = (s: string) => {
              const v = s.trim();
              if (!v) return false;
              // Avoid numbers with thousand separators or decimals, and typical dates
              if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(v)) return false; // 93,169.80
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; // 2025-06-01
              if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(v)) return false; // 4/29/2025
              // Prefer strings with letters/dashes/underscores (invoice numbers, etc.)
              return /[A-Za-z]/.test(v) || /[-_]/.test(v);
            };

            // Choose first safe field (prefer F1..F20 in order)
            let chosenIndex: number | undefined;
            for (let i = 1; i <= 20; i++) {
              if (isSafeText(valueAt(i))) { chosenIndex = i; break; }
            }
            if (!chosenIndex) return undefined;

            const v = encodeURIComponent(valueAt(chosenIndex));
            const pf = `ProjectId_${projectId}`;

            const candidateUrls = [
              `${baseUrl}/api/files?filter=${pf},F${chosenIndex}_${v}`,
              `${baseUrl}/api/files?filter=${pf},${chosenIndex}_${v}`,
              `${baseUrl}/api/files?filter=F${chosenIndex}_${v}`,
              `${baseUrl}/api/files?filter=${chosenIndex}_${v}`,
            ];

            for (const url of candidateUrls) {
              try {
                const r = await fetch(url, {
                  method: 'GET',
                  headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
                });
                if (!r.ok) {
                  const t = await r.text();
                  console.warn('FileBound search not ok', { url, status: r.status, body: (t || '').slice(0, 300) });
                  continue;
                }
                const arr = await r.json().catch(() => []);
                if (Array.isArray(arr) && arr.length) {
                  const f = arr[0];
                  const id = f?.FileId ?? f?.Id ?? f?.fileId ?? f?.id;
                  if (id) return String(id);
                }
              } catch (err) {
                console.warn('FileBound search error', { url, message: (err as any)?.message || String(err) });
              }
            }

            return undefined;
          };

          // Per FileBound API docs: PUT /api/files creates a new file
          // The response body should contain the created file object with fileId
          const createEndpoints = [
            { url: `${baseUrl}/api/files`, method: 'PUT' as const },  // Primary documented endpoint
            { url: `${baseUrl}/api/projects/${projectId}/files`, method: 'PUT' as const },
            { url: `${baseUrl}/api/files`, method: 'POST' as const },  // Fallback for older versions
            { url: `${baseUrl}/api/projects/${projectId}/files`, method: 'POST' as const },
          ];

          // Helper to extract fileId from various response formats
          const extractFileId = (responseText: string, headers: Headers): string | undefined => {
            // Check headers first
            const headerKeys = ['Location', 'Content-Location', 'X-Entity-Id', 'EntityId', 'X-Resource-Id', 'X-File-Id'];
            for (const hk of headerKeys) {
              const hv = headers.get(hk) || headers.get(hk.toLowerCase());
              if (hv) {
                const m = hv.match(/(?:files|documents)\/(\d+|[a-f0-9-]+)$/i) || hv.match(/(\d+|[a-f0-9-]+)$/i);
                if (m) return m[1];
              }
            }
            
            // Parse response body
            if (!responseText || responseText.trim() === '') return undefined;
            
            try {
              const j = JSON.parse(responseText);
              
              // Try all known property names for file ID
              const candidates = [
                j?.fileId, j?.FileId, j?.fileid, j?.FILEID,
                j?.id, j?.Id, j?.ID,
                j?.Data?.FileId, j?.Data?.fileId, j?.Data?.id, j?.Data?.Id,
                j?.Result?.FileId, j?.Result?.fileId, j?.Result?.id, j?.Result?.Id,
                j?.data?.fileId, j?.data?.id,
                j?.result?.fileId, j?.result?.id
              ];
              
              for (const candidate of candidates) {
                if (candidate !== undefined && candidate !== null && candidate !== '') {
                  return String(candidate);
                }
              }
              
              // If response is just a number, use it as the ID
              if (typeof j === 'number') return String(j);
              if (typeof j === 'string' && /^\d+$/.test(j)) return j;
              
            } catch {
              // Try regex fallback
              const m2 = responseText.match(/(?:fileId|FileId|fileid)["\s:]*["\s]*(\d+)/i);
              if (m2) return m2[1];
              
              // If response is just a number
              if (/^\d+$/.test(responseText.trim())) return responseText.trim();
            }
            
            return undefined;
          };

          for (const body of fileBodies) {
            for (const ep of createEndpoints) {
              try {
                console.log(`Trying to create FileBound file: ${ep.method} ${ep.url}`);
                const res = await fetch(ep.url, {
                  method: ep.method,
                  headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(body)
                });
                
                const responseText = await res.text();
                
                if (res.ok || res.status === 201) {
                  const fid = extractFileId(responseText, res.headers);
                  if (fid) {
                    console.log(`FileBound file created successfully: fileId=${fid}`);
                    return String(fid);
                  }
                  
                  // Fallback: search for file by index fields if API didn't return id
                  console.log('FileBound returned success but no fileId, searching for created file...');
                  const altId = await findFileByFields();
                  if (altId) {
                    console.log(`Found file via search: fileId=${altId}`);
                    return String(altId);
                  }
                  
                  console.warn('FileBound create file: success response without id', { 
                    endpoint: ep, 
                    status: res.status,
                    responsePreview: responseText.slice(0, 500)
                  });
                } else {
                  console.warn('FileBound create file failed', { 
                    endpoint: ep, 
                    status: res.status, 
                    body: responseText.slice(0, 500) 
                  });
                }
              } catch (err: any) {
                console.warn('FileBound create file exception', { 
                  endpoint: ep, 
                  error: err?.message || String(err) 
                });
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
            { url: `${baseUrl}/api/files`, method: 'PUT' as const },  // Primary per docs
            { url: `${baseUrl}/api/projects/${projectId}/files`, method: 'PUT' as const },
          ];
          
          for (const body of legacyBodies) {
            for (const ep of legacyEndpoints) {
              try {
                console.log(`Trying legacy FileBound file creation: ${ep.method} ${ep.url}`);
                const res = await fetch(ep.url, {
                  method: ep.method,
                  headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(body)
                });
                
                const responseText = await res.text();
                
                if (res.ok) {
                  const fid = extractFileId(responseText, res.headers);
                  if (fid) {
                    console.log(`FileBound file created via legacy endpoint: fileId=${fid}`);
                    return String(fid);
                  }
                  
                  // Try search fallback
                  const altId = await findFileByFields();
                  if (altId) {
                    console.log(`Found file via search after legacy create: fileId=${altId}`);
                    return String(altId);
                  }
                } else {
                  console.warn('FileBound legacy create file failed', { 
                    endpoint: ep, 
                    status: res.status,
                    body: responseText.slice(0, 300) 
                  });
                }
              } catch (err: any) {
                console.warn('FileBound legacy create exception', { 
                  endpoint: ep, 
                  error: err?.message || String(err) 
                });
              }
            }
          }

          throw new Error('Unable to create or locate FileBound file');
        }

        // Attempt to resolve a usable Divider for uploads (some projects require it)
        async function getDividerInfo(projectId: string | number, fileId: string | number): Promise<{ id?: string; name?: string } | null> {
          const tryUrls = [
            `${baseUrl}/api/projects/${projectId}/dividers`,
            `${baseUrl}/api/projects/${projectId}/dividers?default=true`,
            `${baseUrl}/api/files/${fileId}/dividers`,
          ];
          for (const url of tryUrls) {
            try {
              const res = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' },
              });
              if (!res.ok) continue;
              const body = await res.json().catch(() => []);
              const arr = Array.isArray(body) ? body : (Array.isArray(body?.Data) ? body.Data : []);
              if (!arr.length) continue;
              // Prefer default divider if flagged, else first
              const pick = arr.find((d: any) => d?.Default || d?.IsDefault || d?.isDefault) || arr[0];
              const id = pick?.DividerId ?? pick?.Id ?? pick?.dividerId ?? pick?.id;
              const name = pick?.DividerName ?? pick?.Name ?? pick?.dividerName ?? pick?.name;
              if (id || name) {
                console.log('Resolved FileBound divider', { id, name, from: url });
                return { id: id ? String(id) : undefined, name: name ? String(name) : undefined };
              }
            } catch (e) {
              console.warn('Fetch divider info failed', { url, message: (e as any)?.message });
            }
          }
          return null;
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
        const ext = getExtension(doc.file_name || '', contentType);

        // Divider not required (user disabled in FileBound); skip adding divider params
        const divider: { id?: string; name?: string } | null = null;
        const urlWithDivider = (u: string) => u;

        let uploaded = false;
        let lastError: any = null;
        
        // Convert bytes to standard array for Blob
        const byteArray = Array.from(bytes);

        // 0) Try creating a Document resource first, then upload pages to it (common in some FileBound versions)
        if (!uploaded) {
          // Create document under file
          const createDocBodies = [
            { Name: doc.file_name || `document.${ext}`, Notes: doc.file_name || '' },
            { Title: doc.file_name || `document.${ext}`, Notes: doc.file_name || '' },
            { name: doc.file_name || `document.${ext}`, notes: doc.file_name || '' },
          ];
          const createDocEndpoints = [
            { url: `${baseUrl}/api/files/${fileId}/documents`, method: 'POST' as const },
            { url: `${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`, method: 'POST' as const },
          ];

          let documentId: string | undefined;
          outerCreate: for (const body of createDocBodies) {
            for (const ep of createDocEndpoints) {
              try {
                const res = await fetch(ep.url, {
                  method: ep.method,
                  headers: {
                    'Authorization': `Basic ${authString}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                  },
                  body: JSON.stringify(body)
                });
                if (res.ok || res.status === 201) {
                  // Try to get id from headers then body
                  const loc = res.headers.get('Location') || res.headers.get('location');
                  if (loc) {
                    const m = loc.match(/documents\/(\d+|[a-f0-9-]+)$/i);
                    if (m) { documentId = m[1]; break outerCreate; }
                  }
                  const txt = await res.text();
                  try {
                    const j = JSON.parse(txt);
                    documentId = j.DocumentId ?? j.documentId ?? j.Id ?? j.id ?? j?.Data?.DocumentId;
                    if (documentId) break outerCreate;
                  } catch (_) {}
                } else {
                  const t = await res.text();
                  lastError = { url: ep.url, status: res.status, details: (t || '').slice(0, 500) };
                }
              } catch (err: any) {
                lastError = { url: ep.url, status: 0, details: err?.message };
              }
            }
          }

          // If a document was created, try uploading its page content
          if (documentId) {
            const filename = doc.file_name || `document.${ext}`;
            const blob = new Blob([new Uint8Array(byteArray)], { type: contentType || 'application/octet-stream' });
            const pageFormFields = ['PageFile', 'file', 'document', 'upload', 'UploadedFile', 'File'];
            const pageEndpoints = [
              { url: `${baseUrl}/api/documents/${documentId}/pages`, method: 'POST' as const },
              { url: `${baseUrl}/api/documents/${documentId}/upload`, method: 'POST' as const },
            ];
            pageUploadLoop: for (const ep of pageEndpoints) {
              for (const field of pageFormFields) {
                try {
                  const fd = new FormData();
                  fd.append(field, blob, filename);
                  fd.append('FileName', filename);
                  const res = await fetch(ep.url, {
                    method: ep.method,
                    headers: {
                      'Authorization': `Basic ${authString}`,
                      'Accept': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: fd,
                  });
                  if (res.ok || res.status === 201) {
                    const okJson = await res.json().catch(() => ({ success: true }));
                    successes.push({ id: doc.id, result: okJson, fileId, documentId });
                    uploaded = true;
                    break pageUploadLoop;
                  } else {
                    const t = await res.text();
                    lastError = { url: ep.url, status: res.status, details: (t || '').slice(0, 500) };
                  }
                } catch (err: any) {
                  lastError = { url: ep.url, status: 0, details: err?.message };
                }
              }
            }
          }
        }

        // 1) Try multipart/form-data (commonly required by FileBound)
        if (!uploaded) {
            const formEndpoints = [
              // Direct, documented upload endpoints
              { url: urlWithDivider(`${baseUrl}/api/documentBinaryData/0?extension=${ext}&fileId=${fileId}`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/DocumentBinaryData/0?extension=${ext}&fileId=${fileId}`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/documentUpload`), method: 'POST' as const },
              // no version prefix
              { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/document`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/documents`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/pages`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/upload`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/document`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/pages`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/documents/upload?fileId=${fileId}`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/documents?fileId=${fileId}`), method: 'POST' as const },
              // v1
              { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/document`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/documents`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/pages`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/upload`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/documents/upload?fileId=${fileId}`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/documents?fileId=${fileId}`), method: 'POST' as const },
              // v2
              { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/document`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/documents`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/pages`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/upload`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/documents/upload?fileId=${fileId}`), method: 'POST' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/documents?fileId=${fileId}`), method: 'POST' as const },
              // PUT variants
              { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/documents`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/pages`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/pages`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/documents?fileId=${fileId}`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/documents`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/pages`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v1/documents?fileId=${fileId}`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/documents`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/pages`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
              { url: urlWithDivider(`${baseUrl}/api/v2/documents?fileId=${fileId}`), method: 'PUT' as const },
            ];
          for (const ep of formEndpoints) {
            try {
              const fd = new FormData();
              const filename = doc.file_name || `document.${ext}`;
              const blob = new Blob([new Uint8Array(byteArray)], { type: contentType || 'application/octet-stream' });
              // Official field names per FileBound docs
              fd.append('documentToUpload', blob, filename);
              fd.append('fileId', String(fileId)); // DocumentBinaryData
              fd.append('fileid', String(fileId)); // DocumentUpload
              fd.append('extension', ext);
              fd.append('id', '0'); // new document
              fd.append('status', '1'); // active
              // Also include common alternates for broader compatibility
              fd.append('file', blob, filename);
              fd.append('document', blob, filename);
              fd.append('upload', blob, filename);
              fd.append('UploadedFile', blob, filename);
              fd.append('File', blob, filename);
              fd.append('PageFile', blob, filename);
              fd.append('page', blob, filename);
              // Provide filename hints
              fd.append('FileName', filename);
              fd.append('fileName', filename);
              fd.append('name', filename);
              const res = await fetch(ep.url, {
                method: ep.method,
                headers: {
                  'Authorization': `Basic ${authString}`,
                  'Accept': 'application/json'
                  // Do not set Content-Type explicitly; let the browser set boundary
                },
                body: fd,
              });
              if (res.ok || res.status === 201) {
                console.log(`Multipart upload successful to ${ep.url}`);
                const okJson = await res.json().catch(() => ({ success: true }));
                successes.push({ id: doc.id, result: okJson, fileId });
                uploaded = true;
                break;
              } else {
                const t = await res.text();
                lastError = { url: ep.url, status: res.status, details: (t || '').slice(0, 500) };
                console.warn('FileBound multipart upload failed', lastError);
              }
            } catch (err: any) {
              console.warn(`Multipart upload error to ${ep.url}:`, err.message);
            }
          }
        }

        // 2) Try raw binary upload
        if (!uploaded) {
          const uploadEndpoints = [
            // no version prefix
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/document`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/pages`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/upload`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/document`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/pages`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/documents/upload?fileId=${fileId}`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/documents?fileId=${fileId}`), method: 'POST' as const },
            // v1
            { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/document`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/pages`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/upload`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/documents/upload?fileId=${fileId}`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/documents?fileId=${fileId}`), method: 'POST' as const },
            // v2
            { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/document`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/pages`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/upload`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/documents/upload?fileId=${fileId}`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/documents?fileId=${fileId}`), method: 'POST' as const },
            // PUT variants
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/pages`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/pages`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/documents?fileId=${fileId}`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/files/${fileId}/pages`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v1/documents?fileId=${fileId}`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/files/${fileId}/pages`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/v2/documents?fileId=${fileId}`), method: 'PUT' as const },
            // Avoid /api/documents/{id} as it's often for existing document resources
          ];
          for (const ep of uploadEndpoints) {
            try {
              console.log(`Attempting binary upload to ${ep.url}`);
              const blob = new Blob([new Uint8Array(byteArray)], { type: contentType || 'application/octet-stream' });
              const res = await fetch(ep.url, {
                method: ep.method,
                headers: {
                  'Authorization': `Basic ${authString}`,
                  'Accept': 'application/json',
                  'Content-Type': contentType || 'application/octet-stream',
                  'Content-Disposition': `attachment; filename="${doc.file_name}"`,
                },
                body: blob
              });
              if (res.ok || res.status === 201) {
                console.log(`Binary upload successful to ${ep.url}`);
                const okJson = await res.json().catch(() => ({ success: true }));
                successes.push({ id: doc.id, result: okJson, fileId });
                uploaded = true;
                break;
              } else {
                const t = await res.text();
                lastError = { url: ep.url, status: res.status, details: (t || '').slice(0, 500) };
                console.warn('FileBound binary upload failed', lastError);
              }
            } catch (err: any) {
              console.warn(`Binary upload error to ${ep.url}:`, err.message);
            }
          }
        }

        // 3) If still failing, try JSON with base64
        if (!uploaded) {
          console.log('Binary uploads failed, trying JSON with base64');
          const b64 = toBase64(bytes);
          const basePayloads = [
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
          const uploadPayloads = basePayloads.map(p => ({
            ...p,
            FileId: fileId,
            fileId: fileId,
            FileName: doc.file_name,
            fileName: doc.file_name,
          }));

          const jsonEndpoints = [
            // Official: Add document to file by fileId
            { url: urlWithDivider(`${baseUrl}/api/documents/${fileId}`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/document`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/document`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/document`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/projects/${projectId}/files/${fileId}/documents`), method: 'PUT' as const },
            { url: urlWithDivider(`${baseUrl}/api/documents`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/documents?fileId=${fileId}`), method: 'POST' as const },
            { url: urlWithDivider(`${baseUrl}/api/documents?fileId=${fileId}`), method: 'PUT' as const },
          ];

          for (const body of uploadPayloads) {
            for (const ep of jsonEndpoints) {
              try {
                const res = await fetch(ep.url, {
                  method: ep.method,
                    headers: {
                      'Authorization': `Basic ${authString}`,
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                    },
                  body: JSON.stringify(body)
                });
                if (res.ok || res.status === 201) {
                  console.log(`JSON upload successful to ${ep.url}`);
                  const okJson = await res.json().catch(() => ({ success: true }));
                  successes.push({ id: doc.id, result: okJson, fileId });
                  uploaded = true;
                  
                  // Insert separator/divider if configured and document type changes
                  const currentIndex = documents.indexOf(doc);
                  const nextDoc = documents[currentIndex + 1];
                  
                  if (exportSeparators && nextDoc && doc.document_type !== nextDoc.document_type) {
                    try {
                      // Create a separator document in FileBound
                      const separatorPayload = {
                        ProjectId: projectId,
                        FileId: fileId,
                        DocumentType: 'SEPARATOR',
                        Notes: `--- Document Type Change: ${doc.document_type || 'Unknown'} to ${nextDoc.document_type || 'Unknown'} ---`,
                        IsSeparator: true
                      };
                      
                      await fetch(`${baseUrl}/api/files/${fileId}/documents`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Basic ${authString}`,
                          'Accept': 'application/json',
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(separatorPayload)
                      });
                      
                      console.log('Separator inserted between document types');
                    } catch (sepError) {
                      console.warn('Failed to insert separator:', sepError);
                    }
                  }
                  
                  break;
                } else {
                  const t = await res.text();
                  lastError = { url: ep.url, status: res.status, details: (t || '').slice(0, 500) };
                  console.warn('FileBound JSON upload failed', lastError);
                }
              } catch (err: any) {
                console.warn(`JSON upload error to ${ep.url}:`, err.message);
              }
            }
            if (uploaded) break;
          }
        }


        if (!uploaded) {
          failures.push({ id: doc.id, error: 'Upload failed', ...lastError });
        }
      } catch (e: any) {
        console.warn('Export error for document', { id: doc.id, url: doc.redacted_file_url || doc.file_url, message: e?.message });
        failures.push({ id: doc.id, error: e?.message || String(e) });
      }
    }

    // Insert batch end divider
    await createDivider('end', projectId);

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
        export_started_at: null,
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

    // Auto-delete batch and documents after successful export
    if (successes.length > 0) {
      await supabase
        .from('documents')
        .delete()
        .eq('batch_id', batchId);

      await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

      console.log(`Auto-deleted batch ${batchId} and its ${documents.length} documents after successful export`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        partial: failures.length > 0,
        message: `Exported ${successes.length}/${documents.length} document(s) to FileBound and cleared batch${failures.length ? ' (some failed)' : ''}`,
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
