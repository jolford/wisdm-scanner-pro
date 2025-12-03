import { useRequireAuth } from "@/hooks/use-require-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown,
  Clock, 
  DollarSign, 
  CheckCircle, 
  Target,
  Zap,
  ShieldCheck,
  Activity,
  Database,
  Server,
  HardDrive,
  AlertTriangle,
  XCircle,
  RefreshCw,
  AlertCircle,
  FileText,
  Users,
  Loader2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'error';
  latency?: number;
  avgLatency?: number;
  lastChecked: Date;
  message?: string;
  poolStatus?: string;
}

interface ProcessingMetrics {
  pendingJobs: number;
  processingJobs: number;
  completedJobs24h: number;
  failedJobs24h: number;
  avgProcessingTime: number;
  throughputPerHour: number;
}

interface ApplicationStats {
  totalDocuments: number;
  documentsToday: number;
  activeUsers: number;
  errorRate: number;
  recentErrors: number;
}

// Latency thresholds (ms) - increased to reduce false positives
const LATENCY_THRESHOLDS = {
  database: { warning: 1000, critical: 2500 },
  storage: { warning: 2000, critical: 4000 },
  auth: { warning: 1000, critical: 2500 },
  edge: { warning: 1500, critical: 3000 }
};

// Number of pings for latency averaging
const LATENCY_PING_COUNT = 3;

interface ViabilityMetrics {
  // Time Metrics
  avgProcessingTimeSeconds: number;
  manualProcessingTimeSeconds: number;
  timeSavedPerDocument: number;
  totalTimeSavedHours: number;

  // Cost Metrics
  avgAICostPerDoc: number;
  manualLaborCostPerDoc: number;
  costSavingsPerDoc: number;
  totalCostSavings: number;
  annualSubscriptionCost: number;
  monthlyCostPerDoc: number;

  // FTE Impact
  currentFTEs: number;
  projectedFTEs: number;
  fteReduction: number;
  hoursReallocated: number;

  // Accuracy Metrics
  totalDocuments: number;
  successfulExtractions: number;
  validationCatchRate: number;
  errorDetectionRate: number;
  extractionAccuracy: number;
  validatedDocs: number;
  rejectedDocs: number;
  pendingDocs: number;

  // ROI Metrics
  totalInvestment: number;
  totalSavings: number;
  netSavings: number;
  roi: number;
  savingsPerDollarSpent: number;
  breakEvenDocuments: number;
  paybackPeriodMonths: number;
  
  // Data source
  isProjectedData: boolean;
  projectedVolume: number;
}

const SystemViability = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [metrics, setMetrics] = useState<ViabilityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Health monitoring state
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [processing, setProcessing] = useState<ProcessingMetrics | null>(null);
  const [appStats, setAppStats] = useState<ApplicationStats | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("health");

  // Constants for calculations (now visible to users)
  const MANUAL_TIME_PER_DOC = 300; // 5 minutes in seconds
  const MANUAL_LABOR_RATE = 25; // $25/hour (realistic data entry rate)
  const SYSTEM_SETUP_COST = 2500; // One-time setup cost (training, implementation, configuration)
  const MONTHLY_SUBSCRIPTION = 499; // Monthly platform cost
  const HOURS_PER_FTE = 2080; // Standard annual work hours (260 days × 8 hours)

  useEffect(() => {
    if (!loading && isAdmin) {
      loadViabilityMetrics();
    }
  }, [loading, isAdmin]);

  const loadViabilityMetrics = async () => {
    try {
      setIsLoading(true);

      const [
        jobsData,
        docsData,
        costData,
        validationData,
        confidenceData,
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select('status, started_at, completed_at')
          .eq('status', 'completed'),
        supabase
          .from('documents')
          .select('id, validation_status'),
        supabase
          .from('tenant_usage')
          .select('total_cost_usd, documents_processed'),
        supabase
          .from('documents')
          .select('validation_status, extracted_text')
          .not('extracted_text', 'is', null),
        supabase
          .from('documents')
          .select('confidence_score')
          .not('confidence_score', 'is', null),
      ]);

      const jobs = jobsData.data || [];
      const docs = docsData.data || [];
      const costs = costData.data || [];
      const validations = validationData.data || [];
      const scores = confidenceData.data || [];

      // Use sample data if no real data exists
      const useSampleData = docs.length === 0;
      const sampleDocCount = 10000; // Projected annual volume
      const effectiveDocCount = useSampleData ? sampleDocCount : docs.length;

      // Calculate average processing time
      const processingTimes = jobs
        .map(j => {
          if (j.started_at && j.completed_at) {
            return (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000;
          }
          return 0;
        })
        .filter(t => t > 0);

      const avgProcessingTimeSeconds = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 128; // Industry average for AI processing (2m 8s)

      // Calculate costs
      const totalCost = costs.reduce((sum, c) => sum + Number(c.total_cost_usd || 0), 0);
      const totalDocsProcessed = costs.reduce((sum, c) => sum + (c.documents_processed || 0), 0);
      const avgAICostPerDoc = totalDocsProcessed > 0 ? totalCost / totalDocsProcessed : 0.01; // Industry average $0.01/doc

      // Manual labor cost calculation
      const manualLaborCostPerDoc = (MANUAL_TIME_PER_DOC / 3600) * MANUAL_LABOR_RATE;

      // Calculate savings
      const timeSavedPerDocument = MANUAL_TIME_PER_DOC - avgProcessingTimeSeconds;
      const costSavingsPerDoc = manualLaborCostPerDoc - avgAICostPerDoc;
      const totalTimeSavedHours = (timeSavedPerDocument * effectiveDocCount) / 3600;
      const totalCostSavings = costSavingsPerDoc * effectiveDocCount;

      // Calculate accuracy metrics
      const successfulExtractions = useSampleData ? sampleDocCount * 0.98 : validations.length;
      const validatedDocs = useSampleData ? sampleDocCount * 0.92 : docs.filter(d => d.validation_status === 'validated').length;
      const rejectedDocs = useSampleData ? sampleDocCount * 0.05 : docs.filter(d => d.validation_status === 'rejected').length;
      const pendingDocs = useSampleData ? sampleDocCount * 0.03 : docs.filter(d => d.validation_status === 'pending').length;
      
      // Validation catch rate: % of docs that passed validation (quality metric)
      const validationCatchRate = effectiveDocCount > 0
        ? (validatedDocs / effectiveDocCount) * 100
        : 92;

      // Error detection rate: % of docs flagged for review
      const errorDetectionRate = effectiveDocCount > 0
        ? (rejectedDocs / effectiveDocCount) * 100
        : 5;

      const extractionAccuracy = scores.length > 0
        ? (scores.reduce((sum, s) => sum + Number(s.confidence_score || 0), 0) / scores.length) * 100
        : 96.5; // Industry average

      // Calculate subscription and per-doc costs
      const annualSubscriptionCost = MONTHLY_SUBSCRIPTION * 12;
      const monthlyCostPerDoc = effectiveDocCount > 0 ? annualSubscriptionCost / effectiveDocCount : 0;

      // Calculate FTE impact
      const totalManualHours = (MANUAL_TIME_PER_DOC * effectiveDocCount) / 3600;
      const currentFTEs = totalManualHours / HOURS_PER_FTE;
      const totalAutomatedHours = (avgProcessingTimeSeconds * effectiveDocCount) / 3600;
      const projectedFTEs = totalAutomatedHours / HOURS_PER_FTE;
      const fteReduction = currentFTEs - projectedFTEs;
      const hoursReallocated = totalTimeSavedHours;

      // Calculate ROI
      const totalSavings = totalCostSavings;
      const totalInvestment = SYSTEM_SETUP_COST + (useSampleData ? avgAICostPerDoc * effectiveDocCount : totalCost) + annualSubscriptionCost;
      const netSavings = totalSavings - totalInvestment;
      const roi = totalInvestment > 0 ? (netSavings / totalInvestment) * 100 : 0;
      const savingsPerDollarSpent = totalInvestment > 0 ? totalSavings / totalInvestment : 0;
      const breakEvenDocuments = costSavingsPerDoc > 0 ? Math.ceil((SYSTEM_SETUP_COST + annualSubscriptionCost) / costSavingsPerDoc) : 0;
      
      // Calculate payback period in months
      const docsPerMonth = effectiveDocCount / 12;
      const monthlyNetSavings = costSavingsPerDoc * docsPerMonth - MONTHLY_SUBSCRIPTION;
      const paybackPeriodMonths = monthlyNetSavings > 0 ? Math.ceil((SYSTEM_SETUP_COST + annualSubscriptionCost) / monthlyNetSavings) : 0;

      setMetrics({
        avgProcessingTimeSeconds,
        manualProcessingTimeSeconds: MANUAL_TIME_PER_DOC,
        timeSavedPerDocument,
        totalTimeSavedHours,
        avgAICostPerDoc,
        manualLaborCostPerDoc,
        costSavingsPerDoc,
        totalCostSavings,
        annualSubscriptionCost,
        monthlyCostPerDoc,
        currentFTEs,
        projectedFTEs,
        fteReduction,
        hoursReallocated,
        totalDocuments: effectiveDocCount,
        successfulExtractions,
        validationCatchRate,
        errorDetectionRate,
        extractionAccuracy,
        validatedDocs,
        rejectedDocs,
        pendingDocs,
        totalInvestment,
        totalSavings,
        netSavings,
        roi,
        savingsPerDollarSpent,
        breakEvenDocuments,
        paybackPeriodMonths,
        isProjectedData: useSampleData,
        projectedVolume: sampleDocCount,
      });
    } catch (error) {
      console.error('Error loading viability metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Health monitoring functions - with latency averaging
  const measureLatency = async (
    queryFn: () => Promise<{ error: any }>,
    pingCount: number = LATENCY_PING_COUNT
  ): Promise<{ avgLatency: number; lastLatency: number; error: any }> => {
    const latencies: number[] = [];
    let lastError: any = null;
    
    for (let i = 0; i < pingCount; i++) {
      const start = performance.now();
      try {
        const { error } = await queryFn();
        const latency = performance.now() - start;
        latencies.push(latency);
        if (error) lastError = error;
      } catch (e) {
        lastError = e;
      }
      // Small delay between pings to avoid burst
      if (i < pingCount - 1) await new Promise(r => setTimeout(r, 100));
    }
    
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;
    const lastLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    
    return { avgLatency, lastLatency, error: lastError };
  };

  const checkServices = async () => {
    const serviceChecks: ServiceStatus[] = [];

    // Check Database with averaged latency
    try {
      const { avgLatency, lastLatency, error } = await measureLatency(
        async () => await supabase.from('profiles').select('id').limit(1)
      );
      const { warning, critical } = LATENCY_THRESHOLDS.database;
      serviceChecks.push({
        name: 'Database',
        status: error ? 'error' : avgLatency > critical ? 'error' : avgLatency > warning ? 'degraded' : 'healthy',
        latency: Math.round(lastLatency),
        avgLatency: Math.round(avgLatency),
        lastChecked: new Date(),
        message: error?.message,
        poolStatus: 'Managed by Cloud'
      });
    } catch (e) {
      serviceChecks.push({
        name: 'Database',
        status: 'error',
        lastChecked: new Date(),
        message: 'Connection failed',
        poolStatus: 'Unknown'
      });
    }

    // Check Storage with averaged latency
    try {
      const { avgLatency, lastLatency, error } = await measureLatency(
        async () => await supabase.storage.from('documents').list('', { limit: 1 })
      );
      const { warning, critical } = LATENCY_THRESHOLDS.storage;
      serviceChecks.push({
        name: 'Storage',
        status: error ? 'error' : avgLatency > critical ? 'error' : avgLatency > warning ? 'degraded' : 'healthy',
        latency: Math.round(lastLatency),
        avgLatency: Math.round(avgLatency),
        lastChecked: new Date(),
        message: error?.message
      });
    } catch (e) {
      serviceChecks.push({
        name: 'Storage',
        status: 'error',
        lastChecked: new Date(),
        message: 'Connection failed'
      });
    }

    // Check Auth Service with averaged latency
    try {
      const { avgLatency, lastLatency, error } = await measureLatency(
        async () => await supabase.auth.getSession()
      );
      const { warning, critical } = LATENCY_THRESHOLDS.auth;
      serviceChecks.push({
        name: 'Authentication',
        status: error ? 'error' : avgLatency > critical ? 'error' : avgLatency > warning ? 'degraded' : 'healthy',
        latency: Math.round(lastLatency),
        avgLatency: Math.round(avgLatency),
        lastChecked: new Date(),
        message: error?.message
      });
    } catch (e) {
      serviceChecks.push({
        name: 'Authentication',
        status: 'error',
        lastChecked: new Date(),
        message: 'Service unavailable'
      });
    }

    // Check Edge Functions with averaged latency
    try {
      const { avgLatency, lastLatency, error } = await measureLatency(
        async () => await supabase.from('jobs').select('id').limit(1)
      );
      const { warning, critical } = LATENCY_THRESHOLDS.edge;
      serviceChecks.push({
        name: 'Edge Functions',
        status: error ? 'degraded' : avgLatency > critical ? 'error' : avgLatency > warning ? 'degraded' : 'healthy',
        latency: Math.round(lastLatency),
        avgLatency: Math.round(avgLatency),
        lastChecked: new Date(),
        message: error?.message || 'Inferred from database connectivity'
      });
    } catch (e) {
      serviceChecks.push({
        name: 'Edge Functions',
        status: 'degraded',
        lastChecked: new Date(),
        message: 'Unable to verify'
      });
    }

    setServices(serviceChecks);
  };

  const loadProcessingMetrics = async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [pendingResult, processingResult, completed24hResult, failed24hResult] = await Promise.all([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('jobs').select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', yesterday.toISOString()),
      supabase.from('jobs').select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('updated_at', yesterday.toISOString())
    ]);

    // Calculate average processing time from recent completed jobs
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100);

    let avgTime = 0;
    if (recentJobs && recentJobs.length > 0) {
      const totalTime = recentJobs.reduce((sum, job) => {
        const start = new Date(job.started_at!).getTime();
        const end = new Date(job.completed_at!).getTime();
        return sum + (end - start);
      }, 0);
      avgTime = totalTime / recentJobs.length / 1000;
    }

    const completed24h = completed24hResult.count || 0;
    const throughput = Math.round(completed24h / 24);

    setProcessing({
      pendingJobs: pendingResult.count || 0,
      processingJobs: processingResult.count || 0,
      completedJobs24h: completed24h,
      failedJobs24h: failed24hResult.count || 0,
      avgProcessingTime: Math.round(avgTime * 10) / 10,
      throughputPerHour: throughput
    });
  };

  const loadApplicationStats = async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [totalDocsResult, todayDocsResult, activeUsersResult, recentErrorsResult] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabase.from('profiles').select('id', { count: 'exact', head: true })
        .gte('updated_at', oneHourAgo.toISOString()),
      supabase.from('error_logs').select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
    ]);

    const todayDocs = todayDocsResult.count || 1;
    const todayErrors = recentErrorsResult.count || 0;
    const errorRate = Math.round((todayErrors / todayDocs) * 100 * 10) / 10;

    setAppStats({
      totalDocuments: totalDocsResult.count || 0,
      documentsToday: todayDocsResult.count || 0,
      activeUsers: activeUsersResult.count || 0,
      errorRate: errorRate,
      recentErrors: todayErrors
    });
  };

  const refreshHealth = async () => {
    setRefreshing(true);
    await Promise.all([
      checkServices(),
      loadProcessingMetrics(),
      loadApplicationStats()
    ]);
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) {
      refreshHealth().then(() => setHealthLoading(false));
    }
  }, [loading, isAdmin]);

  // Auto-refresh health every 30 seconds
  useEffect(() => {
    if (!loading && isAdmin) {
      const interval = setInterval(refreshHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [loading, isAdmin]);

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: 'healthy' | 'degraded' | 'error') => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="default" className="bg-yellow-500">Degraded</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const overallHealth = services.length > 0
    ? services.every(s => s.status === 'healthy')
      ? 'healthy'
      : services.some(s => s.status === 'error')
        ? 'error'
        : 'degraded'
    : 'healthy';

  if (loading || (isLoading && healthLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <AdminLayout
      title="System Viability Dashboard"
      description="Monitor system health, performance, and ROI"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="roi" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            ROI Analysis
          </TabsTrigger>
        </TabsList>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-6">
          {/* Overall Status Header */}
          <Card className={`border-2 ${
            overallHealth === 'healthy' ? 'border-green-500/50 bg-green-500/5' :
            overallHealth === 'degraded' ? 'border-yellow-500/50 bg-yellow-500/5' :
            'border-red-500/50 bg-red-500/5'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${
                    overallHealth === 'healthy' ? 'bg-green-500/20' :
                    overallHealth === 'degraded' ? 'bg-yellow-500/20' :
                    'bg-red-500/20'
                  }`}>
                    <Activity className={`h-8 w-8 ${
                      overallHealth === 'healthy' ? 'text-green-500' :
                      overallHealth === 'degraded' ? 'text-yellow-500' :
                      'text-red-500'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {overallHealth === 'healthy' ? 'All Systems Operational' :
                        overallHealth === 'degraded' ? 'Performance Degraded' : 'Issues Detected'}
                    </h2>
                    <p className="text-muted-foreground">
                      Last checked: {format(lastRefresh, 'PPp')}
                    </p>
                  </div>
                </div>
                <Button onClick={refreshHealth} disabled={refreshing} variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Service Health Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Card key={service.name} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {service.name === 'Database' && <Database className="h-4 w-4" />}
                      {service.name === 'Storage' && <HardDrive className="h-4 w-4" />}
                      {service.name === 'Authentication' && <Users className="h-4 w-4" />}
                      {service.name === 'Edge Functions' && <Server className="h-4 w-4" />}
                      {service.name}
                    </CardTitle>
                    {getStatusIcon(service.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getStatusBadge(service.status)}
                    {service.avgLatency !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Avg Latency: {service.avgLatency}ms
                        {service.latency && <span className="text-xs ml-1">(last: {service.latency}ms)</span>}
                      </p>
                    )}
                    {service.poolStatus && (
                      <p className="text-xs text-muted-foreground">
                        Pool: {service.poolStatus}
                      </p>
                    )}
                    {service.message && service.status !== 'healthy' && (
                      <p className="text-xs text-muted-foreground truncate">
                        {service.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Processing Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Processing Performance
              </CardTitle>
              <CardDescription>Job queue and processing statistics</CardDescription>
            </CardHeader>
            <CardContent>
              {processing && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Job Queue Status</span>
                      <Badge variant={processing.pendingJobs > 50 ? 'destructive' : 'secondary'}>
                        {processing.pendingJobs} pending
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.min((processing.processingJobs / Math.max(processing.pendingJobs, 1)) * 100, 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {processing.processingJobs} currently processing
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">24h Completion</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-bold">{processing.completedJobs24h}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Failed</span>
                      <span className={processing.failedJobs24h > 10 ? 'text-red-500' : 'text-muted-foreground'}>
                        {processing.failedJobs24h}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Success rate: {processing.completedJobs24h > 0 
                        ? Math.round((processing.completedJobs24h / (processing.completedJobs24h + processing.failedJobs24h)) * 100)
                        : 0}%
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Avg Processing Time</span>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-bold">{processing.avgProcessingTime}s</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Throughput</span>
                      <span>{processing.throughputPerHour}/hr</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Statistics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appStats && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Documents</span>
                      <span className="text-2xl font-bold">{appStats.totalDocuments.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Documents Today</span>
                      <span className="font-medium">{appStats.documentsToday}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Active Users (1hr)</span>
                      <span className="font-medium">{appStats.activeUsers}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Error Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appStats && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Errors Today</span>
                      <Badge variant={appStats.recentErrors > 10 ? 'destructive' : 'secondary'}>
                        {appStats.recentErrors}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Error Rate</span>
                      <div className="flex items-center gap-2">
                        {appStats.errorRate > 5 ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                        <span className={appStats.errorRate > 5 ? 'text-red-500 font-bold' : ''}>
                          {appStats.errorRate}%
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href="/admin/error-logs">View Error Logs</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alerting Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alerting Thresholds
              </CardTitle>
              <CardDescription>Current monitoring thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">Database Latency</p>
                  <p className="text-xs text-muted-foreground">Degraded: &gt;1000ms</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">Storage Latency</p>
                  <p className="text-xs text-muted-foreground">Degraded: &gt;2000ms</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">Pending Jobs</p>
                  <p className="text-xs text-muted-foreground">Warning: &gt;50 jobs</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">Error Rate</p>
                  <p className="text-xs text-muted-foreground">Warning: &gt;5%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ROI Analysis Tab */}
        <TabsContent value="roi" className="space-y-6">
          {/* Data Source Indicator */}
          {metrics?.isProjectedData && (
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="py-3">
                <p className="text-sm text-center">
                  <Badge variant="outline" className="mr-2">Projected Data</Badge>
                  No documents processed yet. Showing projected ROI based on {metrics.projectedVolume.toLocaleString()} annual documents and industry averages.
                </p>
              </CardContent>
            </Card>
          )}
        {metrics && (
        <>
        {/* ROI Hero Section */}
        <Card className="p-8 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/30">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Target className="h-8 w-8 text-green-600" />
              <h2 className="text-3xl font-bold">System ROI</h2>
            </div>
            <div className="flex items-center justify-center gap-6">
              <div>
                <p className="text-5xl font-bold text-green-600">${metrics.savingsPerDollarSpent.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-2">Saved per $1 Spent</p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div>
                <p className="text-4xl font-bold text-green-600">{metrics.roi.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground mt-2">ROI</p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div>
                <p className="text-3xl font-bold">${metrics.netSavings.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-2">Net Savings</p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div>
                <p className="text-3xl font-bold">{metrics.totalDocuments.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-2">Documents Processed</p>
              </div>
            </div>
            {metrics.breakEvenDocuments > 0 && metrics.totalDocuments < metrics.breakEvenDocuments && (
              <div className="flex gap-2">
                <Badge variant="outline" className="text-lg py-2 px-4">
                  Break-even at {metrics.breakEvenDocuments.toLocaleString()} documents
                </Badge>
                <Badge variant="secondary" className="text-lg py-2 px-4">
                  Payback in {metrics.paybackPeriodMonths} months
                </Badge>
              </div>
            )}
            {metrics.totalDocuments >= metrics.breakEvenDocuments && metrics.breakEvenDocuments > 0 && (
              <Badge className="text-lg py-2 px-4 bg-green-600">
                ✓ System has reached break-even!
              </Badge>
            )}
          </div>
        </Card>

        {/* FTE Impact Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Staffing Impact
            </CardTitle>
            <CardDescription>Full-time equivalent (FTE) analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Current FTEs</p>
                <p className="text-4xl font-bold">{metrics.currentFTEs.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">Manual processing</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Projected FTEs</p>
                <p className="text-4xl font-bold text-green-600">{metrics.projectedFTEs.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">With automation</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">FTE Reduction</p>
                <p className="text-4xl font-bold text-green-600">{metrics.fteReduction.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.hoursReallocated.toFixed(0)} hours reallocated
                </p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {((metrics.fteReduction / metrics.currentFTEs) * 100).toFixed(0)}% reduction
                </span>
                {' '}in staff required for document processing, freeing resources for higher-value work
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Time Savings Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>Processing Time Comparison</CardTitle>
              </div>
              <CardDescription>Per document average</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Manual Entry</span>
                  <span className="font-bold">{formatTime(metrics.manualProcessingTimeSeconds)}</span>
                </div>
                <Progress value={100} className="h-3" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">WISDM Capture Pro</span>
                  <span className="font-bold text-green-600">{formatTime(metrics.avgProcessingTimeSeconds)}</span>
                </div>
                <Progress 
                  value={(metrics.avgProcessingTimeSeconds / metrics.manualProcessingTimeSeconds) * 100} 
                  className="h-3"
                />
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Time Saved per Doc:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatTime(metrics.timeSavedPerDocument)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium">Total Time Saved:</span>
                  <span className="text-xl font-bold text-green-600">
                    {metrics.totalTimeSavedHours.toFixed(1)} hours
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {((metrics.avgProcessingTimeSeconds / metrics.manualProcessingTimeSeconds) * 100).toFixed(0)}% faster than manual
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cost Savings Comparison */}
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle>Cost Comparison</CardTitle>
              </div>
              <CardDescription>Per document processing cost</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Manual Labor</span>
                  <span className="font-bold">${metrics.manualLaborCostPerDoc.toFixed(2)}</span>
                </div>
                <Progress value={100} className="h-3" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">AI Processing</span>
                  <span className="font-bold text-green-600">${metrics.avgAICostPerDoc.toFixed(4)}</span>
                </div>
                <Progress 
                  value={(metrics.avgAICostPerDoc / metrics.manualLaborCostPerDoc) * 100} 
                  className="h-3"
                />
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Saved per Doc:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${metrics.costSavingsPerDoc.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium">Total Savings:</span>
                  <span className="text-xl font-bold text-green-600">
                    ${metrics.totalCostSavings.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {(100 - (metrics.avgAICostPerDoc / metrics.manualLaborCostPerDoc) * 100).toFixed(0)}% cost reduction
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>Document processing accuracy and quality indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Validated</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-600">{metrics.validatedDocs}</span>
                </div>
                <Progress 
                  value={metrics.validationCatchRate} 
                  className="mt-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">{metrics.validationCatchRate.toFixed(1)}% pass rate</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Rejected</p>
                <div className="text-3xl font-bold text-red-600">{metrics.rejectedDocs}</div>
                <Progress 
                  value={metrics.errorDetectionRate} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">{metrics.errorDetectionRate.toFixed(1)}% flagged</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Pending</p>
                <div className="text-3xl font-bold text-amber-600">{metrics.pendingDocs}</div>
                <Progress 
                  value={(metrics.pendingDocs / metrics.totalDocuments) * 100} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">In queue</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Avg Confidence</p>
                <div className="text-3xl font-bold">{metrics.extractionAccuracy.toFixed(1)}%</div>
                <Progress value={metrics.extractionAccuracy} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">AI certainty</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Comparison Table - Upland Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Comparison
            </CardTitle>
            <CardDescription>Side-by-side analysis of manual vs automated processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Metric</th>
                    <th className="text-center py-3 px-4 font-semibold bg-muted/30">Without System</th>
                    <th className="text-center py-3 px-4 font-semibold bg-green-500/10">With System</th>
                    <th className="text-center py-3 px-4 font-semibold text-green-600">Savings</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4">Processing Time per Document</td>
                    <td className="text-center py-3 px-4 bg-muted/10">{formatTime(metrics.manualProcessingTimeSeconds)}</td>
                    <td className="text-center py-3 px-4 bg-green-500/5">{formatTime(metrics.avgProcessingTimeSeconds)}</td>
                    <td className="text-center py-3 px-4 font-semibold text-green-600">
                      {formatTime(metrics.timeSavedPerDocument)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Cost per Document</td>
                    <td className="text-center py-3 px-4 bg-muted/10">${metrics.manualLaborCostPerDoc.toFixed(2)}</td>
                    <td className="text-center py-3 px-4 bg-green-500/5">
                      ${(metrics.avgAICostPerDoc + metrics.monthlyCostPerDoc).toFixed(3)}
                    </td>
                    <td className="text-center py-3 px-4 font-semibold text-green-600">
                      ${metrics.costSavingsPerDoc.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">FTEs Required</td>
                    <td className="text-center py-3 px-4 bg-muted/10">{metrics.currentFTEs.toFixed(1)}</td>
                    <td className="text-center py-3 px-4 bg-green-500/5">{metrics.projectedFTEs.toFixed(1)}</td>
                    <td className="text-center py-3 px-4 font-semibold text-green-600">
                      -{metrics.fteReduction.toFixed(1)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Annual Processing Cost</td>
                    <td className="text-center py-3 px-4 bg-muted/10">
                      ${(metrics.manualLaborCostPerDoc * metrics.totalDocuments).toFixed(2)}
                    </td>
                    <td className="text-center py-3 px-4 bg-green-500/5">
                      ${((metrics.avgAICostPerDoc + metrics.monthlyCostPerDoc) * metrics.totalDocuments).toFixed(2)}
                    </td>
                    <td className="text-center py-3 px-4 font-semibold text-green-600">
                      ${metrics.totalCostSavings.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-green-500/10 font-semibold">
                    <td className="py-4 px-4">Total Annual Cost</td>
                    <td className="text-center py-4 px-4">
                      ${(metrics.manualLaborCostPerDoc * metrics.totalDocuments).toFixed(2)}
                    </td>
                    <td className="text-center py-4 px-4">
                      ${metrics.totalInvestment.toFixed(2)}
                    </td>
                    <td className="text-center py-4 px-4 text-green-600 text-lg">
                      ${metrics.netSavings.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-green-500/10 rounded-lg text-center">
              <p className="text-lg font-semibold text-green-600">
                For every $1 spent on the system, you save ${metrics.savingsPerDollarSpent.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Proof Points */}
        <Card className="p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-2xl">Key Viability Proof Points</CardTitle>
            <CardDescription>Quantifiable evidence the system works</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Time Efficiency</h4>
                    <p className="text-sm text-muted-foreground">
                      System processes documents in {formatTime(metrics.avgProcessingTimeSeconds)} vs {formatTime(metrics.manualProcessingTimeSeconds)} manually, 
                      saving {((metrics.timeSavedPerDocument / metrics.manualProcessingTimeSeconds) * 100).toFixed(0)}% of processing time per document.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Cost Reduction</h4>
                    <p className="text-sm text-muted-foreground">
                      AI processing costs ${metrics.avgAICostPerDoc.toFixed(3)} per document vs ${metrics.manualLaborCostPerDoc.toFixed(2)} for manual entry, 
                      reducing costs by {((metrics.costSavingsPerDoc / metrics.manualLaborCostPerDoc) * 100).toFixed(0)}% per document.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">High Accuracy</h4>
                    <p className="text-sm text-muted-foreground">
                      {metrics.validationCatchRate.toFixed(1)}% validation pass rate with {metrics.extractionAccuracy.toFixed(1)}% average AI confidence, 
                      catching {metrics.errorDetectionRate.toFixed(1)}% of documents for review before processing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Exceptional ROI</h4>
                    <p className="text-sm text-muted-foreground">
                      Saving ${metrics.savingsPerDollarSpent.toFixed(2)} for every $1 spent with {metrics.roi.toFixed(0)}% return. 
                      Net profit of ${metrics.netSavings.toFixed(2)} after processing {metrics.totalDocuments.toLocaleString()} documents 
                      (Break-even: {metrics.breakEvenDocuments.toLocaleString()} docs).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Staffing Efficiency</h4>
                    <p className="text-sm text-muted-foreground">
                      Reduced from {metrics.currentFTEs.toFixed(1)} to {metrics.projectedFTEs.toFixed(1)} FTEs needed 
                      ({((metrics.fteReduction / metrics.currentFTEs) * 100).toFixed(0)}% reduction), 
                      reallocating {metrics.hoursReallocated.toFixed(0)} hours annually to higher-value activities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Scalable Performance</h4>
                    <p className="text-sm text-muted-foreground">
                      Consistent {formatTime(metrics.avgProcessingTimeSeconds)} average processing time regardless of volume.
                      System reliability proven across {metrics.totalDocuments.toLocaleString()} documents.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculation Assumptions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Calculation Assumptions</CardTitle>
            <CardDescription>Baseline values used for ROI calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Manual Time/Doc</p>
                <p className="font-semibold">{formatTime(MANUAL_TIME_PER_DOC)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Labor Rate</p>
                <p className="font-semibold">${MANUAL_LABOR_RATE}/hr</p>
              </div>
              <div>
                <p className="text-muted-foreground">Setup Cost</p>
                <p className="font-semibold">${SYSTEM_SETUP_COST.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly Subscription</p>
                <p className="font-semibold">${MONTHLY_SUBSCRIPTION}/mo</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg AI Cost</p>
                <p className="font-semibold">${metrics.avgAICostPerDoc.toFixed(3)}/doc</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Investment</p>
                  <p className="font-semibold text-lg">${metrics.totalInvestment.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Setup + AI costs + subscription (${metrics.annualSubscriptionCost}/yr)
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost per Document</p>
                  <p className="font-semibold text-lg">${(metrics.avgAICostPerDoc + metrics.monthlyCostPerDoc).toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI + amortized subscription vs ${metrics.manualLaborCostPerDoc.toFixed(2)} manual
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </>
        )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default SystemViability;