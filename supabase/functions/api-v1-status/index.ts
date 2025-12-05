import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Hash API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let apiKeyId: string | null = null;
  let statusCode = 200;

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      statusCode = 401;
      return new Response(
        JSON.stringify({ error: "Missing API key. Include X-API-Key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Securely validate API key using SHA-256 hash
    const keyHash = await hashApiKey(apiKey);
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_api_key', { _key_hash: keyHash });

    if (validationError || !validation?.valid) {
      console.error("API key validation failed:", validationError || validation?.reason);
      statusCode = 401;
      return new Response(
        JSON.stringify({ 
          error: "Invalid API key",
          reason: validation?.reason || "key_not_found"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    apiKeyId = validation.api_key_id;
    const customerId = validation.customer_id;
    const allowedProjectIds = validation.allowed_project_ids;

    const url = new URL(req.url);
    const documentId = url.searchParams.get("document_id");
    const batchId = url.searchParams.get("batch_id");

    if (!documentId && !batchId) {
      statusCode = 400;
      return new Response(
        JSON.stringify({
          error: "Missing required parameter: document_id or batch_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (documentId) {
      // Get document status - verify it belongs to the customer
      const { data: document, error: docError } = await supabase
        .from("documents")
        .select(`
          id, file_name, validation_status, extracted_metadata, confidence_score, created_at, validated_at,
          batch:batches!inner(project:projects!inner(customer_id))
        `)
        .eq("id", documentId)
        .single();

      if (docError) {
        console.error("Document fetch error:", docError);
        statusCode = 404;
        return new Response(
          JSON.stringify({ error: "Document not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify document belongs to the authenticated customer
      const docCustomerId = (document.batch as any)?.project?.customer_id;
      if (docCustomerId !== customerId) {
        console.error("Customer mismatch - document belongs to different customer");
        statusCode = 403;
        return new Response(
          JSON.stringify({ error: "Access denied to this document" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
      // Get batch status - verify it belongs to the customer
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .select(`
          id, batch_name, status, total_documents, processed_documents, validated_documents, error_count, created_at, completed_at,
          project:projects!inner(customer_id)
        `)
        .eq("id", batchId)
        .single();

      if (batchError) {
        console.error("Batch fetch error:", batchError);
        statusCode = 404;
        return new Response(
          JSON.stringify({ error: "Batch not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify batch belongs to the authenticated customer
      const batchCustomerId = (batch.project as any)?.customer_id;
      if (batchCustomerId !== customerId) {
        console.error("Customer mismatch - batch belongs to different customer");
        statusCode = 403;
        return new Response(
          JSON.stringify({ error: "Access denied to this batch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

    statusCode = 400;
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("API status error:", error);
    statusCode = 500;
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    // Log API usage
    if (apiKeyId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase.from("api_key_usage").insert({
          api_key_id: apiKeyId,
          endpoint: "/api-v1-status",
          method: "GET",
          status_code: statusCode,
          response_time_ms: Date.now() - startTime,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });
      } catch (logError) {
        console.error("Failed to log API usage:", logError);
      }
    }
  }
});
