import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    // Handle multipart form data from DWT HTTPUpload
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('RemoteFile') as File;
      const sessionId = formData.get('sessionId') as string;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file received' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store the image data temporarily (could use storage bucket or return base64)
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      console.log(`Received scanned image: ${file.name}, size: ${file.size}, session: ${sessionId}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        fileName: file.name,
        size: file.size,
        base64: base64,
        mimeType: file.type || 'image/png'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error receiving scanned image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
