import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FraudDetectionSchema = z.object({
  batchId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  lineItems: z.array(z.record(z.any())).max(10000).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const body = await req.json();
    const validated = FraudDetectionSchema.parse(body);
    const { batchId, documentId, metadata, lineItems } = validated;

    const fraudAlerts: any[] = [];

    // Check 1: Identical handwriting patterns (using similarity of names/addresses)
    if (lineItems && lineItems.length > 0) {
      const signatures: Record<string, string[]> = {};
      
      lineItems.forEach((item: any, idx: number) => {
        const handwritingKey = `${item.Printed_Name}_${item.Address}`.toLowerCase();
        if (!signatures[handwritingKey]) {
          signatures[handwritingKey] = [];
        }
        signatures[handwritingKey].push(`Line ${idx + 1}`);
      });

      // Flag if same name/address combo appears more than twice
      Object.entries(signatures).forEach(([key, lines]) => {
        if (lines.length > 2) {
          fraudAlerts.push({
            type: 'identical_handwriting',
            severity: 'high',
            description: `Identical name/address pattern found ${lines.length} times`,
            details: `Lines: ${lines.join(', ')}`,
            affected_lines: lines,
          });
        }
      });
    }

    // Check 2: Repeated addresses (same address, different names)
    if (lineItems && lineItems.length > 0) {
      const addressCounts: Record<string, any[]> = {};
      
      lineItems.forEach((item: any, idx: number) => {
        const address = `${item.Address}_${item.City}_${item.Zip}`.toLowerCase().trim();
        if (!addressCounts[address]) {
          addressCounts[address] = [];
        }
        addressCounts[address].push({ line: idx + 1, name: item.Printed_Name });
      });

      // Flag if same address has more than 3 different signers
      Object.entries(addressCounts).forEach(([address, signers]) => {
        if (signers.length > 3) {
          fraudAlerts.push({
            type: 'repeated_address',
            severity: 'medium',
            description: `Same address used by ${signers.length} different signers`,
            details: `Address: ${address.split('_').join(', ')}`,
            affected_lines: signers.map((s: any) => `Line ${s.line}`),
            signers: signers.map((s: any) => s.name),
          });
        }
      });
    }

    // Check 3: Time burst patterns (if timestamps available)
    if (lineItems && lineItems.length > 0) {
      const dates: Record<string, number> = {};
      
      lineItems.forEach((item: any) => {
        if (item.Date_Signed) {
          const date = new Date(item.Date_Signed).toDateString();
          dates[date] = (dates[date] || 0) + 1;
        }
      });

      // Flag if more than 50% of signatures on same date
      const totalWithDates = Object.values(dates).reduce((sum, count) => sum + count, 0);
      Object.entries(dates).forEach(([date, count]) => {
        if (totalWithDates > 0 && (count / totalWithDates) > 0.5 && count > 5) {
          fraudAlerts.push({
            type: 'time_burst',
            severity: 'medium',
            description: `${count} signatures (${Math.round((count / totalWithDates) * 100)}%) on same date`,
            details: `Date: ${date}`,
            signature_count: count,
          });
        }
      });
    }

    // Check 4: Outlier signatures (very short or very similar names)
    if (lineItems && lineItems.length > 0) {
      lineItems.forEach((item: any, idx: number) => {
        const name = item.Printed_Name || '';
        
        // Flag very short names (likely incomplete)
        if (name.length > 0 && name.length < 3) {
          fraudAlerts.push({
            type: 'outlier_signature',
            severity: 'low',
            description: 'Suspiciously short name detected',
            details: `Line ${idx + 1}: "${name}"`,
            affected_lines: [`Line ${idx + 1}`],
          });
        }

        // Flag missing required fields
        if (!item.Address || !item.City || !item.Zip) {
          fraudAlerts.push({
            type: 'incomplete_data',
            severity: 'high',
            description: 'Missing required address fields',
            details: `Line ${idx + 1}: Missing ${[
              !item.Address && 'Address',
              !item.City && 'City',
              !item.Zip && 'Zip'
            ].filter(Boolean).join(', ')}`,
            affected_lines: [`Line ${idx + 1}`],
          });
        }
      });
    }

    // Store fraud alerts in database
    if (fraudAlerts.length > 0 && documentId) {
      const { error: insertError } = await supabaseClient
        .from('fraud_detections')
        .insert(fraudAlerts.map(alert => ({
          document_id: documentId,
          batch_id: batchId,
          fraud_type: alert.type,
          severity: alert.severity,
          description: alert.description,
          details: alert.details,
          metadata: {
            affected_lines: alert.affected_lines,
            signers: alert.signers,
            signature_count: alert.signature_count,
          },
          status: 'pending',
        })));

      if (insertError) {
        console.error('Error storing fraud alerts:', insertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts: fraudAlerts,
        alertCount: fraudAlerts.length,
        summary: {
          high: fraudAlerts.filter(a => a.severity === 'high').length,
          medium: fraudAlerts.filter(a => a.severity === 'medium').length,
          low: fraudAlerts.filter(a => a.severity === 'low').length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error detecting fraud patterns:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: error.errors }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
