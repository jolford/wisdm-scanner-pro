import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { url, username, password } = await req.json();

    if (!url || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'URL, username, and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing Filebound connection to ${url}`);

    // Create Basic Auth header
    const authString = btoa(`${username}:${password}`);
    
    // Attempt to authenticate and fetch projects list
    const fileboundResponse = await fetch(`${url}/api/projects`, {
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

    const projectsData = await fileboundResponse.json();
    
    // Fetch field definitions for each project (or just first one for testing)
    let projectFields: Record<string, any> = {};
    
    if (projectsData.projects && projectsData.projects.length > 0) {
      const firstProject = projectsData.projects[0];
      const fieldsResponse = await fetch(`${url}/api/projects/${firstProject.id}/fields`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
        },
      });
      
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        projectFields[firstProject.id] = fieldsData.fields || [];
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
        projects: projectsData.projects || [],
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
