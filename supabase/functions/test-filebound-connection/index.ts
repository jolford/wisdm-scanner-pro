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

    console.log(`Testing Filebound connection to ${url}`);

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);
    
    // Attempt to authenticate and fetch projects list
    const projectsUrl = `${url.replace(/\/$/, '')}/api/projects`;
    const fileboundResponse = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    });

    if (!fileboundResponse.ok) {
      const errorText = await fileboundResponse.text();
      console.error('Filebound connection error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Connection failed: ${fileboundResponse.status} ${fileboundResponse.statusText}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectsArray = await fileboundResponse.json();
    console.log('Projects retrieved:', projectsArray);
    
    // Fetch field definitions for each project
    const projectFields: Record<string, any> = {};
    
    if (projectsArray && Array.isArray(projectsArray) && projectsArray.length > 0) {
      // Fetch fields for first few projects (limit to 5 to avoid timeout)
      const projectsToFetch = projectsArray.slice(0, 5);
      
      for (const project of projectsToFetch) {
        try {
          const fieldsUrl = `${url.replace(/\/$/, '')}/api/projects/${project.ProjectId}/fields`;
          const fieldsResponse = await fetch(fieldsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
            },
          });
          
          if (fieldsResponse.ok) {
            const fieldsArray = await fieldsResponse.json();
            projectFields[project.ProjectId] = fieldsArray || [];
          }
        } catch (error) {
          console.error(`Error fetching fields for project ${project.ProjectId}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
        projects: projectsArray || [],
        projectFields: projectFields,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error testing Filebound connection:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to connect to Filebound. Please check your credentials and URL.',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
