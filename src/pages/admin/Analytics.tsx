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
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  return (
    <AdminLayout
      title="Analytics & Reports"
      description="Track performance and usage metrics"
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
        <div className="grid md:grid-cols-3 gap-6">
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
                <Calendar className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-3xl font-bold">{analytics.documentsThisMonth}</p>
                <p className="text-xs text-muted-foreground mt-1">documents processed</p>
              </div>
            </div>
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
