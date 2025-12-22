import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { ip_address, endpoint, email } = await req.json();

    if (!ip_address || !endpoint) {
      return new Response(
        JSON.stringify({ error: "ip_address and endpoint are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Checking rate limit for IP: ${ip_address}, endpoint: ${endpoint}`);

    // Use enhanced rate limit check with exponential backoff
    const { data: result, error } = await supabase.rpc("check_auth_rate_limit_enhanced", {
      _ip_address: ip_address,
      _endpoint: endpoint,
      _email: email || null,
    });

    if (error) {
      console.error("Rate limit check error:", error);
      // On error, allow the request (fail open for auth)
      return new Response(
        JSON.stringify({ allowed: true, error: "Rate limit check failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log("Rate limit result:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Rate limit check error:", error);
    // Fail open for authentication
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ allowed: true, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
