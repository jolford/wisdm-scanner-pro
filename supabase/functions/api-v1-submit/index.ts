import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Hash function for API key validation
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let apiKeyId: string | null = null;
  let statusCode = 500;

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      statusCode = 401;
      return new Response(
        JSON.stringify({ error: "Missing API key. Include X-API-Key header." }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the provided API key for secure comparison
    const keyHash = await hashApiKey(apiKey);

    // Validate API key using secure database function
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_api_key', { _key_hash: keyHash });

    if (validationError || !validation?.valid) {
      statusCode = validation?.reason === 'rate_limit_minute' || 
                   validation?.reason === 'rate_limit_hour' || 
                   validation?.reason === 'rate_limit_day' ? 429 : 401;
      
      const errorMessage = validation?.reason === 'invalid_key' 
        ? 'Invalid API key'
        : validation?.reason?.startsWith('rate_limit') 
          ? `Rate limit exceeded: ${validation.reason}`
          : validation?.reason === 'key_expired'
            ? 'API key has expired'
            : validation?.reason === 'key_revoked'
              ? 'API key has been revoked'
              : validation?.reason === 'key_inactive'
                ? 'API key is inactive'
                : 'Authentication failed';

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          rate_limit: validation?.rate_limit
        }),
        { 
          status: statusCode, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            ...(statusCode === 429 && { "Retry-After": "60" })
          } 
        }
      );
    }

    apiKeyId = validation.api_key_id;
    const customerId = validation.customer_id;
    const scope = validation.scope;
    const allowedProjectIds = validation.allowed_project_ids;

    // Check scope - need 'write' or 'admin' for document submission
    if (scope === 'read') {
      statusCode = 403;
      return new Response(
        JSON.stringify({ error: "API key does not have write permissions" }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { project_id, file_base64, file_name, file_type, batch_name, metadata } =
      await req.json();

    if (!project_id || !file_base64 || !file_name) {
      statusCode = 400;
      return new Response(
        JSON.stringify({
          error: "Missing required fields: project_id, file_base64, file_name",
        }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if project is allowed for this API key
    if (allowedProjectIds && allowedProjectIds.length > 0) {
      if (!allowedProjectIds.includes(project_id)) {
        statusCode = 403;
        return new Response(
          JSON.stringify({ error: "API key does not have access to this project" }),
          { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify project belongs to the customer
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, customer_id")
      .eq("id", project_id)
      .eq("customer_id", customerId)
      .single();

    if (projectError || !project) {
      statusCode = 403;
      return new Response(
        JSON.stringify({ error: "Project not found or access denied" }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          created_by: customerId,
          customer_id: customerId,
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
      .upload(`${project_id}/${fileName}`, fileData, {
        contentType: file_type || "application/pdf",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(`${project_id}/${fileName}`);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        batch_id: batchId,
        project_id,
        file_name,
        file_type: file_type || "application/pdf",
        file_url: urlData.publicUrl,
        uploaded_by: customerId,
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

    statusCode = 200;
    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        batch_id: batchId,
        status: "processing",
        message: "Document submitted successfully and queued for processing",
        rate_limit: validation.rate_limit
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API submit error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    // Log API usage
    if (apiKeyId) {
      const responseTime = Date.now() - startTime;
      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      
      await supabase.from("api_key_usage").insert({
        api_key_id: apiKeyId,
        endpoint: "/api/v1/submit",
        method: req.method,
        ip_address: clientIp,
        user_agent: userAgent,
        status_code: statusCode,
        response_time_ms: responseTime,
      });
    }
  }
});
