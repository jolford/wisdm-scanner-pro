import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, verifyAuth } from "../_shared/auth-helpers.ts";

// Generate a cryptographically secure API key
function generateApiKey(): string {
  const prefix = "wisdm_ak";
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${randomPart}`;
}

// Hash function for API key storage
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) return authResult;
    
    const { user, isAdmin, isSystemAdmin } = authResult;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = req.method !== "GET" ? await req.json() : {};

    // Get user's customer_id
    const { data: userCustomers } = await supabase
      .from("user_customers")
      .select("customer_id")
      .eq("user_id", user.id);

    const userCustomerIds = userCustomers?.map(uc => uc.customer_id) || [];

    switch (action) {
      case "create": {
        // Must be admin to create API keys
        if (!isAdmin && !isSystemAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required to create API keys" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { 
          customer_id, 
          name, 
          description,
          scope = "write",
          allowed_project_ids,
          rate_limit_per_minute = 60,
          rate_limit_per_hour = 1000,
          rate_limit_per_day = 10000,
          expires_at
        } = body;

        // Verify user has access to the customer
        if (!isSystemAdmin && !userCustomerIds.includes(customer_id)) {
          return new Response(
            JSON.stringify({ error: "Access denied to this customer" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate key
        const plainKey = generateApiKey();
        const keyHash = await hashApiKey(plainKey);
        const keyPrefix = plainKey.substring(0, 8);

        // Create API key record
        const { data: apiKey, error } = await supabase
          .from("api_keys")
          .insert({
            customer_id,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            name,
            description,
            scope,
            allowed_project_ids: allowed_project_ids || null,
            rate_limit_per_minute,
            rate_limit_per_hour,
            rate_limit_per_day,
            expires_at: expires_at || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Return the plain key only once - it won't be retrievable again
        return new Response(
          JSON.stringify({
            success: true,
            api_key: {
              id: apiKey.id,
              key: plainKey, // Only returned on creation!
              key_prefix: keyPrefix,
              name: apiKey.name,
              scope: apiKey.scope,
              created_at: apiKey.created_at,
            },
            message: "API key created. Save this key securely - it won't be shown again.",
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        const { customer_id } = body;

        // Build query
        let query = supabase
          .from("api_keys")
          .select(`
            id,
            customer_id,
            key_prefix,
            name,
            description,
            scope,
            allowed_project_ids,
            rate_limit_per_minute,
            rate_limit_per_hour,
            rate_limit_per_day,
            is_active,
            expires_at,
            last_used_at,
            usage_count,
            created_at,
            revoked_at
          `)
          .order("created_at", { ascending: false });

        // Filter by customer if specified
        if (customer_id) {
          if (!isSystemAdmin && !userCustomerIds.includes(customer_id)) {
            return new Response(
              JSON.stringify({ error: "Access denied to this customer" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          query = query.eq("customer_id", customer_id);
        } else if (!isSystemAdmin) {
          query = query.in("customer_id", userCustomerIds);
        }

        const { data: keys, error } = await query;
        if (error) throw error;

        return new Response(
          JSON.stringify({ api_keys: keys }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "revoke": {
        if (!isAdmin && !isSystemAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required to revoke API keys" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { key_id, reason } = body;

        // Get the key first to check access
        const { data: existingKey } = await supabase
          .from("api_keys")
          .select("customer_id")
          .eq("id", key_id)
          .single();

        if (!existingKey) {
          return new Response(
            JSON.stringify({ error: "API key not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!isSystemAdmin && !userCustomerIds.includes(existingKey.customer_id)) {
          return new Response(
            JSON.stringify({ error: "Access denied to this API key" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("api_keys")
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
            revocation_reason: reason || "Manually revoked",
          })
          .eq("id", key_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: "API key revoked" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "rotate": {
        if (!isAdmin && !isSystemAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required to rotate API keys" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { key_id } = body;

        // Get the old key
        const { data: oldKey } = await supabase
          .from("api_keys")
          .select("*")
          .eq("id", key_id)
          .single();

        if (!oldKey) {
          return new Response(
            JSON.stringify({ error: "API key not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!isSystemAdmin && !userCustomerIds.includes(oldKey.customer_id)) {
          return new Response(
            JSON.stringify({ error: "Access denied to this API key" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate new key
        const plainKey = generateApiKey();
        const keyHash = await hashApiKey(plainKey);
        const keyPrefix = plainKey.substring(0, 8);

        // Create new key
        const { data: newKey, error: createError } = await supabase
          .from("api_keys")
          .insert({
            customer_id: oldKey.customer_id,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            name: oldKey.name,
            description: oldKey.description,
            scope: oldKey.scope,
            allowed_project_ids: oldKey.allowed_project_ids,
            rate_limit_per_minute: oldKey.rate_limit_per_minute,
            rate_limit_per_hour: oldKey.rate_limit_per_hour,
            rate_limit_per_day: oldKey.rate_limit_per_day,
            expires_at: oldKey.expires_at,
            created_by: user.id,
            rotated_from_key_id: oldKey.id,
            rotated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;

        // Revoke old key
        await supabase
          .from("api_keys")
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
            revocation_reason: `Rotated to new key ${newKey.id}`,
          })
          .eq("id", key_id);

        return new Response(
          JSON.stringify({
            success: true,
            api_key: {
              id: newKey.id,
              key: plainKey,
              key_prefix: keyPrefix,
              name: newKey.name,
              scope: newKey.scope,
              rotated_from: oldKey.id,
            },
            message: "API key rotated. Save the new key securely - it won't be shown again.",
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        if (!isAdmin && !isSystemAdmin) {
          return new Response(
            JSON.stringify({ error: "Admin access required to update API keys" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { 
          key_id, 
          name, 
          description, 
          scope,
          allowed_project_ids,
          rate_limit_per_minute,
          rate_limit_per_hour,
          rate_limit_per_day,
          expires_at,
          is_active
        } = body;

        // Get the key first to check access
        const { data: existingKey } = await supabase
          .from("api_keys")
          .select("customer_id")
          .eq("id", key_id)
          .single();

        if (!existingKey) {
          return new Response(
            JSON.stringify({ error: "API key not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!isSystemAdmin && !userCustomerIds.includes(existingKey.customer_id)) {
          return new Response(
            JSON.stringify({ error: "Access denied to this API key" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (scope !== undefined) updateData.scope = scope;
        if (allowed_project_ids !== undefined) updateData.allowed_project_ids = allowed_project_ids;
        if (rate_limit_per_minute !== undefined) updateData.rate_limit_per_minute = rate_limit_per_minute;
        if (rate_limit_per_hour !== undefined) updateData.rate_limit_per_hour = rate_limit_per_hour;
        if (rate_limit_per_day !== undefined) updateData.rate_limit_per_day = rate_limit_per_day;
        if (expires_at !== undefined) updateData.expires_at = expires_at;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data: updatedKey, error } = await supabase
          .from("api_keys")
          .update(updateData)
          .eq("id", key_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, api_key: updatedKey }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "usage": {
        const { key_id, days = 7 } = body;

        // Get the key first to check access
        const { data: existingKey } = await supabase
          .from("api_keys")
          .select("customer_id")
          .eq("id", key_id)
          .single();

        if (!existingKey) {
          return new Response(
            JSON.stringify({ error: "API key not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!isSystemAdmin && !userCustomerIds.includes(existingKey.customer_id)) {
          return new Response(
            JSON.stringify({ error: "Access denied to this API key" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: usage, error } = await supabase
          .from("api_key_usage")
          .select("*")
          .eq("api_key_id", key_id)
          .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1000);

        if (error) throw error;

        // Calculate stats
        const stats = {
          total_requests: usage?.length || 0,
          success_rate: usage?.length 
            ? (usage.filter(u => u.status_code >= 200 && u.status_code < 400).length / usage.length * 100).toFixed(1)
            : 0,
          avg_response_time: usage?.length
            ? Math.round(usage.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / usage.length)
            : 0,
        };

        return new Response(
          JSON.stringify({ usage, stats }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: create, list, revoke, rotate, update, or usage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("API key management error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
