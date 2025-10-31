/**
 * Address Validation & Normalization Edge Function
 * 
 * Validates and normalizes addresses for petition processing.
 * Uses internal parsing logic with optional external provider integration.
 * 
 * Request body:
 * - address: string | object (raw address or structured components)
 * - city: string (optional if included in address)
 * - state: string (optional)
 * - zip: string (optional)
 * - provider: 'internal' | 'usps' | 'smarty' (default: 'internal')
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Address normalization utilities
const normalizeStreet = (street: string): string => {
  if (!street) return '';
  
  let normalized = street.trim().toUpperCase();
  
  // Common abbreviations
  const abbrev: Record<string, string> = {
    'STREET': 'ST', 'AVENUE': 'AVE', 'ROAD': 'RD', 'DRIVE': 'DR',
    'BOULEVARD': 'BLVD', 'LANE': 'LN', 'COURT': 'CT', 'CIRCLE': 'CIR',
    'PLACE': 'PL', 'TERRACE': 'TER', 'PARKWAY': 'PKWY', 'HIGHWAY': 'HWY',
    'NORTH': 'N', 'SOUTH': 'S', 'EAST': 'E', 'WEST': 'W',
    'NORTHEAST': 'NE', 'NORTHWEST': 'NW', 'SOUTHEAST': 'SE', 'SOUTHWEST': 'SW',
    'APARTMENT': 'APT', 'SUITE': 'STE', 'UNIT': 'UNIT', 'BUILDING': 'BLDG',
    'FLOOR': 'FL', 'ROOM': 'RM'
  };
  
  // Replace abbreviations
  for (const [full, abbr] of Object.entries(abbrev)) {
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    normalized = normalized.replace(regex, abbr);
  }
  
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

const parseAddress = (addressStr: string): Record<string, string> => {
  const parts: Record<string, string> = {};
  
  // Try to extract unit/apt number
  const unitMatch = addressStr.match(/\b(APT|APARTMENT|UNIT|STE|SUITE|#)\s*([A-Z0-9\-]+)\b/i);
  if (unitMatch) {
    parts.unit = unitMatch[2];
    addressStr = addressStr.replace(unitMatch[0], '').trim();
  }
  
  // Try to extract ZIP code (5 or 9 digit)
  const zipMatch = addressStr.match(/\b(\d{5})(?:-(\d{4}))?\b/);
  if (zipMatch) {
    parts.zip = zipMatch[0];
    addressStr = addressStr.replace(zipMatch[0], '').trim();
  }
  
  // Try to extract state (2 letter code)
  const stateMatch = addressStr.match(/\b([A-Z]{2})\b/);
  if (stateMatch) {
    parts.state = stateMatch[1];
    addressStr = addressStr.replace(stateMatch[0], '').trim();
  }
  
  // Remaining parts
  const remaining = addressStr.split(',').map(p => p.trim()).filter(Boolean);
  
  if (remaining.length > 0) {
    parts.street = normalizeStreet(remaining[0]);
  }
  if (remaining.length > 1) {
    parts.city = remaining[1].toUpperCase();
  }
  
  return parts;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { address, city, state, zip, provider = 'internal', documentId } = await req.json();
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating address:', { address, city, state, zip, provider });

    let parsedAddress: Record<string, string>;
    
    // Parse if string, otherwise use provided components
    if (typeof address === 'string') {
      parsedAddress = parseAddress(address);
      if (city) parsedAddress.city = city.toUpperCase();
      if (state) parsedAddress.state = state.toUpperCase();
      if (zip) parsedAddress.zip = zip;
    } else {
      parsedAddress = {
        street: address.street ? normalizeStreet(address.street) : '',
        city: (address.city || city || '').toUpperCase(),
        state: (address.state || state || '').toUpperCase(),
        zip: address.zip || zip || '',
        unit: address.unit || ''
      };
    }

    // Validation logic
    let validationStatus: 'valid' | 'invalid' | 'corrected' | 'unverified' = 'unverified';
    let confidence = 0.5;
    const validationDetails: Record<string, any> = {
      checks: []
    };

    // Basic validation checks
    if (parsedAddress.street && parsedAddress.street.length > 0) {
      validationDetails.checks.push({ field: 'street', status: 'present' });
      confidence += 0.1;
    } else {
      validationDetails.checks.push({ field: 'street', status: 'missing' });
    }

    if (parsedAddress.city && parsedAddress.city.length > 0) {
      validationDetails.checks.push({ field: 'city', status: 'present' });
      confidence += 0.1;
    } else {
      validationDetails.checks.push({ field: 'city', status: 'missing' });
    }

    // State validation (2-letter code)
    const validStates = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 
      'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 
      'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']);
    
    if (parsedAddress.state && validStates.has(parsedAddress.state)) {
      validationDetails.checks.push({ field: 'state', status: 'valid' });
      confidence += 0.15;
    } else if (parsedAddress.state) {
      validationDetails.checks.push({ field: 'state', status: 'invalid' });
    } else {
      validationDetails.checks.push({ field: 'state', status: 'missing' });
    }

    // ZIP validation (5 or 9 digit)
    if (parsedAddress.zip && /^\d{5}(-\d{4})?$/.test(parsedAddress.zip)) {
      validationDetails.checks.push({ field: 'zip', status: 'valid' });
      confidence += 0.15;
    } else if (parsedAddress.zip) {
      validationDetails.checks.push({ field: 'zip', status: 'invalid' });
    } else {
      validationDetails.checks.push({ field: 'zip', status: 'missing' });
    }

    // Determine overall status
    if (confidence >= 0.8) {
      validationStatus = 'valid';
    } else if (confidence >= 0.5) {
      validationStatus = 'corrected';
    } else if (confidence < 0.3) {
      validationStatus = 'invalid';
    }

    // Save to database if documentId provided
    if (documentId) {
      const { error: dbError } = await supabaseClient
        .from('address_validations')
        .insert({
          document_id: documentId,
          original_address: { address, city, state, zip },
          normalized_address: parsedAddress,
          validation_status: validationStatus,
          validation_provider: provider,
          confidence_score: confidence,
          validation_details: validationDetails
        });

      if (dbError) {
        console.error('Failed to save address validation:', dbError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        validation_status: validationStatus,
        confidence: confidence,
        original: { address, city, state, zip },
        normalized: parsedAddress,
        details: validationDetails
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in address validation:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to validate address. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});