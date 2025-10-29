import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, LineChart, PieChart } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  customer_id?: string;
  project_id?: string | null;
  document_type?: string | null;
  validation_date: string;
  documents_validated: number;
  documents_rejected: number;
  avg_time_seconds: number;
  field_errors?: any; // JSONB field
}

interface UserProductivity {
  user_id: string;
  user_name: string;
  total_validated: number;
  total_rejected: number;
  avg_time: number;
  accuracy: number;
}

export default function ValidationAnalytics() {
  useRequireAuth(true); // Require admin access
  
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [timeRange, setTimeRange] = useState('7'); // days
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projects, setProjects] = useState<any[]>([]);
  const [userProductivity, setUserProductivity] = useState<UserProductivity[]>([]);
  const [errorProneFields, setErrorProneFields] = useState<Array<{ field: string; count: number }>>([]);

  useEffect(() => {
    loadProjects();
    loadAnalytics();
    loadUserProductivity();
  }, [timeRange, selectedProject]);

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');

    if (data) {
      setProjects(data);
    }
  };

  const loadAnalytics = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));

      // Build analytics from documents (validated/rejected) instead of a materialized table
      let docsQuery = supabase
        .from('documents')
        .select('validation_status, validated_at, project_id')
        .not('validated_at', 'is', null)
        .gte('validated_at', startDate.toISOString());

      if (selectedProject !== 'all') {
        docsQuery = docsQuery.eq('project_id', selectedProject);
      }

      const { data: docsData, error: docsError } = await docsQuery;
      if (docsError) throw docsError;

      // Aggregate by validation_date (day)
      const byDate: Record<string, { validation_date: string; documents_validated: number; documents_rejected: number; avg_time_seconds: number }>= {};
      (docsData || []).forEach((d: any) => {
        const day = new Date(d.validated_at).toISOString().split('T')[0];
        if (!byDate[day]) {
          byDate[day] = { validation_date: day, documents_validated: 0, documents_rejected: 0, avg_time_seconds: 0 };
        }
        if (d.validation_status === 'validated') byDate[day].documents_validated++;
        if (d.validation_status === 'rejected') byDate[day].documents_rejected++;
      });

      // Derive an overall average processing time from jobs during the period
      const { data: jobData } = await supabase
        .from('jobs')
        .select('started_at, completed_at, created_at')
        .gte('created_at', startDate.toISOString());

      const times = (jobData || [])
        .map((j: any) => (j.started_at && j.completed_at) ? (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000 : 0)
        .filter((t: number) => t > 0);
      const overallAvgTime = times.length > 0 ? (times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0;

      const analyticsData = Object.values(byDate)
        .map(r => ({ ...r, avg_time_seconds: overallAvgTime }))
        .sort((a, b) => a.validation_date.localeCompare(b.validation_date));

      setAnalytics(analyticsData);

      // Most error-prone fields from field_changes
      const { data: fieldChanges } = await supabase
        .from('field_changes')
        .select('field_name, created_at')
        .gte('created_at', startDate.toISOString());

      const fieldErrorMap: Record<string, number> = {};
      (fieldChanges || []).forEach((fc: any) => {
        const name = fc.field_name || 'Unknown';
        fieldErrorMap[name] = (fieldErrorMap[name] || 0) + 1;
      });

      const sortedFields = Object.entries(fieldErrorMap)
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setErrorProneFields(sortedFields);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    }
  };

  const loadUserProductivity = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));

      // Get validation data directly from documents table
      let docsQuery = supabase
        .from('documents')
        .select('validated_by, validation_status, validated_at')
        .not('validated_by', 'is', null)
        .not('validated_at', 'is', null)
        .gte('validated_at', startDate.toISOString());

      if (selectedProject !== 'all') {
        docsQuery = docsQuery.eq('project_id', selectedProject);
      }

      const { data: docsData } = await docsQuery;
      if (!docsData) return;

      // Get unique user IDs
      const userIds = [...new Set(docsData.map((d: any) => d.validated_by).filter(Boolean))];
      
      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Calculate productivity metrics by user
      const userMetrics: Record<string, UserProductivity> = {};

      docsData.forEach((doc: any) => {
        const userId = doc.validated_by;
        if (!userId) return;

        if (!userMetrics[userId]) {
          const profile = profileMap.get(userId);
          userMetrics[userId] = {
            user_id: userId,
            user_name: profile?.full_name || profile?.email || 'Unknown User',
            total_validated: 0,
            total_rejected: 0,
            avg_time: 0,
            accuracy: 0,
          };
        }

        if (doc.validation_status === 'validated') {
          userMetrics[userId].total_validated++;
        } else if (doc.validation_status === 'rejected') {
          userMetrics[userId].total_rejected++;
        }
      });

      // Calculate accuracy
      Object.values(userMetrics).forEach((metric) => {
        const total = metric.total_validated + metric.total_rejected;
        metric.accuracy = total > 0 ? (metric.total_validated / total) * 100 : 0;
      });

      setUserProductivity(Object.values(userMetrics).sort((a, b) => b.total_validated - a.total_validated));
    } catch (error) {
      console.error('Error loading user productivity:', error);
    }
  };

  const totalValidated = analytics.reduce((sum, a) => sum + a.documents_validated, 0);
  const totalRejected = analytics.reduce((sum, a) => sum + a.documents_rejected, 0);
  const avgTimeAllDocs = analytics.length > 0
    ? Math.round(analytics.reduce((sum, a) => sum + a.avg_time_seconds, 0) / analytics.length)
    : 0;
  const overallAccuracy = (totalValidated + totalRejected) > 0
    ? ((totalValidated / (totalValidated + totalRejected)) * 100).toFixed(1)
    : '0';

  return (
    <AdminLayout title="Validation Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Validation Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Insights into validation performance and productivity
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Validated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalValidated}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{totalRejected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Time/Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgTimeAllDocs}s</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{overallAccuracy}%</div>
            </CardContent>
          </Card>
        </div>

        {/* User Productivity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              User Productivity
            </CardTitle>
            <CardDescription>Performance metrics by user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userProductivity.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No productivity data available
                </p>
              ) : (
                <div className="space-y-2">
                  {userProductivity.map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{user.user_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.total_validated} validated, {user.total_rejected} rejected
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {user.accuracy.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Accuracy</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error-Prone Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Most Error-Prone Fields
            </CardTitle>
            <CardDescription>Fields that require the most corrections</CardDescription>
          </CardHeader>
          <CardContent>
            {errorProneFields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No error data available
              </p>
            ) : (
              <div className="space-y-2">
                {errorProneFields.map((field, index) => (
                  <div key={field.field} className="flex items-center gap-4">
                    <div className="w-8 text-center font-bold text-muted-foreground">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{field.field}</div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-destructive"
                          style={{
                            width: `${(field.count / errorProneFields[0].count) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-medium text-destructive">
                      {field.count} errors
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
