import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, handleCors, corsHeaders } from "../_shared/auth-helpers.ts";

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication - only authenticated users can upload scanned images
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;
    console.log(`Authenticated user ${user.id} uploading scanned image`);

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
