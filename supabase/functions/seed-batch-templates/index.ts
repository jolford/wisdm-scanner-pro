import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's customer
    const { data: userCustomers } = await supabaseClient
      .from('user_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!userCustomers) {
      return new Response(
        JSON.stringify({ error: 'No customer found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerId = userCustomers.customer_id;

    // Predefined templates
    const templates = [
      {
        name: 'Invoice Processing',
        description: 'Standard invoice processing workflow with vendor, date, amount, and line item extraction',
        customer_id: customerId,
        created_by: user.id,
        is_active: true,
        extraction_config: {
          vendor_name: { type: 'text', required: true, confidence_threshold: 70 },
          invoice_number: { type: 'text', required: true, confidence_threshold: 80 },
          invoice_date: { type: 'date', required: true, confidence_threshold: 75 },
          total_amount: { type: 'currency', required: true, confidence_threshold: 85 },
          line_items: { type: 'table', required: false, confidence_threshold: 60 }
        },
        validation_rules: {
          total_amount: { min: 0, max: 1000000 },
          invoice_date: { max_age_days: 365 }
        },
        export_settings: {
          format: 'json',
          include_metadata: true,
          export_line_items: true
        }
      },
      {
        name: 'Mortgage Application',
        description: 'Mortgage loan application processing with borrower info, property details, and income verification',
        customer_id: customerId,
        created_by: user.id,
        is_active: true,
        extraction_config: {
          borrower_name: { type: 'text', required: true, confidence_threshold: 85 },
          ssn: { type: 'ssn', required: true, confidence_threshold: 95 },
          property_address: { type: 'address', required: true, confidence_threshold: 80 },
          loan_amount: { type: 'currency', required: true, confidence_threshold: 90 },
          annual_income: { type: 'currency', required: true, confidence_threshold: 85 },
          employment_status: { type: 'text', required: true, confidence_threshold: 75 }
        },
        validation_rules: {
          ssn: { format: 'XXX-XX-XXXX' },
          loan_amount: { min: 50000, max: 10000000 },
          annual_income: { min: 0 }
        },
        export_settings: {
          format: 'json',
          include_metadata: true,
          redact_pii: true
        }
      },
      {
        name: 'Receipt Processing',
        description: 'Quick receipt processing for expense tracking with merchant, date, and total extraction',
        customer_id: customerId,
        created_by: user.id,
        is_active: true,
        extraction_config: {
          merchant_name: { type: 'text', required: true, confidence_threshold: 70 },
          receipt_date: { type: 'date', required: true, confidence_threshold: 75 },
          total_amount: { type: 'currency', required: true, confidence_threshold: 80 },
          payment_method: { type: 'text', required: false, confidence_threshold: 60 }
        },
        validation_rules: {
          total_amount: { min: 0, max: 10000 },
          receipt_date: { max_age_days: 90 }
        },
        export_settings: {
          format: 'csv',
          include_metadata: false
        }
      },
      {
        name: 'Purchase Order',
        description: 'Purchase order processing with vendor, items, quantities, and pricing details',
        customer_id: customerId,
        created_by: user.id,
        is_active: true,
        extraction_config: {
          vendor_name: { type: 'text', required: true, confidence_threshold: 75 },
          po_number: { type: 'text', required: true, confidence_threshold: 85 },
          po_date: { type: 'date', required: true, confidence_threshold: 75 },
          ship_to_address: { type: 'address', required: true, confidence_threshold: 70 },
          total_amount: { type: 'currency', required: true, confidence_threshold: 85 },
          line_items: { type: 'table', required: true, confidence_threshold: 65 }
        },
        validation_rules: {
          total_amount: { min: 0 },
          po_number: { format: '^PO-\\d+$' }
        },
        export_settings: {
          format: 'json',
          include_metadata: true,
          export_line_items: true
        }
      },
      {
        name: 'Tax Form W-2',
        description: 'W-2 wage and tax statement processing with employer and employee information',
        customer_id: customerId,
        created_by: user.id,
        is_active: true,
        extraction_config: {
          employee_name: { type: 'text', required: true, confidence_threshold: 85 },
          employee_ssn: { type: 'ssn', required: true, confidence_threshold: 95 },
          employer_name: { type: 'text', required: true, confidence_threshold: 80 },
          employer_ein: { type: 'text', required: true, confidence_threshold: 90 },
          wages: { type: 'currency', required: true, confidence_threshold: 90 },
          federal_tax_withheld: { type: 'currency', required: true, confidence_threshold: 90 },
          tax_year: { type: 'number', required: true, confidence_threshold: 95 }
        },
        validation_rules: {
          employee_ssn: { format: 'XXX-XX-XXXX' },
          employer_ein: { format: 'XX-XXXXXXX' },
          wages: { min: 0 },
          tax_year: { min: 2020, max: 2030 }
        },
        export_settings: {
          format: 'json',
          include_metadata: true,
          redact_pii: true
        }
      }
    ];

    // Check if templates already exist
    const { data: existing } = await supabaseClient
      .from('batch_templates')
      .select('name')
      .eq('customer_id', customerId)
      .in('name', templates.map(t => t.name));

    const existingNames = new Set(existing?.map(t => t.name) || []);
    const templatesToInsert = templates.filter(t => !existingNames.has(t.name));

    if (templatesToInsert.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All templates already exist', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabaseClient
      .from('batch_templates')
      .insert(templatesToInsert)
      .select();

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        message: `Created ${data.length} batch templates`,
        templates: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Seed templates error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});