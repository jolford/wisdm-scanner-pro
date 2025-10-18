// Edge function to test connection to OpenText Documentum
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

    const { url, username, password } = await req.json();

    if (!url || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'URL, username, and password are required' }),
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

    console.log('Testing Documentum connection to:', url);

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);

    // Test connection by fetching repositories
    const reposResponse = await fetch(`${url}/dctm-rest/repositories`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    });

    if (!reposResponse.ok) {
      const errorText = await reposResponse.text();
      console.error('Documentum connection error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection failed: ${reposResponse.status}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reposData = await reposResponse.json();
    const repositories = reposData.entries || [];

    // Fetch cabinets/folders for each repository (limit to first 3)
    const repositoriesWithFolders = await Promise.all(
      repositories.slice(0, 3).map(async (repo: any) => {
        try {
          const cabinetsResponse = await fetch(
            `${url}/dctm-rest/repositories/${repo.id}/cabinets`,
            {
              headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json',
              },
            }
          );
          
          if (cabinetsResponse.ok) {
            const cabinetsData = await cabinetsResponse.json();
            return {
              id: repo.id,
              name: repo.name,
              cabinets: cabinetsData.entries || [],
            };
          }
        } catch (err) {
          console.error(`Error fetching cabinets for repo ${repo.id}:`, err);
        }
        
        return {
          id: repo.id,
          name: repo.name,
          cabinets: [],
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        repositories: repositoriesWithFolders,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error testing Documentum connection:', error);
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
