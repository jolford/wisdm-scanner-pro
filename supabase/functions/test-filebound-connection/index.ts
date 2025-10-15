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
