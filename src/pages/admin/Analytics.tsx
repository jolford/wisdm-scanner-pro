/**
 * Analytics & Reports Admin Page
 * 
 * Comprehensive analytics dashboard providing detailed insights into system performance,
 * usage patterns, costs, and operational metrics across all customers and projects.
 * 
 * Features:
 * - Time-range filtering (7/30/90/365 days)
 * - Document processing metrics (total, validated, pending)
 * - Cost tracking and budgeting (total spend, cost per document)
 * - Job performance analytics (completion rates, processing times, error rates)
 * - Daily activity charts showing document and job trends
 * - Status distribution visualization (pie charts)
 * - Extraction accuracy metrics
 * - Top performing projects identification
 * - Customer spending analysis
 * 
 * Data Sources:
 * - documents: Processing and validation status
 * - jobs: Job execution metrics and performance
 * - tenant_usage: Cost and budget tracking
 * - job_metrics: Aggregated performance data
 * 
 * @requires useRequireAuth - Admin-only access control
 * @requires AdminLayout - Standard admin page layout
 * @requires Recharts - For data visualization components
 */

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Building2,
  Key,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

interface Analytics {
  totalDocuments: number;
  validatedDocuments: number;
  pendingDocuments: number;
  totalUsers: number;
  totalCustomers: number;
  activeLicenses: number;
  documentsThisMonth: number;
  documentsThisWeek: number;
  topProjects: Array<{ name: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
  jobMetrics: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
    avgProcessingTime: number;
  };
  costMetrics: {
    totalCost: number;
    avgCostPerDoc: number;
    topSpenders: Array<{ customer: string; cost: number }>;
  };
  dailyActivity: Array<{ date: string; documents: number; jobs: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  errorRate: number;
  extractionAccuracy: number;
}

const Analytics = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    if (!loading && isAdmin) {
      loadAnalytics();
    }
  }, [loading, isAdmin, timeRange]);

  const loadAnalytics = async () => {
    try {
      const now = new Date();
      const daysAgo = new Date(now.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);

      const [
        docsTotal,
        docsValidated,
        docsPending,
        users,
        customers,
        licenses,
        docsThisMonth,
        docsThisWeek,
        projectStats,
        jobStats,
        costData,
        dailyDocs,
        statusData,
        confidenceScores,
      ] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'validated'),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase
          .from('licenses')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('documents')
          .select('project_id, projects!inner(name)')
          .gte('created_at', daysAgo.toISOString()),
        supabase
          .from('jobs')
          .select('status, created_at, completed_at, started_at')
          .gte('created_at', daysAgo.toISOString()),
        supabase
          .from('tenant_usage')
          .select('customer_id, total_cost_usd, documents_processed, customers!inner(company_name)')
          .gte('period_start', daysAgo.toISOString()),
        supabase
          .from('documents')
          .select('created_at')
          .gte('created_at', daysAgo.toISOString()),
        supabase
          .from('documents')
          .select('validation_status')
          .gte('created_at', daysAgo.toISOString()),
        supabase
          .from('documents')
          .select('confidence_score')
          .not('confidence_score', 'is', null),
      ]);

      // Calculate top projects
      const projectCounts: Record<string, number> = {};
      (projectStats.data || []).forEach((doc: any) => {
        const name = doc.projects?.name || 'Unknown';
        projectCounts[name] = (projectCounts[name] || 0) + 1;
      });

      const topProjects = Object.entries(projectCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate job metrics
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

      const jobMetrics = {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        avgProcessingTime: Math.round(avgProcessingTime / 1000), // in seconds
      };

      // Calculate cost metrics
      const costs = costData.data || [];
      const totalCost = costs.reduce((sum, c) => sum + (Number(c.total_cost_usd) || 0), 0);
      const totalDocs = costs.reduce((sum, c) => sum + (c.documents_processed || 0), 0);
      
      const customerCosts: Record<string, number> = {};
      costs.forEach((c: any) => {
        const name = c.customers?.company_name || 'Unknown';
        customerCosts[name] = (customerCosts[name] || 0) + Number(c.total_cost_usd || 0);
      });

      const topSpenders = Object.entries(customerCosts)
        .map(([customer, cost]) => ({ customer, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      const costMetrics = {
        totalCost,
        avgCostPerDoc: totalDocs > 0 ? totalCost / totalDocs : 0,
        topSpenders,
      };

      // Calculate daily activity
      const dailyDocCounts: Record<string, number> = {};
      const dailyJobCounts: Record<string, number> = {};
      
      (dailyDocs.data || []).forEach(doc => {
        const date = new Date(doc.created_at).toISOString().split('T')[0];
        dailyDocCounts[date] = (dailyDocCounts[date] || 0) + 1;
      });

      jobs.forEach(job => {
        const date = new Date(job.created_at).toISOString().split('T')[0];
        dailyJobCounts[date] = (dailyJobCounts[date] || 0) + 1;
      });

      const allDates = new Set([...Object.keys(dailyDocCounts), ...Object.keys(dailyJobCounts)]);
      const dailyActivity = Array.from(allDates)
        .sort()
        .slice(-14)
        .map(date => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          documents: dailyDocCounts[date] || 0,
          jobs: dailyJobCounts[date] || 0,
        }));

      // Calculate status breakdown
      const statusCounts: Record<string, number> = {};
      (statusData.data || []).forEach(doc => {
        const status = doc.validation_status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
      }));

      const errorRate = jobMetrics.total > 0
        ? ((jobMetrics.failed / jobMetrics.total) * 100)
        : 0;

      // Calculate extraction accuracy
      const scores = confidenceScores.data || [];
      const extractionAccuracy = scores.length > 0
        ? (scores.reduce((sum, doc) => sum + (Number(doc.confidence_score) || 0), 0) / scores.length) * 100
        : 0;

      setAnalytics({
        totalDocuments: docsTotal.count || 0,
        validatedDocuments: docsValidated.count || 0,
        pendingDocuments: docsPending.count || 0,
        totalUsers: users.count || 0,
        totalCustomers: customers.count || 0,
        activeLicenses: licenses.count || 0,
        documentsThisMonth: docsThisMonth.count || 0,
        documentsThisWeek: docsThisWeek.count || 0,
        topProjects,
        recentActivity: [],
        jobMetrics,
        costMetrics,
        dailyActivity,
        statusBreakdown,
        errorRate,
        extractionAccuracy,
      });
    } catch (error: any) {
      toast.error('Failed to load analytics: ' + error.message);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const validationRate = analytics.totalDocuments
    ? ((analytics.validatedDocuments / analytics.totalDocuments) * 100).toFixed(1)
    : '0';

  const chartConfig = {
    documents: { label: 'Documents', color: 'hsl(var(--primary))' },
    jobs: { label: 'Jobs', color: 'hsl(var(--accent))' },
  };

  const statusColors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142 76% 36%)', 'hsl(48 96% 53%)'];

  return (
    <AdminLayout
      title="Analytics & Reports"
      description="Comprehensive performance and usage metrics"
    >
      <div className="space-y-6">
        {/* Time Range Selector */}
        <div className="flex justify-end">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-5 gap-6">
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-3xl font-bold">{analytics.totalDocuments}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.documentsThisWeek} this week
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Validation Rate</p>
                <p className="text-3xl font-bold">{validationRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.validatedDocuments} validated
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-3xl font-bold">${analytics.costMetrics.totalCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ${analytics.costMetrics.avgCostPerDoc.toFixed(4)}/doc
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Extraction Accuracy</p>
                <p className="text-3xl font-bold">{analytics.extractionAccuracy.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  OCR confidence score
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Job Performance Metrics */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Total Jobs</p>
            </div>
            <p className="text-2xl font-bold">{analytics.jobMetrics.total}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <p className="text-2xl font-bold">{analytics.jobMetrics.completed}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <p className="text-2xl font-bold">{analytics.jobMetrics.failed}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-accent" />
              <p className="text-sm text-muted-foreground">Avg Processing</p>
            </div>
            <p className="text-2xl font-bold">{analytics.jobMetrics.avgProcessingTime}s</p>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Daily Activity Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Daily Activity (Last 14 Days)</h3>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={analytics.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="documents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="jobs" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Card>

          {/* Status Breakdown Pie Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Document Status Distribution</h3>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={analytics.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.status}: ${entry.count}`}
                >
                  {analytics.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[index % statusColors.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </Card>
        </div>

        {/* System Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <Users className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{analytics.totalUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold">{analytics.totalCustomers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Key className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Licenses</p>
                <p className="text-2xl font-bold">{analytics.activeLicenses}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Top Projects */}
        <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Top Projects (Last {timeRange} days)</h3>
          </div>
          <div className="space-y-4">
            {analytics.topProjects.map((project, index) => (
              <div key={project.name} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{project.name}</p>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          (project.count / (analytics.topProjects[0]?.count || 1)) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{project.count}</p>
                  <p className="text-xs text-muted-foreground">documents</p>
                </div>
              </div>
            ))}
            {analytics.topProjects.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No project data available for this time range
              </p>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Analytics;
