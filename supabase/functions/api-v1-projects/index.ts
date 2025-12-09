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
    const allowedProjectIds = validation.allowed_project_ids; // API key may restrict to specific projects

    console.log(`API key validated for customer: ${customerId}`);

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");

    if (projectId) {
      // Get specific project - verify it belongs to customer
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, name, description, extraction_fields, detect_pii, created_at, updated_at")
        .eq("id", projectId)
        .eq("customer_id", customerId) // CRITICAL: Filter by customer
        .single();

      if (projectError || !project) {
        console.error("Project not found or access denied:", projectError);
        statusCode = 404;
        return new Response(
          JSON.stringify({ error: "Project not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If API key has project restrictions, verify this project is allowed
      if (allowedProjectIds && allowedProjectIds.length > 0) {
        if (!allowedProjectIds.includes(projectId)) {
          statusCode = 403;
          return new Response(
            JSON.stringify({ error: "API key does not have access to this project" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ project }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List all projects for this customer
    let query = supabase
      .from("projects")
      .select("id, name, description, extraction_fields, detect_pii, created_at, updated_at")
      .eq("customer_id", customerId) // CRITICAL: Filter by customer
      .eq("is_active", true)
      .order("name", { ascending: true });

    // If API key has project restrictions, only return those projects
    if (allowedProjectIds && allowedProjectIds.length > 0) {
      query = query.in("id", allowedProjectIds);
    }

    const { data: projects, error: projectsError } = await query;

    if (projectsError) {
      console.error("Projects fetch error:", projectsError);
      statusCode = 500;
      return new Response(
        JSON.stringify({ error: "Failed to retrieve projects" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Returning ${projects?.length || 0} projects for customer ${customerId}`);

    return new Response(
      JSON.stringify({
        projects: projects || [],
        count: projects?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("API projects error:", error);
    statusCode = 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
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
          endpoint: "/api-v1-projects",
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
