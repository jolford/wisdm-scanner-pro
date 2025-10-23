
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user and check if admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_system_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const timeRange = parseInt(url.searchParams.get('days') || '30');
    const format = url.searchParams.get('format') || 'json';

    const now = new Date();
    const daysAgo = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000);

    // Fetch analytics data
    const [
      docsTotal,
      docsValidated,
      docsPending,
      users,
      customers,
      licenses,
      jobStats,
      costData,
      dailyDocs,
      statusData,
      confidenceScores,
    ] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('validation_status', 'validated'),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('validation_status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('jobs').select('status, created_at, completed_at, started_at').gte('created_at', daysAgo.toISOString()),
      supabase.from('tenant_usage').select('customer_id, total_cost_usd, documents_processed, customers!inner(company_name)').gte('period_start', daysAgo.toISOString()),
      supabase.from('documents').select('created_at, validation_status').gte('created_at', daysAgo.toISOString()),
      supabase.from('documents').select('validation_status').gte('created_at', daysAgo.toISOString()),
      supabase.from('documents').select('confidence_score').gte('created_at', daysAgo.toISOString()).not('confidence_score', 'is', null),
    ]);

    // Calculate metrics
    const jobs = jobStats.data || [];
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const processingTimes = completedJobs
      .map(j => {
        if (j.started_at && j.completed_at) {
          return new Date(j.completed_at).getTime() - new Date(j.started_at).getTime();
        }
        return 0;
      })
      .filter(t => t > 0);

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    const costs = costData.data || [];
    const totalCost = costs.reduce((sum, c) => sum + (Number(c.total_cost_usd) || 0), 0);
    const totalDocs = costs.reduce((sum, c) => sum + (c.documents_processed || 0), 0);

    const statusCounts: Record<string, number> = {};
    (statusData.data || []).forEach(doc => {
      const status = doc.validation_status || 'pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const scores = confidenceScores.data || [];
    const extractionAccuracy = scores.length > 0
      ? scores.reduce((sum, doc) => sum + (Number(doc.confidence_score) || 0), 0) / scores.length
      : 0;

    const analytics = {
      period: {
        days: timeRange,
        start: daysAgo.toISOString(),
        end: now.toISOString()
      },
      documents: {
        total: docsTotal.count || 0,
        validated: docsValidated.count || 0,
        pending: docsPending.count || 0,
        validationRate: docsTotal.count ? ((docsValidated.count || 0) / docsTotal.count * 100).toFixed(2) : '0'
      },
      jobs: {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        avgProcessingTimeSeconds: Math.round(avgProcessingTime / 1000),
        errorRate: jobs.length > 0 ? ((jobs.filter(j => j.status === 'failed').length / jobs.length) * 100).toFixed(2) : '0'
      },
      costs: {
        totalUsd: totalCost.toFixed(2),
        avgPerDocUsd: (totalDocs > 0 ? totalCost / totalDocs : 0).toFixed(4)
      },
      system: {
        totalUsers: users.count || 0,
        totalCustomers: customers.count || 0,
        activeLicenses: licenses.count || 0
      },
      quality: {
        extractionAccuracy: extractionAccuracy.toFixed(2),
        statusBreakdown: statusCounts
      }
    };

    // Return as CSV if requested
    if (format === 'csv') {
      const csv = [
        'Metric,Value',
        `Period Days,${timeRange}`,
        `Total Documents,${analytics.documents.total}`,
        `Validated Documents,${analytics.documents.validated}`,
        `Validation Rate,${analytics.documents.validationRate}%`,
        `Total Jobs,${analytics.jobs.total}`,
        `Completed Jobs,${analytics.jobs.completed}`,
        `Failed Jobs,${analytics.jobs.failed}`,
        `Error Rate,${analytics.jobs.errorRate}%`,
        `Avg Processing Time,${analytics.jobs.avgProcessingTimeSeconds}s`,
        `Total Cost,$${analytics.costs.totalUsd}`,
        `Avg Cost Per Doc,$${analytics.costs.avgPerDocUsd}`,
        `Extraction Accuracy,${analytics.quality.extractionAccuracy}%`,
        `Total Users,${analytics.system.totalUsers}`,
        `Total Customers,${analytics.system.totalCustomers}`,
        `Active Licenses,${analytics.system.activeLicenses}`
      ].join('\n');

      return new Response(csv, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${timeRange}days.csv"`
        }
      });
    }

    return new Response(
      JSON.stringify(analytics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
