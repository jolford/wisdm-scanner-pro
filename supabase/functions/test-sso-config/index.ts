import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config_id, entity_id, sso_url, certificate, metadata_url } = await req.json();
    console.log('Testing SSO config:', { config_id, entity_id, sso_url, has_cert: !!certificate, metadata_url });

    const results: { check: string; status: 'pass' | 'fail' | 'warn'; message: string }[] = [];

    // Check 1: Entity ID format
    if (entity_id) {
      try {
        new URL(entity_id);
        results.push({ check: 'Entity ID Format', status: 'pass', message: 'Valid URL format' });
      } catch {
        results.push({ check: 'Entity ID Format', status: 'warn', message: 'Not a URL (may be valid for some IdPs)' });
      }
    } else {
      results.push({ check: 'Entity ID Format', status: 'fail', message: 'Entity ID is required' });
    }

    // Check 2: SSO URL reachability
    if (sso_url) {
      try {
        new URL(sso_url);
        results.push({ check: 'SSO URL Format', status: 'pass', message: 'Valid URL format' });
        
        // Try to reach the URL (HEAD request)
        try {
          const response = await fetch(sso_url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          if (response.ok || response.status === 405 || response.status === 302) {
            results.push({ check: 'SSO URL Reachable', status: 'pass', message: `Endpoint responded (status: ${response.status})` });
          } else {
            results.push({ check: 'SSO URL Reachable', status: 'warn', message: `Endpoint returned status ${response.status}` });
          }
        } catch (fetchError) {
          results.push({ check: 'SSO URL Reachable', status: 'warn', message: 'Could not reach endpoint (may require authentication)' });
        }
      } catch {
        results.push({ check: 'SSO URL Format', status: 'fail', message: 'Invalid URL format' });
      }
    } else {
      results.push({ check: 'SSO URL', status: 'fail', message: 'SSO URL is required' });
    }

    // Check 3: Certificate validation
    if (certificate) {
      const trimmedCert = certificate.trim();
      if (trimmedCert.includes('-----BEGIN CERTIFICATE-----') && trimmedCert.includes('-----END CERTIFICATE-----')) {
        results.push({ check: 'Certificate Format', status: 'pass', message: 'Valid PEM format detected' });
        
        // Extract the base64 content and validate
        const base64Content = trimmedCert
          .replace('-----BEGIN CERTIFICATE-----', '')
          .replace('-----END CERTIFICATE-----', '')
          .replace(/\s/g, '');
        
        try {
          atob(base64Content);
          results.push({ check: 'Certificate Encoding', status: 'pass', message: 'Valid base64 encoding' });
        } catch {
          results.push({ check: 'Certificate Encoding', status: 'fail', message: 'Invalid base64 encoding' });
        }
      } else {
        results.push({ check: 'Certificate Format', status: 'fail', message: 'Missing PEM headers (BEGIN/END CERTIFICATE)' });
      }
    } else {
      results.push({ check: 'Certificate', status: 'fail', message: 'X.509 Certificate is required for SAML' });
    }

    // Check 4: Metadata URL (if provided)
    if (metadata_url) {
      try {
        new URL(metadata_url);
        results.push({ check: 'Metadata URL Format', status: 'pass', message: 'Valid URL format' });
        
        try {
          const response = await fetch(metadata_url, {
            signal: AbortSignal.timeout(5000)
          });
          if (response.ok) {
            const content = await response.text();
            if (content.includes('EntityDescriptor') || content.includes('md:EntityDescriptor')) {
              results.push({ check: 'Metadata Content', status: 'pass', message: 'Valid SAML metadata XML detected' });
            } else {
              results.push({ check: 'Metadata Content', status: 'warn', message: 'Response may not be valid SAML metadata' });
            }
          } else {
            results.push({ check: 'Metadata Fetch', status: 'warn', message: `Could not fetch metadata (status: ${response.status})` });
          }
        } catch {
          results.push({ check: 'Metadata Fetch', status: 'warn', message: 'Could not fetch metadata URL' });
        }
      } catch {
        results.push({ check: 'Metadata URL Format', status: 'fail', message: 'Invalid URL format' });
      }
    }

    // Summary
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const warnCount = results.filter(r => r.status === 'warn').length;

    const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';
    const summary = failCount > 0 
      ? `${failCount} issue(s) need attention before SSO will work`
      : warnCount > 0
        ? `Configuration looks valid with ${warnCount} warning(s)`
        : 'All checks passed - configuration looks ready';

    console.log('Test results:', { passCount, failCount, warnCount, overallStatus });

    return new Response(
      JSON.stringify({ 
        success: true, 
        results, 
        summary: { status: overallStatus, message: summary, passCount, failCount, warnCount }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing SSO config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
