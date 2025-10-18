// Edge function to test connection to Microsoft SharePoint
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers
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
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Localhost URLs are not allowed');
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = hostname.match(ipv4Regex);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets[0] === 10) throw new Error('Private IP addresses are not allowed');
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) throw new Error('Private IP addresses are not allowed');
    if (octets[0] === 192 && octets[1] === 168) throw new Error('Private IP addresses are not allowed');
    if (octets[0] === 169 && octets[1] === 254) throw new Error('Link-local addresses are not allowed');
  }

  if (hostname.includes(':')) {
    if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) {
      throw new Error('Private IPv6 addresses are not allowed');
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
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

    const { url, accessToken } = await req.json();

    if (!url || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'URL and access token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    try {
      validateExternalUrl(url);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Testing SharePoint connection to:', url);

    // Test connection by fetching document libraries
    const libsResponse = await fetch(`${url}/_api/web/lists?$filter=BaseTemplate eq 101`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json;odata=verbose',
      },
    });

    if (!libsResponse.ok) {
      const errorText = await libsResponse.text();
      console.error('SharePoint connection error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection failed: ${libsResponse.status}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const libsData = await libsResponse.json();
    const libraries = libsData.d?.results || [];

    // Fetch fields for each library (limit to first 3)
    const librariesWithFields = await Promise.all(
      libraries.slice(0, 3).map(async (lib: any) => {
        try {
          const fieldsResponse = await fetch(
            `${url}/_api/web/lists/getbytitle('${lib.Title}')/fields?$filter=Hidden eq false and ReadOnlyField eq false`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json;odata=verbose',
              },
            }
          );
          
          if (fieldsResponse.ok) {
            const fieldsData = await fieldsResponse.json();
            return {
              id: lib.Id,
              name: lib.Title,
              fields: fieldsData.d?.results || [],
            };
          }
        } catch (err) {
          console.error(`Error fetching fields for library ${lib.Title}:`, err);
        }
        
        return {
          id: lib.Id,
          name: lib.Title,
          fields: [],
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        libraries: librariesWithFields,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error testing SharePoint connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to test connection' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
