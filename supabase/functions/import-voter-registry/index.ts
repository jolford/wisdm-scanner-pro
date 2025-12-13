import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV text into JSON
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  // Parse header - handle quoted headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
  
  // Parse rows
  const data: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing (handles basic quoted values)
    const values: string[] = [];
    let inQuote = false;
    let currentValue = '';
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentValue.trim().replace(/^"(.*)"$/, '$1'));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^"(.*)"$/, '$1'));
    
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { 
      fileUrl, 
      customerId, 
      projectId,
      columnMapping,
      replaceExisting = true 
    } = await req.json();

    if (!fileUrl || !customerId) {
      throw new Error('Missing required parameters: fileUrl and customerId');
    }

    console.log('Importing voter registry:', { customerId, projectId, replaceExisting });

    // Fetch the CSV file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }

    const csvText = await fileResponse.text();
    const data = parseCSV(csvText);
    console.log(`Parsed ${data.length} rows from CSV`);

    if (data.length === 0) {
      throw new Error('No data found in CSV file');
    }

    // Default column mapping - tries common column names
    const mapping = columnMapping || {
      name: ['Name', 'name', 'Printed_Name', 'printed_name', 'Full_Name', 'full_name', 'VoterName', 'voter_name'],
      firstName: ['FirstName', 'First_Name', 'first_name', 'First'],
      lastName: ['LastName', 'Last_Name', 'last_name', 'Last'],
      address: ['Address', 'address', 'Street_Address', 'street_address', 'ResAddress', 'res_address', 'StreetAddress'],
      city: ['City', 'city', 'ResCity', 'res_city'],
      zip: ['Zip', 'zip', 'ZipCode', 'zipcode', 'Zip_Code', 'zip_code', 'ResZip', 'res_zip'],
      county: ['County', 'county'],
      state: ['State', 'state'],
      voterId: ['VoterID', 'voter_id', 'ID', 'id'],
      party: ['Party', 'party', 'PartyAffiliation', 'party_affiliation'],
      precinct: ['Precinct', 'precinct']
    };

    // Find which columns exist in the data
    const sampleRow = data[0];
    const findColumn = (possibleNames: string[]): string | null => {
      for (const name of possibleNames) {
        if (sampleRow.hasOwnProperty(name)) {
          return name;
        }
      }
      return null;
    };

    const nameColumn = findColumn(mapping.name);
    const firstNameColumn = findColumn(mapping.firstName);
    const lastNameColumn = findColumn(mapping.lastName);
    const addressColumn = findColumn(mapping.address);
    const cityColumn = findColumn(mapping.city);
    const zipColumn = findColumn(mapping.zip);
    const countyColumn = findColumn(mapping.county);
    const stateColumn = findColumn(mapping.state);
    const voterIdColumn = findColumn(mapping.voterId);
    const partyColumn = findColumn(mapping.party);
    const precinctColumn = findColumn(mapping.precinct);

    // Support either combined Name OR FirstName+LastName
    const hasNameColumn = nameColumn !== null;
    const hasFirstLastColumns = firstNameColumn !== null && lastNameColumn !== null;
    
    if (!hasNameColumn && !hasFirstLastColumns) {
      throw new Error(`Could not find name column(s). Need either 'Name' or 'FirstName'+'LastName'. Available: ${Object.keys(sampleRow).join(', ')}`);
    }

    console.log('Column mapping:', { nameColumn, firstNameColumn, lastNameColumn, addressColumn, cityColumn, zipColumn });

    console.log('Column mapping:', { nameColumn, addressColumn, cityColumn, zipColumn });

    // Delete existing records if replacing
    if (replaceExisting) {
      const deleteQuery = projectId 
        ? { customer_id: customerId, project_id: projectId }
        : { customer_id: customerId };
      
      const { error: deleteError } = await supabase
        .from('voter_registry')
        .delete()
        .match(deleteQuery);
      
      if (deleteError) {
        console.error('Error deleting existing records:', deleteError);
      } else {
        console.log('Deleted existing voter registry records');
      }
    }

    // Prepare records for insert (batch in chunks of 1000)
    const BATCH_SIZE = 1000;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      const records = batch.map((row: any) => {
        // Build name from either combined column or FirstName+LastName
        let name = '';
        if (nameColumn) {
          name = String(row[nameColumn] || '').trim();
        } else if (firstNameColumn && lastNameColumn) {
          const firstName = String(row[firstNameColumn] || '').trim();
          const lastName = String(row[lastNameColumn] || '').trim();
          name = `${firstName} ${lastName}`.trim();
        }
        
        return {
          customer_id: customerId,
          project_id: projectId || null,
          name: name,
          name_normalized: name.toLowerCase().replace(/\s+/g, ' ').trim(),
          address: addressColumn ? String(row[addressColumn] || '').trim() : null,
          city: cityColumn ? String(row[cityColumn] || '').trim() : null,
          zip: zipColumn ? String(row[zipColumn] || '').trim() : null,
          county: countyColumn ? String(row[countyColumn] || '').trim() : null,
          state: stateColumn ? String(row[stateColumn] || '').trim() : null,
          voter_id: voterIdColumn ? String(row[voterIdColumn] || '').trim() : null,
          party_affiliation: partyColumn ? String(row[partyColumn] || '').trim() : null,
          precinct: precinctColumn ? String(row[precinctColumn] || '').trim() : null,
          source_file: fileUrl.split('/').pop() || 'unknown',
          raw_data: row
        };
      }).filter((r: any) => r.name && r.name.length > 0);

      const { error: insertError } = await supabase
        .from('voter_registry')
        .insert(records);

      if (insertError) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError);
        errorCount += batch.length;
      } else {
        insertedCount += records.length;
        console.log(`Inserted batch ${i / BATCH_SIZE + 1}: ${records.length} records`);
      }
    }

    console.log(`Import complete: ${insertedCount} inserted, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        totalRows: data.length,
        insertedCount,
        errorCount,
        columnsFound: {
          name: nameColumn,
          address: addressColumn,
          city: cityColumn,
          zip: zipColumn
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error importing voter registry:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});