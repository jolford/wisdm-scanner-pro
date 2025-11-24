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

    if (!documentId && !batchId) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameter: document_id or batch_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (documentId) {
      // Get document status
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select("id, file_name, validation_status, extracted_metadata, confidence_score, created_at, validated_at")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;

      return new Response(
        JSON.stringify({
          document_id: document.id,
          file_name: document.file_name,
          status: document.validation_status,
          confidence_score: document.confidence_score,
          extracted_data: document.extracted_metadata,
          created_at: document.created_at,
          validated_at: document.validated_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (batchId) {
      // Get batch status
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .select("id, batch_name, status, total_documents, processed_documents, validated_documents, error_count, created_at, completed_at")
        .eq("id", batchId)
        .single();

      if (batchError) throw batchError;

      const { data: documents } = await supabase
        .from("documents")
        .select("id, file_name, validation_status, confidence_score")
        .eq("batch_id", batchId);

      return new Response(
        JSON.stringify({
          batch_id: batch.id,
          batch_name: batch.batch_name,
          status: batch.status,
          total_documents: batch.total_documents,
          processed_documents: batch.processed_documents,
          validated_documents: batch.validated_documents,
          error_count: batch.error_count,
          created_at: batch.created_at,
          completed_at: batch.completed_at,
          documents: documents || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("API status error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
