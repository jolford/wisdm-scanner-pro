import { useDemoMode } from '@/contexts/DemoModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Zap, 
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { demoMetrics, demoRecentActivity, demoProjects, demoConfidenceData } from '@/lib/demo-data';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DemoDashboard() {
  const { isDemoMode } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="demo-metrics bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-200/50 dark:border-violet-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              Documents Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-700 dark:text-violet-400">
              {demoMetrics.documentsToday.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 mt-1">
              <ArrowUpRight className="h-3 w-3" />
              <span>+23% from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card className="demo-validation bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-200/50 dark:border-emerald-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Validation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
              {demoMetrics.validationRate}%
            </div>
            <Progress value={demoMetrics.validationRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="demo-ai-badge bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-200/50 dark:border-amber-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              AI Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
              {demoMetrics.averageConfidence}%
            </div>
            <Badge variant="secondary" className="mt-1 text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Powered by Gemini & GPT
            </Badge>
          </CardContent>
        </Card>

        <Card className="demo-analytics bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-200/50 dark:border-blue-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              Cost Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
              ${demoMetrics.costSavings.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {demoMetrics.timesSaved} hours saved this month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Chart */}
      <Card className="demo-confidence-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weekly Confidence Trends
          </CardTitle>
          <CardDescription>
            AI extraction confidence scores over the past week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={demoConfidenceData}>
                <defs>
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[90, 100]} className="text-xs" />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{payload[0].payload.date}</p>
                          <p className="text-sm text-muted-foreground">
                            Confidence: <span className="text-primary font-semibold">{payload[0].value}%</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Documents: {payload[0].payload.documents}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#confidenceGradient)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Projects & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <Card className="demo-projects">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Active Projects
            </CardTitle>
            <CardDescription>
              Document processing projects with real-time status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {demoProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1">
                  <div className="font-medium">{project.name}</div>
                  <div className="text-sm text-muted-foreground">{project.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{project.documentCount.toLocaleString()}</div>
                  <Badge variant={project.accuracy >= 96 ? "default" : "secondary"} className="text-xs">
                    {project.accuracy}% accuracy
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="demo-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Live feed of document processing events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {demoRecentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{activity.action}</div>
                    <div className="text-sm text-muted-foreground truncate">{activity.target}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{activity.user}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
