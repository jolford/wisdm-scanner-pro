import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  // Simple Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  // Check if one contains the other
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return shorter.length / longer.length;
  }
  
  // Word-based comparison
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matchingWords = 0;
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || (w1.length > 2 && w2.startsWith(w1)) || (w2.length > 2 && w1.startsWith(w2))) {
        matchingWords++;
        break;
      }
    }
  }
  
  return matchingWords / Math.max(words1.length, words2.length);
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
      customerId,
      projectId,
      signatures // Array of { name, address, city, zip }
    } = await req.json();

    if (!customerId || !signatures || !Array.isArray(signatures)) {
      throw new Error('Missing required parameters: customerId and signatures array');
    }

    console.log(`Validating ${signatures.length} signatures against voter registry`);
    const startTime = Date.now();

    const results = [];

    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];
      const searchName = String(sig.name || '').toLowerCase().trim();
      
      if (!searchName) {
        results.push({
          index: i,
          found: false,
          partialMatch: false,
          matchScore: 0,
          message: 'Empty name'
        });
        continue;
      }

      // Query the voter registry with fuzzy matching
      // First try exact normalized match
      let { data: exactMatch, error } = await supabase
        .from('voter_registry')
        .select('*')
        .eq('customer_id', customerId)
        .eq('name_normalized', searchName)
        .limit(1);

      if (error) {
        console.error('Database query error:', error);
        results.push({
          index: i,
          found: false,
          error: error.message
        });
        continue;
      }

      let bestMatch = exactMatch?.[0];
      let matchScore = bestMatch ? 1.0 : 0;
      let isPartialMatch = false;

      // If no exact match, try fuzzy search using trigram similarity
      if (!bestMatch) {
        const { data: fuzzyMatches } = await supabase
          .from('voter_registry')
          .select('*')
          .eq('customer_id', customerId)
          .ilike('name_normalized', `%${searchName.split(' ')[0]}%`)
          .limit(10);

        if (fuzzyMatches && fuzzyMatches.length > 0) {
          // Find best fuzzy match
          let bestScore = 0;
          for (const match of fuzzyMatches) {
            const score = calculateSimilarity(searchName, match.name_normalized);
            if (score > bestScore && score >= 0.7) {
              bestScore = score;
              bestMatch = match;
              matchScore = score;
            }
          }
        }
      }

      if (bestMatch) {
        // Check address match
        const fieldResults = [];
        let allFieldsMatch = true;

        // Compare address
        if (sig.address && bestMatch.address) {
          const addrMatch = calculateSimilarity(sig.address, bestMatch.address) >= 0.8;
          fieldResults.push({
            field: 'Address',
            extractedValue: sig.address,
            lookupValue: bestMatch.address,
            matches: addrMatch,
            score: calculateSimilarity(sig.address, bestMatch.address)
          });
          if (!addrMatch) allFieldsMatch = false;
        }

        // Compare city
        if (sig.city && bestMatch.city) {
          const cityMatch = sig.city.toLowerCase().trim() === bestMatch.city.toLowerCase().trim();
          fieldResults.push({
            field: 'City',
            extractedValue: sig.city,
            lookupValue: bestMatch.city,
            matches: cityMatch,
            score: cityMatch ? 1 : 0
          });
          if (!cityMatch) allFieldsMatch = false;
        }

        // Compare zip (first 5 digits)
        if (sig.zip && bestMatch.zip) {
          const sigZip = String(sig.zip).replace(/\D/g, '').substring(0, 5);
          const regZip = String(bestMatch.zip).replace(/\D/g, '').substring(0, 5);
          const zipMatch = sigZip === regZip;
          fieldResults.push({
            field: 'Zip',
            extractedValue: sig.zip,
            lookupValue: bestMatch.zip,
            matches: zipMatch,
            score: zipMatch ? 1 : 0
          });
          if (!zipMatch) allFieldsMatch = false;
        }

        // If name matches but address doesn't, it's a partial match
        isPartialMatch = matchScore >= 0.9 && !allFieldsMatch;
        
        // Final match score considers field matches
        const fieldScoreSum = fieldResults.reduce((sum, f) => sum + (f.score || 0), 0);
        const avgFieldScore = fieldResults.length > 0 ? fieldScoreSum / fieldResults.length : 1;
        const finalScore = (matchScore * 0.6) + (avgFieldScore * 0.4);

        results.push({
          index: i,
          found: true,
          partialMatch: isPartialMatch,
          mismatchReason: isPartialMatch ? 'address_mismatch' : undefined,
          matchScore: finalScore,
          bestMatch: {
            name: bestMatch.name,
            address: bestMatch.address,
            city: bestMatch.city,
            zip: bestMatch.zip
          },
          fieldResults
        });
      } else {
        results.push({
          index: i,
          found: false,
          partialMatch: false,
          matchScore: 0,
          message: 'Not found in voter registry'
        });
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`Validated ${signatures.length} signatures in ${elapsed}ms (${Math.round(elapsed / signatures.length)}ms per signature)`);

    const foundCount = results.filter(r => r.found).length;
    const partialCount = results.filter(r => r.partialMatch).length;

    return new Response(
      JSON.stringify({ 
        success: true,
        totalSignatures: signatures.length,
        foundCount,
        partialMatchCount: partialCount,
        notFoundCount: signatures.length - foundCount,
        processingTimeMs: elapsed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error validating signatures:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});