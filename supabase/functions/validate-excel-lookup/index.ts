import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { read, utils } from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV text into JSON
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
  
  // Parse rows
  const data: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }
  
  return data;
}

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

    console.log('File lookup request:', { fileUrl, keyColumn, keyValue, lookupFields });

    // Fetch the file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }

    let data: any[];
    
    // Determine file type and parse accordingly
    if (fileUrl.toLowerCase().endsWith('.csv')) {
      // Parse CSV
      const csvText = await fileResponse.text();
      data = parseCSV(csvText);
      console.log(`Parsed ${data.length} rows from CSV`);
    } else {
      // Parse Excel
      const arrayBuffer = await fileResponse.arrayBuffer();
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      data = utils.sheet_to_json(worksheet);
      console.log(`Parsed ${data.length} rows from Excel`);
    }

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
    console.error('Error in file lookup:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
