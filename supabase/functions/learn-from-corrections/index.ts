import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, projectId, corrections } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    console.log('Learning from corrections for document:', documentId);

    // Get document details
    const { data: document } = await supabaseClient
      .from('documents')
      .select('document_type, batch_id')
      .eq('id', documentId)
      .single();

    if (!document) {
      throw new Error('Document not found');
    }

    // Store learning data for each correction
    const learningRecords = [];
    for (const correction of corrections) {
      // Get original confidence score
      const { data: confidenceData } = await supabaseClient
        .from('extraction_confidence')
        .select('confidence_score')
        .eq('document_id', documentId)
        .eq('field_name', correction.field_name)
        .order('created_at', { ascending: false })
        .limit(1);

      const confidenceScore = confidenceData?.[0]?.confidence_score || 0.5;

      // Check if this correction pattern exists
      const { data: existing } = await supabaseClient
        .from('field_learning_data')
        .select('id, correction_count')
        .eq('project_id', projectId)
        .eq('field_name', correction.field_name)
        .eq('original_value', correction.original_value)
        .eq('corrected_value', correction.corrected_value)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing learning record
        await supabaseClient
          .from('field_learning_data')
          .update({
            correction_count: existing[0].correction_count + 1,
            confidence_score: confidenceScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
      } else {
        // Create new learning record
        learningRecords.push({
          project_id: projectId,
          field_name: correction.field_name,
          original_value: correction.original_value,
          corrected_value: correction.corrected_value,
          confidence_score: confidenceScore,
          document_type: document.document_type || 'other',
          correction_count: 1,
        });
      }
    }

    if (learningRecords.length > 0) {
      await supabaseClient.from('field_learning_data').insert(learningRecords);
    }

    // Update or create ML template with learned corrections
    const { data: template } = await supabaseClient
      .from('ml_document_templates')
      .select('*')
      .eq('project_id', projectId)
      .eq('document_type', document.document_type || 'other')
      .eq('is_active', true)
      .limit(1);

    if (template && template.length > 0) {
      // Update existing template
      const currentPatterns = template[0].field_patterns as any;
      
      for (const correction of corrections) {
        if (!currentPatterns[correction.field_name]) {
          currentPatterns[correction.field_name] = {
            type: 'text',
            corrections: {},
            commonValues: [],
          };
        }
        
        // Add correction mapping
        if (!currentPatterns[correction.field_name].corrections) {
          currentPatterns[correction.field_name].corrections = {};
        }
        currentPatterns[correction.field_name].corrections[correction.original_value] = correction.corrected_value;
      }

      await supabaseClient
        .from('ml_document_templates')
        .update({
          field_patterns: currentPatterns,
          training_data_count: template[0].training_data_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template[0].id);

      console.log('Updated ML template with learned corrections');
    } else {
      // Create new template
      const fieldPatterns: any = {};
      for (const correction of corrections) {
        fieldPatterns[correction.field_name] = {
          type: 'text',
          corrections: {
            [correction.original_value]: correction.corrected_value,
          },
          commonValues: [correction.corrected_value],
        };
      }

      await supabaseClient.from('ml_document_templates').insert({
        project_id: projectId,
        template_name: `Learned from ${document.document_type || 'documents'}`,
        document_type: document.document_type || 'other',
        field_patterns: fieldPatterns,
        training_data_count: 1,
        is_active: true,
      });

      console.log('Created new ML template from corrections');
    }

    return new Response(JSON.stringify({
      success: true,
      corrections_learned: corrections.length,
      template_updated: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Learning error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
