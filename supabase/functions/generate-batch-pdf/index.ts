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
    const { documents, batchName } = await req.json();
    console.log(`Generating PDF for batch: ${batchName} with ${documents.length} documents`);

    // Using jsPDF-like approach with canvas
    // For now, we'll return a data structure that the frontend can use
    // to generate the PDF client-side with a library like jsPDF
    
    const pdfData = {
      batchName,
      generatedAt: new Date().toISOString(),
      documents: documents.map((doc: any) => ({
        fileName: doc.file_name,
        imageUrl: doc.file_url,
        metadata: doc.extracted_metadata,
        text: doc.extracted_text,
        validatedAt: doc.validated_at,
      })),
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfData,
        message: 'PDF data prepared successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
