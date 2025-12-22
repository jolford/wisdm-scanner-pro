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

    console.log("Starting scheduled security scan...");

    // Run the security scan function
    const { data: scanResult, error: scanError } = await supabase.rpc("run_security_scan");

    if (scanError) {
      console.error("Security scan error:", scanError);
      throw scanError;
    }

    console.log("Security scan completed:", scanResult);

    const alertsCount = scanResult?.alerts_found || 0;

    // Store the scan result for admin review
    const { error: insertError } = await supabase
      .from("security_scan_notifications")
      .insert({
        scan_result: scanResult,
        alerts_count: alertsCount,
      });

    if (insertError) {
      console.error("Failed to store scan notification:", insertError);
    }

    // If there are alerts, log them prominently
    if (alertsCount > 0) {
      console.warn(`⚠️ Security scan found ${alertsCount} alerts!`);
      console.warn("Alerts:", JSON.stringify(scanResult?.alerts || [], null, 2));
      
      // Get admin emails for notification (could be extended to send emails)
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "system_admin"]);
      
      console.log(`Notifying ${admins?.length || 0} admins about security alerts`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scan_completed: new Date().toISOString(),
        alerts_found: alertsCount,
        details: scanResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Scheduled security scan failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
