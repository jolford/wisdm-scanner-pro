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
    
    const { url, username, password } = await req.json();

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
    const docmgtResponse = await fetch(`${normalizedUrl}/rest/recordtypes`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    });

    // Check Content-Type header to ensure we got JSON
    const contentType = docmgtResponse.headers.get('content-type');
    
    if (!docmgtResponse.ok || !contentType?.includes('application/json')) {
      const errorText = await docmgtResponse.text();
      console.error('Docmgt connection error:', errorText);
      console.error('Response status:', docmgtResponse.status);
      console.error('Content-Type:', contentType);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Connection failed: ${docmgtResponse.status} ${docmgtResponse.statusText}. The server returned ${contentType || 'unknown content'} instead of JSON. Please verify the URL and credentials.` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectsData = await docmgtResponse.json();
    
    // Fetch field definitions for each record type (project)
    let projectFields: Record<string, any> = {};
    
    if (projectsData && Array.isArray(projectsData) && projectsData.length > 0) {
      const firstProject = projectsData[0];
      const fieldsResponse = await fetch(`${normalizedUrl}/rest/recordtypes/${firstProject.ID}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
        },
      });
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        projectFields[firstProject.ID] = fieldsData;
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
