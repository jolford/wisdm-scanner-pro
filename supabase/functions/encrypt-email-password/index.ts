import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth, handleCors, corsHeaders } from '../_shared/auth-helpers.ts';

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');

async function encrypt(text: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;
    const { config_id, password, project_id, customer_id, ...otherConfig } = await req.json();

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encrypt the password
    const encryptedPassword = await encrypt(password);
    console.log('[EncryptEmail] Password encrypted successfully');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare config data with encrypted password
    const configData = {
      ...otherConfig,
      project_id,
      customer_id,
      email_password: '[ENCRYPTED]', // Store placeholder in plaintext field
      email_password_encrypted: encryptedPassword,
      encryption_version: 1,
      created_by: user.id,
    };

    let result;
    if (config_id) {
      // Update existing config
      const { data, error } = await supabase
        .from('email_import_configs')
        .update(configData)
        .eq('id', config_id)
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log(`[EncryptEmail] Updated config ${config_id}`);
    } else {
      // Create new config
      const { data, error } = await supabase
        .from('email_import_configs')
        .insert(configData)
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log(`[EncryptEmail] Created new config ${result.id}`);
    }

    return new Response(
      JSON.stringify({ success: true, config_id: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[EncryptEmail] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
