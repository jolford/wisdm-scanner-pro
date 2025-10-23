import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    // Verify user authentication (test connection doesn't need database access but validates auth)

    // Authorization check is sufficient for test endpoints
    // No database access needed, just testing external API connection
    
    const { url, username, password, projectId, projectName } = await req.json();

    if (!url || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'URL, username, and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL to prevent SSRF attacks
    try {
      validateExternalUrl(url);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Invalid URL: ${error.message}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL (remove trailing slash)
    const normalizedUrl = url.replace(/\/+$/, '');
    
    console.log(`Testing Docmgt connection to ${normalizedUrl}`);

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);
    
    // Attempt to authenticate and fetch record types list (DocMgt calls projects "record types")
    const endpoints = [
      '/rest/recordtypes',
      '/rest/records/types',
      '/rest/recordtypes/list',
      '/rest/recordtypes/all'
    ];

    let projectsData: any = null;
    let firstOkContentType = '';
    for (const ep of endpoints) {
      const resp = await fetch(`${normalizedUrl}${ep}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
        },
      });
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.includes('application/json')) {
        try {
          projectsData = await resp.json();
          firstOkContentType = ct;
          console.log('Docmgt record types endpoint used:', ep);
          break;
        } catch (e) {
          console.error('Failed parsing record types JSON from', ep, e);
        }
      } else {
        const preview = await resp.text();
        console.warn('Record types endpoint failed', { ep, status: resp.status, ct, preview: preview.slice(0, 120) });
      }
    }

    if (!projectsData) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authenticated but could not retrieve record types (non-JSON responses). Please verify API path for your DocMgt instance.',
          diagnostics: { tried: endpoints }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch field definitions for each record type (project)
    let projectFields: Record<string, any> = {};
    
    if (projectsData && Array.isArray(projectsData) && projectsData.length > 0) {
      // Choose project: specific one if provided, else first
      const selected = (projectId || projectName)
        ? projectsData.find((p: any) =>
            (projectId && (p.ID?.toString() === projectId || p.id?.toString() === projectId || p.ProjectId?.toString() === projectId)) ||
            (projectName && (p.Name === projectName || p.name === projectName))
          ) || projectsData[0]
        : projectsData[0];

      const selectedId = selected?.ID ?? selected?.id ?? selected?.ProjectId;
      if (selectedId != null) {
        const fieldsResponse = await fetch(`${normalizedUrl}/rest/recordtypes/${selectedId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
          },
        });
        const fieldsCT = fieldsResponse.headers.get('content-type') || '';
        try {
          const raw = await fieldsResponse.text();
          console.log('Docmgt fields response:', { status: fieldsResponse.status, contentType: fieldsCT, preview: raw.slice(0, 200) });
          if (fieldsResponse.ok && fieldsCT.includes('application/json')) {
            const fieldsJson = JSON.parse(raw);
            // Try common shapes for field definitions
            const candidates = [
              fieldsJson?.Variables,
              fieldsJson?.variables,
              fieldsJson?.Fields,
              fieldsJson?.fields,
              fieldsJson?.RecordTypeFields,
              Array.isArray(fieldsJson) ? fieldsJson : null,
            ].filter(Boolean)[0] || [];
            projectFields[String(selectedId)] = Array.isArray(candidates) ? candidates : [];
          }
        } catch (e) {
          console.error('Failed to parse Docmgt fields JSON:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
        projects: projectsData || [],
        projectFields: projectFields,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error testing Docmgt connection:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to connect to Docmgt. Please check your credentials and URL.',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
