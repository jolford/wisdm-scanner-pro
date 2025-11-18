import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encrypt } from '../_shared/encryption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is system admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'system_admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Only system administrators can migrate credentials' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting credential migration...');

    // Migrate email import configs
    const { data: emailConfigs, error: emailError } = await supabase
      .from('email_import_configs')
      .select('id, email_password')
      .is('email_password_encrypted', null);

    if (emailError) {
      console.error('Error fetching email configs:', emailError);
    } else if (emailConfigs && emailConfigs.length > 0) {
      console.log(`Migrating ${emailConfigs.length} email configs...`);
      
      for (const config of emailConfigs) {
        const encrypted = await encrypt(config.email_password);
        await supabase
          .from('email_import_configs')
          .update({ 
            email_password_encrypted: encrypted,
            encryption_version: 1 
          })
          .eq('id', config.id);
      }
      
      console.log(`Encrypted ${emailConfigs.length} email passwords`);
    }

    // Migrate webhook configs
    const { data: webhookConfigs, error: webhookError } = await supabase
      .from('webhook_configs')
      .select('id, secret')
      .is('secret_encrypted', null)
      .not('secret', 'is', null);

    if (webhookError) {
      console.error('Error fetching webhook configs:', webhookError);
    } else if (webhookConfigs && webhookConfigs.length > 0) {
      console.log(`Migrating ${webhookConfigs.length} webhook configs...`);
      
      for (const config of webhookConfigs) {
        const encrypted = await encrypt(config.secret);
        await supabase
          .from('webhook_configs')
          .update({ 
            secret_encrypted: encrypted,
            encryption_version: 1 
          })
          .eq('id', config.id);
      }
      
      console.log(`Encrypted ${webhookConfigs.length} webhook secrets`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credential migration completed',
        migrated: {
          email_configs: emailConfigs?.length || 0,
          webhook_configs: webhookConfigs?.length || 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Credential migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
