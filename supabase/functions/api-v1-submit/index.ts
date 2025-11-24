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

    // Verify API key (stored in project metadata or separate api_keys table)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For now, validate against a simple API key check
    // In production, you'd want a proper api_keys table with rate limiting
    const { data: customer, error: authError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", apiKey) // Simplified: using customer_id as API key
      .single();

    if (authError || !customer) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, file_base64, file_name, file_type, batch_name, metadata } =
      await req.json();

    if (!project_id || !file_base64 || !file_name) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: project_id, file_base64, file_name",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or get batch
    let batchId = null;
    if (batch_name) {
      const { data: existingBatch } = await supabase
        .from("batches")
        .select("id")
        .eq("project_id", project_id)
        .eq("batch_name", batch_name)
        .single();

      if (existingBatch) {
        batchId = existingBatch.id;
      }
    }

    if (!batchId) {
      const { data: newBatch, error: batchError } = await supabase
        .from("batches")
        .insert({
          project_id,
          batch_name: batch_name || `API-${Date.now()}`,
          created_by: customer.id,
          customer_id: customer.id,
          status: "processing",
        })
        .select()
        .single();

      if (batchError) throw batchError;
      batchId = newBatch.id;
    }

    // Decode base64 and upload to storage
    const fileData = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    const fileName = `${Date.now()}_${file_name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(`${customer.id}/${fileName}`, fileData, {
        contentType: file_type || "application/pdf",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(`${customer.id}/${fileName}`);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        batch_id: batchId,
        project_id,
        file_name,
        file_type: file_type || "application/pdf",
        file_url: urlData.publicUrl,
        uploaded_by: customer.id,
        validation_status: "pending",
      })
      .select()
      .single();

    if (docError) throw docError;

    // Trigger OCR processing
    await supabase.functions.invoke("ocr-scan", {
      body: {
        documentId: document.id,
        projectId: project_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        batch_id: batchId,
        status: "processing",
        message: "Document submitted successfully and queued for processing",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API submit error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
