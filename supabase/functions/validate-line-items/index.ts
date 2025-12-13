import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { read, utils } from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV text into JSON with better handling for quoted fields
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  const parseRow = (line: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"(.*)"$/, '$1'));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"(.*)"$/, '$1'));
    return values;
  };
  
  const headers = parseRow(lines[0]);
  const data: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length >= headers.length - 1) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}

// Normalize string for comparison
function normalize(value: string): string {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Calculate similarity score between two strings
function similarity(str1: string, str2: string): number {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  const overlapScore = commonWords.length / Math.max(words1.length, words2.length);
  
  return overlapScore;
}

// Authenticate signature against reference using AI vision
async function authenticateSignature(
  signatureImageUrl: string,
  referenceImageUrl: string,
  supabaseAdmin: any
): Promise<{ similarityScore: number; status: string; analysis: string }> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('No AI API key configured for signature authentication');
      return { similarityScore: 0, status: 'no_api_key', analysis: 'AI service not configured' };
    }

    // Get signed URLs for both images
    const getSignedUrl = async (url: string) => {
      if (url.includes('supabase.co/storage')) {
        const urlParts = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
        if (urlParts) {
          const { data } = await supabaseAdmin.storage.from(urlParts[1]).createSignedUrl(urlParts[2], 300);
          return data?.signedUrl || url;
        }
      }
      return url;
    };

    const signedSignatureUrl = await getSignedUrl(signatureImageUrl);
    const signedReferenceUrl = await getSignedUrl(referenceImageUrl);

    // Convert images to base64 for AI API
    const toBase64 = async (url: string) => {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const contentType = response.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${base64}`;
    };

    const [sigBase64, refBase64] = await Promise.all([
      toBase64(signedSignatureUrl),
      toBase64(signedReferenceUrl)
    ]);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a signature authentication expert. Compare two signatures and determine similarity.
Return ONLY a JSON object:
{
  "similarityScore": 0.0-1.0,
  "match": true/false,
  "confidence": 0.0-1.0,
  "analysis": "brief explanation",
  "recommendation": "accept|review|reject"
}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Compare these two signatures. First is from petition, second is reference. Analyze stroke patterns, slant, and overall similarity.' },
              { type: 'image_url', image_url: { url: sigBase64 } },
              { type: 'image_url', image_url: { url: refBase64 } }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Signature auth AI error:', response.status);
      return { similarityScore: 0, status: 'ai_error', analysis: 'AI service unavailable' };
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const score = result.similarityScore || 0;
      let status = 'no_reference';
      
      if (score >= 0.8) status = 'authenticated';
      else if (score >= 0.5) status = 'review_needed';
      else status = 'suspicious';
      
      return {
        similarityScore: score,
        status,
        analysis: result.analysis || ''
      };
    }

    return { similarityScore: 0, status: 'parse_error', analysis: 'Could not parse AI response' };
  } catch (error) {
    console.error('Signature authentication error:', error);
    return { similarityScore: 0, status: 'error', analysis: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId, projectId, lineItems, authenticateSignatures = false } = await req.json();

    if (!documentId || !projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing documentId or projectId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating line items for document ${documentId}, project ${projectId}, auth signatures: ${authenticateSignatures}`);

    // Get project and customer info
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('name, metadata, customer_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.log('Project not found:', projectError);
      return new Response(
        JSON.stringify({ validated: false, reason: 'Project not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build lookup data - prioritize appropriate source based on project type
    let lookupData: any[] = [];
    let lookupSource = 'none';

    const lookupConfig = (project.metadata as any)?.validation_lookup_config;
    const isPetitionProject = (project.name || '').toLowerCase().includes('petition');
    
    // =============================
    // LOOKUP STRATEGY OVERVIEW
    // - Petition projects: prefer indexed voter_registry (fast, scalable), CSV as fallback only
    // - Other projects: use file-based lookup first (legacy behavior), then voter_registry
    // =============================
    
    // PRIORITY A (PETITION): Indexed voter_registry first
    if (isPetitionProject) {
      console.log('Petition project detected - using indexed voter_registry as primary lookup');

      // Project-scoped registry
      const { data: projectRegistry } = await supabaseAdmin
        .from('voter_registry')
        .select('*')
        .eq('project_id', projectId)
        .limit(1);

      if (projectRegistry && projectRegistry.length > 0) {
        lookupSource = 'project_registry';
        console.log('Using project-scoped indexed voter registry for petition project');
        const { data: allVoters } = await supabaseAdmin
          .from('voter_registry')
          .select('*')
          .eq('project_id', projectId);

        lookupData = (allVoters || []).map(v => ({
          Name: v.name,
          name_normalized: v.name_normalized,
          Address: v.address,
          City: v.city,
          Zip: v.zip,
          signature_reference_url: v.signature_reference_url
        }));
        console.log(`Loaded ${lookupData.length} voters from project registry`);
      } else if (project.customer_id) {
        // Customer-scoped registry
        const { data: customerRegistry } = await supabaseAdmin
          .from('voter_registry')
          .select('*')
          .eq('customer_id', project.customer_id)
          .limit(1);

        if (customerRegistry && customerRegistry.length > 0) {
          lookupSource = 'customer_registry';
          console.log('Using customer-scoped indexed voter registry for petition project');
          const { data: allCustomerVoters } = await supabaseAdmin
            .from('voter_registry')
            .select('*')
            .eq('customer_id', project.customer_id);

          lookupData = (allCustomerVoters || []).map(v => ({
            Name: v.name,
            name_normalized: v.name_normalized,
            Address: v.address,
            City: v.city,
            Zip: v.zip,
            signature_reference_url: v.signature_reference_url
          }));
          console.log(`Loaded ${lookupData.length} voters from customer registry`);
        }
      }

      // Global fallback registry (demo/sample data or shared registry)
      if (lookupData.length === 0) {
        const { data: anyRegistry } = await supabaseAdmin
          .from('voter_registry')
          .select('*')
          .limit(1);

        if (anyRegistry && anyRegistry.length > 0) {
          lookupSource = 'global_registry';
          console.log('Using GLOBAL voter_registry as fallback for petition project');
          const { data: allGlobalVoters } = await supabaseAdmin
            .from('voter_registry')
            .select('*');

          lookupData = (allGlobalVoters || []).map(v => ({
            Name: v.name,
            name_normalized: v.name_normalized,
            Address: v.address,
            City: v.city,
            Zip: v.zip,
            signature_reference_url: v.signature_reference_url
          }));
          console.log(`Loaded ${lookupData.length} voters from global registry`);
        }
      }

      // If STILL no data and CSV is configured, fall back to file-based lookup
      if (lookupData.length === 0 && lookupConfig?.enabled && lookupConfig.excelFileUrl) {
        console.log('Petition project: falling back to file-based voter registry from project config');
        lookupSource = 'file_fallback';
        
        // Generate signed URL if needed
        let fileUrl = lookupConfig.excelFileUrl;
        if (fileUrl.includes('supabase.co/storage/v1/object')) {
          const urlParts = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
          if (urlParts) {
            const { data: signedData } = await supabaseAdmin.storage
              .from(urlParts[1])
              .createSignedUrl(urlParts[2], 300);
            if (signedData?.signedUrl) fileUrl = signedData.signedUrl;
          }
        }

        try {
          const fileResponse = await fetch(fileUrl);
          if (fileResponse.ok) {
            const fileExtension = lookupConfig.excelFileUrl.toLowerCase();
            if (fileExtension.endsWith('.csv')) {
              lookupData = parseCSV(await fileResponse.text());
            } else {
              const arrayBuffer = await fileResponse.arrayBuffer();
              const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });
              lookupData = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            console.log(`Loaded ${lookupData.length} records from CSV file (petition fallback)`);
            
            // Normalize CSV data
            if (lookupConfig.lookupFields && lookupData.length > 0) {
              lookupData = lookupData.map(row => {
                const normalized: any = { ...row };

                if (row.FirstName || row.LastName) {
                  const nameParts = [row.FirstName, row.MiddleInitial, row.LastName].filter(Boolean);
                  normalized.Name = nameParts.join(' ').trim();
                }
                if (row.StreetAddress && !row.Address) {
                  normalized.Address = row.StreetAddress;
                }
                if (row.ZipCode && !row.Zip) {
                  normalized.Zip = row.ZipCode;
                }
                return normalized;
              });
            }
          } else {
            console.error('Failed to fetch lookup file for petition project:', fileResponse.status);
          }
        } catch (err) {
          console.error('Error loading file-based lookup for petition project:', err);
        }
      }
    } else {
      // NON-PETITION PROJECTS: existing behavior - file first, then registry
      // PRIORITY 1: Use file-based lookup if configured for this project
      if (lookupConfig?.enabled && lookupConfig.excelFileUrl) {
        console.log('Using file-based voter registry from project config');
        lookupSource = 'file';
        
        let fileUrl = lookupConfig.excelFileUrl;
        if (fileUrl.includes('supabase.co/storage/v1/object')) {
          const urlParts = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
          if (urlParts) {
            const { data: signedData } = await supabaseAdmin.storage
              .from(urlParts[1])
              .createSignedUrl(urlParts[2], 300);
            if (signedData?.signedUrl) fileUrl = signedData.signedUrl;
          }
        }

        try {
          const fileResponse = await fetch(fileUrl);
          if (fileResponse.ok) {
            const fileExtension = lookupConfig.excelFileUrl.toLowerCase();
            if (fileExtension.endsWith('.csv')) {
              lookupData = parseCSV(await fileResponse.text());
            } else {
              const arrayBuffer = await fileResponse.arrayBuffer();
              const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });
              lookupData = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            console.log(`Loaded ${lookupData.length} records from CSV file`);
            
            if (lookupConfig.lookupFields && lookupData.length > 0) {
              lookupData = lookupData.map(row => {
                const normalized: any = { ...row };
                if (row.FirstName || row.LastName) {
                  const nameParts = [row.FirstName, row.MiddleInitial, row.LastName].filter(Boolean);
                  normalized.Name = nameParts.join(' ').trim();
                }
                if (row.StreetAddress && !row.Address) {
                  normalized.Address = row.StreetAddress;
                }
                if (row.ZipCode && !row.Zip) {
                  normalized.Zip = row.ZipCode;
                }
                return normalized;
              });
            }
          } else {
            console.error('Failed to fetch lookup file:', fileResponse.status);
          }
        } catch (err) {
          console.error('Error loading file-based lookup:', err);
        }
      }

      // PRIORITY 2: Fall back to indexed voter_registry if no file data
      if (lookupData.length === 0) {
        const { data: projectRegistry } = await supabaseAdmin
          .from('voter_registry')
          .select('*')
          .eq('project_id', projectId)
          .limit(1);

        if (projectRegistry && projectRegistry.length > 0) {
          lookupSource = 'project_registry';
          console.log('Using project-scoped indexed voter registry');
          const { data: allVoters } = await supabaseAdmin
            .from('voter_registry')
            .select('*')
            .eq('project_id', projectId);

          lookupData = (allVoters || []).map(v => ({
            Name: v.name,
            name_normalized: v.name_normalized,
            Address: v.address,
            City: v.city,
            Zip: v.zip,
            signature_reference_url: v.signature_reference_url
          }));
          console.log(`Loaded ${lookupData.length} voters from project registry`);
        } else if (project.customer_id) {
          const { data: customerRegistry } = await supabaseAdmin
            .from('voter_registry')
            .select('*')
            .eq('customer_id', project.customer_id)
            .limit(1);

          if (customerRegistry && customerRegistry.length > 0) {
            lookupSource = 'customer_registry';
            console.log('Using customer-scoped indexed voter registry');
            const { data: allCustomerVoters } = await supabaseAdmin
              .from('voter_registry')
              .select('*')
              .eq('customer_id', project.customer_id);

            lookupData = (allCustomerVoters || []).map(v => ({
              Name: v.name,
              name_normalized: v.name_normalized,
              Address: v.address,
              City: v.city,
              Zip: v.zip,
              signature_reference_url: v.signature_reference_url
            }));
            console.log(`Loaded ${lookupData.length} voters from customer registry`);
          }
        }
      }
    }

    // FINAL FALLBACK: If still no data anywhere, return error
    if (lookupData.length === 0) {
      console.log('No lookup data available for project');
      return new Response(
        JSON.stringify({ validated: false, reason: 'No voter registry configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Using ${lookupSource} voter registry with ${lookupData.length} records`);

    console.log(`Loaded ${lookupData.length} records from lookup source`);

    // Get line items from document if not provided
    let itemsToValidate = lineItems;
    if (!itemsToValidate) {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('line_items')
        .eq('id', documentId)
        .single();
      itemsToValidate = doc?.line_items || [];
    }

    if (!itemsToValidate || itemsToValidate.length === 0) {
      return new Response(
        JSON.stringify({ validated: false, reason: 'No line items found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating ${itemsToValidate.length} line items`);

    // Validation results
    const validationResults: any[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let partialMatchCount = 0;
    let authenticatedCount = 0;
    let suspiciousCount = 0;

    for (let i = 0; i < itemsToValidate.length; i++) {
      const lineItem = itemsToValidate[i];
      const itemResult: any = {
        lineIndex: i,
        lineItem,
        found: false,
        partialMatch: false,
        matchScore: 0,
        fieldResults: [],
        bestMatch: null,
        mismatchReason: null,
        signatureAuthentication: null
      };

      // Find best matching voter
      let bestMatch: any = null;
      let bestScore = 0;
      let bestNameScore = 0;
      let bestAddressScore = 0;

      const itemName = lineItem.Printed_Name || lineItem.printed_name || lineItem.Name || '';
      const itemAddress = lineItem.Address || lineItem.address || '';
      const itemCity = lineItem.City || lineItem.city || '';
      const itemZip = lineItem.Zip || lineItem.zip || '';

      for (const voter of lookupData) {
        const voterName = voter.Name || voter.name || '';
        const nameScore = similarity(itemName, voterName);
        
        if (nameScore >= 0.7) {
          const addressScore = similarity(itemAddress, voter.Address || voter.address || '');
          const cityScore = similarity(itemCity, voter.City || voter.city || '');
          const zipScore = similarity(itemZip, voter.Zip || voter.zip || '');
          const avgAddressScore = (addressScore + cityScore + zipScore) / 3;
          
          if (nameScore > bestNameScore || (nameScore === bestNameScore && avgAddressScore > bestAddressScore)) {
            bestNameScore = nameScore;
            bestAddressScore = avgAddressScore;
            bestScore = (nameScore + avgAddressScore) / 2;
            bestMatch = voter;
          }
        }
      }

      // Evaluate match quality
      if (bestMatch) {
        if (bestNameScore >= 0.7 && bestAddressScore >= 0.7) {
          itemResult.found = true;
          itemResult.matchScore = bestScore;
          itemResult.bestMatch = bestMatch;
          validCount++;
        } else if (bestNameScore >= (isPetitionProject ? 0.6 : 0.7)) {
          // Name is a reasonably good match, but address and/or other fields differ
          itemResult.partialMatch = true;
          itemResult.matchScore = bestNameScore;
          itemResult.bestMatch = bestMatch;
          itemResult.mismatchReason = bestAddressScore >= 0.4 ? 'address_mismatch' : 'name_mismatch';
          partialMatchCount++;
          invalidCount++;
        } else {
          invalidCount++;
        }

        // Signature authentication if enabled and reference exists
        if (authenticateSignatures && bestMatch.signature_reference_url) {
          const signatureImageUrl = lineItem.signature_image_url;
          if (signatureImageUrl) {
            console.log(`Authenticating signature for line ${i}`);
            const authResult = await authenticateSignature(
              signatureImageUrl,
              bestMatch.signature_reference_url,
              supabaseAdmin
            );
            itemResult.signatureAuthentication = authResult;
            
            if (authResult.status === 'authenticated') authenticatedCount++;
            else if (authResult.status === 'suspicious') suspiciousCount++;
          } else {
            itemResult.signatureAuthentication = {
              similarityScore: 0,
              status: 'no_signature_image',
              analysis: 'No signature image captured from petition'
            };
          }
        } else if (authenticateSignatures && !bestMatch.signature_reference_url) {
          itemResult.signatureAuthentication = {
            similarityScore: 0,
            status: 'no_reference',
            analysis: 'No reference signature on file for this voter'
          };
        }

        // Field results
        itemResult.fieldResults = [
          { field: 'Name', extractedValue: itemName, lookupValue: bestMatch.Name || bestMatch.name, matches: bestNameScore >= 0.9, score: bestNameScore },
          { field: 'Address', extractedValue: itemAddress, lookupValue: bestMatch.Address || bestMatch.address, matches: similarity(itemAddress, bestMatch.Address || '') >= 0.9, score: similarity(itemAddress, bestMatch.Address || '') },
          { field: 'City', extractedValue: itemCity, lookupValue: bestMatch.City || bestMatch.city, matches: similarity(itemCity, bestMatch.City || '') >= 0.9, score: similarity(itemCity, bestMatch.City || '') },
          { field: 'Zip', extractedValue: itemZip, lookupValue: bestMatch.Zip || bestMatch.zip, matches: similarity(itemZip, bestMatch.Zip || '') >= 0.9, score: similarity(itemZip, bestMatch.Zip || '') }
        ];
      } else {
        invalidCount++;
      }

      // Signature presence status
      const signaturePresent = lineItem.Signature_Present || lineItem.signature_present || '';
      itemResult.signatureStatus = {
        present: signaturePresent.toLowerCase() === 'yes' || signaturePresent === true,
        value: signaturePresent
      };

      validationResults.push(itemResult);
    }

    console.log(`Validation complete: ${validCount} valid, ${partialMatchCount} partial, ${invalidCount} invalid`);
    if (authenticateSignatures) {
      console.log(`Signature auth: ${authenticatedCount} authenticated, ${suspiciousCount} suspicious`);
    }

    // Store results
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        validation_suggestions: {
          lookupValidation: {
            validated: true,
            validatedAt: new Date().toISOString(),
            totalItems: itemsToValidate.length,
            validCount,
            invalidCount,
            partialMatchCount,
            authenticatedCount,
            suspiciousCount,
            results: validationResults
          }
        },
        needs_review: invalidCount > 0 || suspiciousCount > 0
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to save validation results:', updateError);
    }

    return new Response(
      JSON.stringify({
        validated: true,
        totalItems: itemsToValidate.length,
        validCount,
        invalidCount,
        partialMatchCount,
        authenticatedCount,
        suspiciousCount,
        results: validationResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in line item validation:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});