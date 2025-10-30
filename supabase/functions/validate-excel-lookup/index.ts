import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { read, utils } from 'https://esm.sh/xlsx@0.18.5';

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
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { fileUrl, keyColumn, keyValue, lookupFields } = await req.json();

    if (!fileUrl || !keyColumn || !keyValue) {
      throw new Error('Missing required parameters');
    }

    console.log('Excel lookup request:', { keyColumn, keyValue, lookupFields });

    // Fetch the Excel file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch Excel file: ${fileResponse.statusText}`);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    
    // Parse Excel file
    const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const data = utils.sheet_to_json(worksheet);
    
    console.log(`Parsed ${data.length} rows from Excel`);

    // Find matching record
    const matchingRecord = data.find((row: any) => {
      const rowValue = String(row[keyColumn] || '').trim();
      const searchValue = String(keyValue).trim();
      return rowValue === searchValue || rowValue.includes(searchValue) || searchValue.includes(rowValue);
    });

    if (!matchingRecord) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: `No record found for ${keyColumn}: ${keyValue}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found matching record:', matchingRecord);

    // Validate specified fields
    const validationResults: any[] = [];
    
    if (lookupFields && Array.isArray(lookupFields)) {
      for (const field of lookupFields) {
        if (!field.enabled) continue;

        const record = matchingRecord as Record<string, any>;
        const excelValue = String(record[field.ecmField] || '').trim();
        const wisdmValue = String(field.wisdmValue || '').trim();
        
        const matches = excelValue.toLowerCase() === wisdmValue.toLowerCase();
        
        validationResults.push({
          field: field.wisdmField,
          excelValue,
          wisdmValue,
          matches,
          suggestion: matches ? null : excelValue
        });
      }
    }

    const allMatch = validationResults.every(r => r.matches);

    return new Response(
      JSON.stringify({ 
        found: true,
        record: matchingRecord,
        validationResults,
        allMatch,
        message: allMatch ? 'All fields match' : 'Some fields do not match'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in Excel lookup:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
