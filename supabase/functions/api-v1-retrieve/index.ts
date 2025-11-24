import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API key. Include X-API-Key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify API key
    const { data: customer, error: authError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", apiKey)
      .single();

    if (authError || !customer) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const documentId = url.searchParams.get("document_id");
    const batchId = url.searchParams.get("batch_id");
    const status = url.searchParams.get("status"); // Filter by validation_status

    if (!documentId && !batchId) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameter: document_id or batch_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (documentId) {
      // Retrieve single document data
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;

      if (document.validation_status !== "validated") {
        return new Response(
          JSON.stringify({
            error: "Document not yet validated. Status: " + document.validation_status,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          document_id: document.id,
          file_name: document.file_name,
          status: document.validation_status,
          confidence_score: document.confidence_score,
          extracted_data: document.extracted_metadata,
          line_items: document.line_items,
          validated_at: document.validated_at,
          validated_by: document.validated_by,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (batchId) {
      // Retrieve all validated documents in batch
      let query = supabase
        .from("documents")
        .select("*")
        .eq("batch_id", batchId);

      if (status) {
        query = query.eq("validation_status", status);
      } else {
        query = query.eq("validation_status", "validated");
      }

      const { data: documents, error: docsError } = await query;

      if (docsError) throw docsError;

      return new Response(
        JSON.stringify({
          batch_id: batchId,
          document_count: documents.length,
          documents: documents.map((doc) => ({
            document_id: doc.id,
            file_name: doc.file_name,
            status: doc.validation_status,
            confidence_score: doc.confidence_score,
            extracted_data: doc.extracted_metadata,
            line_items: doc.line_items,
            validated_at: doc.validated_at,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("API retrieve error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
