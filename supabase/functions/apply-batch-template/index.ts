import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Unauthorized');

    const { templateId, projectId, batchName } = await req.json();

    console.log(`Applying template ${templateId} to create batch in project ${projectId}`);

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('batch_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;
    if (!template) throw new Error('Template not found');

    console.log(`Found template: ${template.name}`);

    // Create batch with template config
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        project_id: projectId || template.project_id,
        batch_name: batchName || `${template.name} - ${new Date().toLocaleDateString()}`,
        customer_id: template.customer_id,
        created_by: user.id,
        status: 'new',
        metadata: {
          template_id: template.id,
          template_name: template.name,
          extraction_config: template.extraction_config,
          validation_rules: template.validation_rules,
          export_settings: template.export_settings
        }
      })
      .select()
      .single();

    if (batchError) throw batchError;

    console.log(`Created batch ${batch.id} from template`);

    return new Response(
      JSON.stringify({
        success: true,
        batch,
        template
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apply-batch-template:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});