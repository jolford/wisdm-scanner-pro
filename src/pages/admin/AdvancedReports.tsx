import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, FileText, Clock, AlertCircle, Download } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AdvancedReports() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  
  // Metrics state
  const [throughputData, setThroughputData] = useState<any[]>([]);
  const [accuracyData, setAccuracyData] = useState<any[]>([]);
  const [userActivityData, setUserActivityData] = useState<any[]>([]);
  const [errorBreakdown, setErrorBreakdown] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalDocuments: 0,
    avgProcessingTime: 0,
    accuracyRate: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    
    const days = parseInt(dateRange);
    const startDate = subDays(new Date(), days);
    
    try {
      // Fetch document throughput
      const { data: documents } = await supabase
        .from('documents')
        .select('created_at, validated_at, validation_status, confidence_score, validated_by, uploaded_by')
        .or(`validated_at.gte.${startDate.toISOString()},created_at.gte.${startDate.toISOString()}`);

      // Process throughput data by day
      const throughputMap = new Map<string, number>();
      documents?.forEach(doc => {
        const day = format(new Date((doc as any).validated_at || (doc as any).created_at), 'MMM dd');
        throughputMap.set(day, (throughputMap.get(day) || 0) + 1);
      });
      
      setThroughputData(
        Array.from(throughputMap.entries()).map(([date, count]) => ({ date, count }))
      );

      // Calculate accuracy data
      const docsWithScore = (documents || []).filter(d => (d as any).confidence_score != null);
      const avgConfidence = docsWithScore.reduce((sum, d: any) => sum + ((d.confidence_score as number) || 0), 0) / (docsWithScore.length || 1);
      
      setAccuracyData([
        { name: 'High Confidence (>90%)', value: docsWithScore.filter((d: any) => ((d.confidence_score as number) || 0) > 0.9).length },
        { name: 'Medium Confidence (70-90%)', value: docsWithScore.filter((d: any) => ((d.confidence_score as number) || 0) >= 0.7 && ((d.confidence_score as number) || 0) <= 0.9).length },
        { name: 'Low Confidence (<70%)', value: docsWithScore.filter((d: any) => ((d.confidence_score as number) || 0) < 0.7).length },
      ]);

      // Fetch user activity from audit trail
      const { data: auditLogs } = await supabase
        .from('audit_trail')
        .select('user_id, action_type, created_at')
        .gte('created_at', startDate.toISOString());

      const userActivityMap = new Map<string, number>();
      auditLogs?.forEach(log => {
        const user = log.user_id || 'Unknown';
        userActivityMap.set(user, (userActivityMap.get(user) || 0) + 1);
      });
      
      setUserActivityData(
        Array.from(userActivityMap.entries())
          .map(([user, actions]) => ({ user, actions }))
          .sort((a, b) => b.actions - a.actions)
          .slice(0, 10)
      );

      // Fetch error logs
      const { data: errors } = await supabase
        .from('error_logs')
        .select('component_name')
        .gte('created_at', startDate.toISOString());

      const errorMap = new Map<string, number>();
      errors?.forEach(err => {
        const component = err.component_name || 'Unknown';
        errorMap.set(component, (errorMap.get(component) || 0) + 1);
      });
      
      setErrorBreakdown(
        Array.from(errorMap.entries()).map(([name, value]) => ({ name, value }))
      );

      // Calculate summary stats
      const { data: jobMetrics } = await supabase
        .from('job_metrics')
        .select('avg_processing_time_ms, completed_jobs, failed_jobs')
        .gte('metric_date', format(startDate, 'yyyy-MM-dd'));

      const totalJobs = jobMetrics?.reduce((sum, m) => sum + m.completed_jobs + m.failed_jobs, 0) || 0;
      const avgTimeFromMetrics = jobMetrics?.reduce((sum, m) => sum + (m.avg_processing_time_ms || 0), 0) / (jobMetrics?.length || 1);

      // Fallback to jobs table if metrics empty
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('started_at, completed_at, created_at, status')
        .gte('created_at', startDate.toISOString());

      const times = (jobsData || [])
        .map(j => (j.started_at && j.completed_at) ? (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000 : 0)
        .filter(t => t > 0);
      const avgTimeFromJobs = times.length > 0 ? (times.reduce((a, b) => a + b, 0) / times.length) : 0;

      const avgTime = avgTimeFromMetrics ? (avgTimeFromMetrics / 1000) : avgTimeFromJobs;

      // Accuracy rate: use confidence if available, fallback to validation ratio
      const validatedCount = (documents || []).filter((d: any) => d.validation_status === 'validated').length;
      const accuracyRate = (docsWithScore.length > 0)
        ? avgConfidence * 100
        : ((documents && documents.length > 0) ? (validatedCount / documents.length) * 100 : 0);

      // Active users: fallback to unique validators/uploaders if no audit logs
      const activeUsersFromAudit = new Set((auditLogs || []).map(l => l.user_id)).size;
      const activeUsersFromDocs = new Set([...(documents || []).map((d: any) => d.validated_by).filter(Boolean), ...(documents || []).map((d: any) => d.uploaded_by).filter(Boolean)]).size;

      setSummaryStats({
        totalDocuments: documents?.length || 0,
        avgProcessingTime: avgTime || 0,
        accuracyRate,
        activeUsers: activeUsersFromAudit || activeUsersFromDocs || 0,
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({ title: "Error loading reports", description: "Failed to fetch report data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    // Generate CSV export
    const csv = [
      ['Advanced WISDM Analytics Report'],
      [`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`],
      [`Date Range: Last ${dateRange}`],
      [],
      ['Summary Metrics'],
      ['Total Documents', summaryStats.totalDocuments],
      ['Average Processing Time (s)', summaryStats.avgProcessingTime.toFixed(2)],
      ['Accuracy Rate (%)', summaryStats.accuracyRate.toFixed(2)],
      ['Active Users', summaryStats.activeUsers],
      [],
      ['Daily Throughput'],
      ['Date', 'Documents Processed'],
      ...throughputData.map(d => [d.date, d.count]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wisdm_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <AdminLayout title="Advanced Reports & Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Advanced Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into system performance and operations
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalDocuments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Processed in selected period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.avgProcessingTime.toFixed(1)}s</div>
              <p className="text-xs text-muted-foreground mt-1">Per document</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.accuracyRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Average confidence</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.activeUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">In selected period</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          {/* Document Throughput */}
          <Card>
            <CardHeader>
              <CardTitle>Document Throughput</CardTitle>
              <CardDescription>Daily processing volume</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Documents" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Accuracy Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Confidence Score Distribution</CardTitle>
              <CardDescription>Document accuracy breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {accuracyData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={accuracyData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {accuracyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No confidence scores recorded in the selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Top User Activity</CardTitle>
              <CardDescription>Most active users by actions performed</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userActivityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="user" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="actions" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Error Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
              <CardDescription>Errors by component</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={errorBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={100}
                    fill="#FF8042"
                    dataKey="value"
                  >
                    {errorBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
