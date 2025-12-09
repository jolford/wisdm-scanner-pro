import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const projectId = url.pathname.split("/").pop();
    const isDetailRequest = projectId && projectId !== "api-projects";

    if (req.method === "GET") {
      if (isDetailRequest) {
        // GET /api-projects/{id} - Get specific project
        const { data: project, error } = await supabase
          .from("projects")
          .select("id, name, description, extraction_fields, customer_id, detect_pii, created_at, updated_at")
          .eq("id", projectId)
          .single();

        if (error || !project) {
          return new Response(
            JSON.stringify({ error: "Project not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ project }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // GET /api-projects - List all projects
        const customerId = url.searchParams.get("customer_id");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        let query = supabase
          .from("projects")
          .select("id, name, description, extraction_fields, customer_id, detect_pii, created_at, updated_at", { count: "exact" })
          .order("name", { ascending: true })
          .range(offset, offset + limit - 1);

        if (customerId) {
          query = query.eq("customer_id", customerId);
        }

        const { data: projects, error, count } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            projects,
            pagination: {
              total: count,
              limit,
              offset,
              hasMore: (offset + limit) < (count || 0),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
