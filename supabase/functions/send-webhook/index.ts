import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { safeDecrypt } from '../_shared/encryption.ts';
import { verifyAuth, handleCors, corsHeaders } from '../_shared/auth-helpers.ts';

interface WebhookPayload {
  customer_id: string;
  event_type: string;
  payload: any;
}

interface WebhookConfig {
  id: string;
  url: string;
  secret?: string;
  secret_encrypted?: string;
  headers?: Record<string, string>;
  webhook_type?: string;
  retry_config?: {
    max_retries: number;
    retry_delay_seconds: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request payload with validation
    let customer_id: string, event_type: string, payload: any;
    try {
      const body = await req.json();
      customer_id = body.customer_id;
      event_type = body.event_type;
      payload = body.payload;
      
      if (!customer_id || !event_type) {
        throw new Error('Missing required fields: customer_id, event_type');
      }
    } catch (parseError: any) {
      console.error('Request parsing error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for webhook operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Webhook] Missing Supabase configuration');
      throw new Error('Service configuration error');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Verify caller authorization
    // All webhook triggers must be authenticated - either via JWT or service secret
    const authHeader = req.headers.get('authorization');
    const serviceSecret = req.headers.get('x-service-secret');
    const expectedServiceSecret = Deno.env.get('WEBHOOK_SERVICE_SECRET');
    
    // Check for internal service-to-service calls using shared secret
    const isValidServiceCall = serviceSecret && expectedServiceSecret && serviceSecret === expectedServiceSecret;
    
    if (isValidServiceCall) {
      console.log('[Webhook] Valid service-to-service call via shared secret');
    } else if (authHeader) {
      // Verify the user has access to this customer
      const authResult = await verifyAuth(req);
      
      if (authResult instanceof Response) {
        return authResult;
      }
      
      const { user, isAdmin, isSystemAdmin } = authResult;
      
      // System admins can trigger webhooks for any customer
      if (!isSystemAdmin) {
        // Check if user belongs to this customer
        const { data: userCustomer, error: customerError } = await supabase
          .from('user_customers')
          .select('customer_id')
          .eq('user_id', user.id)
          .eq('customer_id', customer_id)
          .single();
        
        if (customerError || !userCustomer) {
          // Check if user is tenant admin for this customer
          const { data: isAdminForCustomer } = await supabase
            .rpc('is_tenant_admin', { _user_id: user.id, _customer_id: customer_id });
          
          if (!isAdminForCustomer) {
            console.error(`[Webhook] Unauthorized: User ${user.id} cannot trigger webhooks for customer ${customer_id}`);
            return new Response(
              JSON.stringify({ success: false, error: 'Unauthorized: You do not have access to this customer' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
      
      console.log(`[Webhook] Authorized user ${user.id} triggering webhook for customer ${customer_id}`);
    } else {
      // No authentication provided - reject the request
      console.error('[Webhook] Request without authentication - rejected');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Webhook] Processing event: ${event_type} for customer: ${customer_id}`);

    // Get all active webhooks for this customer that subscribe to this event
    let webhooks;
    try {
      const { data, error: fetchError } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('customer_id', customer_id)
        .eq('is_active', true);

      if (fetchError) {
        console.error('[Webhook] Database query error:', fetchError);
        throw new Error(`Failed to fetch webhook configs: ${fetchError.message}`);
      }
      
      webhooks = data;
    } catch (dbError: any) {
      console.error('[Webhook] Database error:', dbError);
      throw dbError;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('[Webhook] No active webhooks found for customer');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send webhook to each matching endpoint
    for (const webhook of webhooks) {
      try {
        const events = webhook.events as string[];
        
        // Allow test webhooks to always be sent, or check if webhook subscribes to this event type
        if (event_type !== 'test.webhook' && !events.includes(event_type) && !events.includes('*')) {
          console.log(`[Webhook] Skipping ${webhook.url} - not subscribed to ${event_type}`);
          continue;
        }

        console.log(`[Webhook] Sending webhook...`);
        await sendWebhook(supabase, webhook as WebhookConfig, event_type, payload);
        sentCount++;

        // Update last triggered timestamp
        try {
          await supabase
            .from('webhook_configs')
            .update({ last_triggered_at: new Date().toISOString() })
            .eq('id', webhook.id);
        } catch (updateError: any) {
          console.error(`[Webhook] Failed to update timestamp for ${webhook.id}:`, updateError);
        }
      } catch (webhookError: any) {
        console.error(`[Webhook] Failed to send to ${webhook.url}:`, webhookError);
        failedCount++;
      }
    }

    console.log(`[Webhook] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        failed: failedCount,
        total: sentCount + failedCount
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[Webhook] Critical error:', error);
    console.error('[Webhook] Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Unknown error',
        type: error?.name || 'Error'
      }),
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
      const secretToUse = webhook.secret_encrypted 
        ? await safeDecrypt(webhook.secret_encrypted)
        : webhook.secret;
        
      if (secretToUse && webhook.webhook_type !== 'teams') {
        const signature = await generateSignature(secretToUse, payload);
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
        console.log(`Webhook delivered successfully`);
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
  // Power Automate needs simple JSON that can be parsed and used in dynamic content
  const message = {
    title: getEventTitle(event_type),
    event_type: event_type,
    timestamp: new Date().toISOString(),
    batch_name: data.batch_name || '',
    document_name: data.document_name || '',
    project_name: data.project_name || '',
    documents_processed: data.documents_processed || 0,
    confidence_score: data.confidence_score ? Math.round(data.confidence_score * 100) : null,
    error_message: data.error_message || '',
    batch_id: data.batch_id || '',
    document_id: data.document_id || '',
    metadata: data.metadata || {}
  };

  return message;
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
