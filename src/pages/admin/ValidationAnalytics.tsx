import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, LineChart, PieChart } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  customer_id: string;
  project_id: string | null;
  document_type: string | null;
  validation_date: string;
  documents_validated: number;
  documents_rejected: number;
  avg_time_seconds: number;
  field_errors: any; // JSONB field
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

      let query = supabase
        .from('validation_analytics')
        .select('*')
        .gte('validation_date', startDate.toISOString().split('T')[0])
        .order('validation_date', { ascending: true });

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAnalytics(data || []);

      // Calculate error-prone fields
      const fieldErrorMap: Record<string, number> = {};
      data?.forEach((record) => {
        Object.entries(record.field_errors || {}).forEach(([field, count]) => {
          fieldErrorMap[field] = (fieldErrorMap[field] || 0) + (count as number);
        });
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

      // Get validation data from audit trail
      const { data: auditData } = await supabase
        .from('audit_trail')
        .select(`
          user_id,
          action_type,
          created_at,
          profiles!user_id (
            full_name,
            email
          )
        `)
        .gte('created_at', startDate.toISOString())
        .in('action_type', ['document_validated', 'document_rejected']);

      if (!auditData) return;

      // Calculate productivity metrics by user
      const userMetrics: Record<string, UserProductivity> = {};

      auditData.forEach((record) => {
        const userId = record.user_id;
        if (!userId) return;

        if (!userMetrics[userId]) {
          userMetrics[userId] = {
            user_id: userId,
            user_name: (record.profiles as any)?.full_name || 'Unknown',
            total_validated: 0,
            total_rejected: 0,
            avg_time: 0,
            accuracy: 0,
          };
        }

        if (record.action_type === 'document_validated') {
          userMetrics[userId].total_validated++;
        } else if (record.action_type === 'document_rejected') {
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
