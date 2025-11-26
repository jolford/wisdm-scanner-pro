import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, username, password } = await req.json();

    if (!url || !username || !password) {
      throw new Error('Missing required Resware connection parameters');
    }

    console.log('Testing Resware connection:', url);

    // Test authentication with Resware API
    const response = await fetch(`${url}/api/auth/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resware connection failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Resware connection test successful:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Resware',
        details: result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Resware connection test error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
