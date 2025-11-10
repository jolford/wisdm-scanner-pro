import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  customer_id: string;
  event_type: string;
  payload: any;
}

interface WebhookConfig {
  id: string;
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  retry_config?: {
    max_retries: number;
    retry_delay_seconds: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customer_id, event_type, payload }: WebhookPayload = await req.json();

    console.log(`Triggering webhooks for customer ${customer_id}, event: ${event_type}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active webhooks for this customer that subscribe to this event
    const { data: webhooks, error: fetchError } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('is_active', true);

    if (fetchError) throw fetchError;

    if (!webhooks || webhooks.length === 0) {
      console.log('No active webhooks found');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;

    // Send webhook to each matching endpoint
    for (const webhook of webhooks) {
      const events = webhook.events as string[];
      
      // Check if this webhook subscribes to this event type
      if (!events.includes(event_type) && !events.includes('*')) {
        continue;
      }

      await sendWebhook(supabase, webhook as WebhookConfig, event_type, payload);
      sentCount++;

      // Update last triggered timestamp
      await supabase
        .from('webhook_configs')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', webhook.id);
    }

    console.log(`Sent ${sentCount} webhooks`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error sending webhooks:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendWebhook(
  supabase: any,
  webhook: WebhookConfig,
  event_type: string,
  payload: any
) {
  const maxRetries = webhook.retry_config?.max_retries || 3;
  const retryDelay = (webhook.retry_config?.retry_delay_seconds || 60) * 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event_type,
        'X-Webhook-Attempt': attempt.toString(),
        ...(webhook.headers || {}),
      };

      // Add HMAC signature if secret is configured
      if (webhook.secret) {
        const signature = await generateSignature(webhook.secret, payload);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event_type,
          payload,
          timestamp: new Date().toISOString(),
        }),
      });

      const responseBody = await response.text();

      // Log delivery
      await supabase.from('webhook_logs').insert({
        webhook_config_id: webhook.id,
        event_type,
        payload,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000), // Limit size
        attempt_number: attempt,
        delivered_at: response.ok ? new Date().toISOString() : null,
        error_message: response.ok ? null : `HTTP ${response.status}: ${responseBody}`,
      });

      if (response.ok) {
        console.log(`Webhook delivered successfully to ${webhook.url}`);
        return; // Success, exit retry loop
      }

      console.error(`Webhook delivery failed (attempt ${attempt}): HTTP ${response.status}`);
      
      // If not last attempt, wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    } catch (error: any) {
      console.error(`Webhook delivery error (attempt ${attempt}):`, error);

      await supabase.from('webhook_logs').insert({
        webhook_config_id: webhook.id,
        event_type,
        payload,
        attempt_number: attempt,
        error_message: error?.message || 'Unknown error',
      });

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
}

async function generateSignature(secret: string, payload: any): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
