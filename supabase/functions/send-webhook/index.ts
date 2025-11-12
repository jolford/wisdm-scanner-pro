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
  webhook_type?: string;
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
      
      // Allow test webhooks to always be sent, or check if webhook subscribes to this event type
      if (event_type !== 'test.webhook' && !events.includes(event_type) && !events.includes('*')) {
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
      // Format payload based on webhook type
      let formattedPayload;
      if (webhook.webhook_type === 'teams') {
        formattedPayload = formatTeamsMessage(event_type, payload);
      } else {
        formattedPayload = {
          event_type,
          payload,
          timestamp: new Date().toISOString(),
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event_type,
        'X-Webhook-Attempt': attempt.toString(),
        ...(webhook.headers || {}),
      };

      // Add HMAC signature if secret is configured (not for Teams)
      if (webhook.secret && webhook.webhook_type !== 'teams') {
        const signature = await generateSignature(webhook.secret, payload);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(formattedPayload),
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

function formatTeamsMessage(event_type: string, data: any): any {
  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            text: getEventTitle(event_type),
            weight: 'Bolder',
            size: 'Large',
            color: getEventColor(event_type)
          },
          {
            type: 'FactSet',
            facts: formatEventFacts(event_type, data)
          }
        ],
        actions: getEventActions(event_type, data)
      }
    }]
  };

  return card;
}

function getEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    'batch.completed': '✅ Batch Processing Complete',
    'batch.failed': '❌ Batch Processing Failed',
    'document.validated': '✅ Document Validated',
    'document.validation_failed': '⚠️ Document Validation Failed',
    'document.low_confidence': '📊 Low Confidence Detection',
    'document.duplicate_detected': '🔍 Duplicate Document Detected',
    'export.completed': '📤 Export Complete',
    'export.failed': '❌ Export Failed',
    'test.webhook': '🧪 Test Webhook Notification'
  };
  return titles[eventType] || '📄 Document Processing Event';
}

function getEventColor(eventType: string): string {
  if (eventType.includes('failed')) return 'Attention';
  if (eventType.includes('completed')) return 'Good';
  if (eventType.includes('low_confidence') || eventType.includes('validation')) return 'Warning';
  return 'Default';
}

function formatEventFacts(eventType: string, data: any): any[] {
  const facts = [];
  
  if (data.batch_name) {
    facts.push({ title: 'Batch', value: data.batch_name });
  }
  if (data.document_name) {
    facts.push({ title: 'Document', value: data.document_name });
  }
  if (data.project_name) {
    facts.push({ title: 'Project', value: data.project_name });
  }
  if (data.documents_processed !== undefined) {
    facts.push({ title: 'Documents Processed', value: data.documents_processed.toString() });
  }
  if (data.confidence_score !== undefined) {
    facts.push({ title: 'Confidence', value: `${Math.round(data.confidence_score * 100)}%` });
  }
  if (data.error_message) {
    facts.push({ title: 'Error', value: data.error_message });
  }
  
  // For document.validated events, show key metadata fields
  if (eventType === 'document.validated' && data.metadata) {
    const importantFields = ['Invoice Number', 'Invoice Date', 'Invoice Total', 'PO Number', 'Vendor Name'];
    importantFields.forEach(field => {
      if (data.metadata[field]) {
        facts.push({ title: field, value: String(data.metadata[field]) });
      }
    });
  }
  
  facts.push({ title: 'Time', value: new Date().toLocaleString() });
  
  return facts;
}

function getEventActions(eventType: string, data: any): any[] {
  const actions = [];
  const siteUrl = Deno.env.get('SITE_URL') || 'https://app.example.com';
  
  if (data.batch_id) {
    actions.push({
      type: 'Action.OpenUrl',
      title: 'View Batch',
      url: `${siteUrl}/batches/${data.batch_id}`
    });
  }
  
  if (data.document_id) {
    actions.push({
      type: 'Action.OpenUrl',
      title: 'View Document',
      url: `${siteUrl}/admin/documents?doc=${data.document_id}`
    });
  }
  
  return actions;
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
