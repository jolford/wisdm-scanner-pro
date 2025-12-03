import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Settings,
  RefreshCw,
  Target
} from "lucide-react";
import { format, subHours, subDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SLAConfig {
  maxProcessingTimeSeconds: number;
  maxValidationTimeSeconds: number;
  maxExportTimeSeconds: number;
  targetThroughputPerHour: number;
  warningThresholdPercent: number;
}

interface SLAMetrics {
  avgProcessingTime: number;
  avgValidationTime: number;
  avgExportTime: number;
  throughputPerHour: number;
  slaComplianceRate: number;
  breachCount24h: number;
  totalProcessed24h: number;
  pendingJobs: number;
  processingJobs: number;
}

interface SLABreach {
  id: string;
  type: 'processing' | 'validation' | 'export' | 'throughput';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  value: number;
  threshold: number;
}

const DEFAULT_SLA_CONFIG: SLAConfig = {
  maxProcessingTimeSeconds: 120, // 2 minutes
  maxValidationTimeSeconds: 300, // 5 minutes
  maxExportTimeSeconds: 60, // 1 minute
  targetThroughputPerHour: 100,
  warningThresholdPercent: 80
};

export function SLAMonitoring() {
  const [config, setConfig] = useState<SLAConfig>(DEFAULT_SLA_CONFIG);
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [breaches, setBreaches] = useState<SLABreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<SLAConfig>(DEFAULT_SLA_CONFIG);

  useEffect(() => {
    loadSLAData();
    const interval = setInterval(loadSLAData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [config]);

  const loadSLAData = async () => {
    try {
      const now = new Date();
      const yesterday = subDays(now, 1);

      // Get job metrics for last 24 hours
      const { data: completedJobs } = await supabase
        .from('jobs')
        .select('started_at, completed_at, status, job_type')
        .eq('status', 'completed')
        .gte('completed_at', yesterday.toISOString());

      const { data: pendingJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('status', 'pending');

      const { data: processingJobs } = await supabase
        .from('jobs')
        .select('id, started_at')
        .eq('status', 'processing');

      // Calculate processing times
      const processingTimes: number[] = [];
      let breachList: SLABreach[] = [];

      (completedJobs || []).forEach(job => {
        if (job.started_at && job.completed_at) {
          const duration = (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000;
          processingTimes.push(duration);

          // Check for SLA breaches
          if (duration > config.maxProcessingTimeSeconds) {
            breachList.push({
              id: `proc-${job.started_at}`,
              type: 'processing',
              severity: duration > config.maxProcessingTimeSeconds * 1.5 ? 'critical' : 'warning',
              message: `Processing took ${Math.round(duration)}s (limit: ${config.maxProcessingTimeSeconds}s)`,
              timestamp: new Date(job.completed_at),
              value: duration,
              threshold: config.maxProcessingTimeSeconds
            });
          }
        }
      });

      // Check currently processing jobs for potential breaches
      (processingJobs || []).forEach(job => {
        if (job.started_at) {
          const duration = (now.getTime() - new Date(job.started_at).getTime()) / 1000;
          const warningThreshold = config.maxProcessingTimeSeconds * (config.warningThresholdPercent / 100);
          
          if (duration > warningThreshold) {
            breachList.push({
              id: `active-${job.id}`,
              type: 'processing',
              severity: duration > config.maxProcessingTimeSeconds ? 'critical' : 'warning',
              message: `Active job running for ${Math.round(duration)}s`,
              timestamp: new Date(job.started_at),
              value: duration,
              threshold: config.maxProcessingTimeSeconds
            });
          }
        }
      });

      // Calculate metrics
      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      const totalProcessed24h = completedJobs?.length || 0;
      const throughputPerHour = Math.round(totalProcessed24h / 24);

      // Check throughput SLA
      if (throughputPerHour < config.targetThroughputPerHour * (config.warningThresholdPercent / 100)) {
        breachList.push({
          id: 'throughput-breach',
          type: 'throughput',
          severity: throughputPerHour < config.targetThroughputPerHour * 0.5 ? 'critical' : 'warning',
          message: `Throughput ${throughputPerHour}/hr below target ${config.targetThroughputPerHour}/hr`,
          timestamp: now,
          value: throughputPerHour,
          threshold: config.targetThroughputPerHour
        });
      }

      // Calculate SLA compliance rate
      const compliantJobs = processingTimes.filter(t => t <= config.maxProcessingTimeSeconds).length;
      const slaComplianceRate = processingTimes.length > 0
        ? (compliantJobs / processingTimes.length) * 100
        : 100;

      setMetrics({
        avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
        avgValidationTime: 0, // Would need validation-specific tracking
        avgExportTime: 0, // Would need export-specific tracking
        throughputPerHour,
        slaComplianceRate: Math.round(slaComplianceRate * 10) / 10,
        breachCount24h: breachList.filter(b => b.severity === 'critical').length,
        totalProcessed24h,
        pendingJobs: pendingJobs?.length || 0,
        processingJobs: processingJobs?.length || 0
      });

      // Sort breaches by timestamp descending and limit to recent
      breachList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setBreaches(breachList.slice(0, 20));

    } catch (error) {
      console.error('Error loading SLA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = () => {
    setConfig(tempConfig);
    setConfigOpen(false);
    toast.success('SLA configuration updated');
  };

  const getSLAStatusColor = (complianceRate: number) => {
    if (complianceRate >= 95) return 'text-green-500';
    if (complianceRate >= 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSLAStatusBadge = (complianceRate: number) => {
    if (complianceRate >= 95) return <Badge className="bg-green-500/10 text-green-500">Healthy</Badge>;
    if (complianceRate >= 80) return <Badge className="bg-yellow-500/10 text-yellow-500">At Risk</Badge>;
    return <Badge className="bg-red-500/10 text-red-500">Breached</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Config */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SLA Monitoring</h3>
          <p className="text-sm text-muted-foreground">
            Real-time service level agreement tracking
          </p>
        </div>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure SLA
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>SLA Configuration</DialogTitle>
              <DialogDescription>
                Set thresholds for processing time, throughput, and alerts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Max Processing Time (seconds)</Label>
                <Input
                  type="number"
                  value={tempConfig.maxProcessingTimeSeconds}
                  onChange={(e) => setTempConfig({ ...tempConfig, maxProcessingTimeSeconds: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Validation Time (seconds)</Label>
                <Input
                  type="number"
                  value={tempConfig.maxValidationTimeSeconds}
                  onChange={(e) => setTempConfig({ ...tempConfig, maxValidationTimeSeconds: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Throughput (docs/hour)</Label>
                <Input
                  type="number"
                  value={tempConfig.targetThroughputPerHour}
                  onChange={(e) => setTempConfig({ ...tempConfig, targetThroughputPerHour: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Warning Threshold (%)</Label>
                <Input
                  type="number"
                  min="50"
                  max="99"
                  value={tempConfig.warningThresholdPercent}
                  onChange={(e) => setTempConfig({ ...tempConfig, warningThresholdPercent: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
              <Button onClick={saveConfig}>Save Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall SLA Status */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Overall SLA Compliance</CardTitle>
            {metrics && getSLAStatusBadge(metrics.slaComplianceRate)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${metrics ? getSLAStatusColor(metrics.slaComplianceRate) : ''}`}>
              {metrics?.slaComplianceRate || 0}%
            </div>
            <Progress 
              value={metrics?.slaComplianceRate || 0} 
              className="flex-1 h-3"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {metrics?.totalProcessed24h || 0} documents processed in last 24 hours
          </p>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing Time</p>
                <p className="text-2xl font-bold">{metrics?.avgProcessingTime || 0}s</p>
              </div>
              <Clock className={`h-8 w-8 ${
                (metrics?.avgProcessingTime || 0) <= config.maxProcessingTimeSeconds 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Target: &lt;{config.maxProcessingTimeSeconds}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Throughput</p>
                <p className="text-2xl font-bold">{metrics?.throughputPerHour || 0}/hr</p>
              </div>
              <TrendingUp className={`h-8 w-8 ${
                (metrics?.throughputPerHour || 0) >= config.targetThroughputPerHour 
                  ? 'text-green-500' 
                  : 'text-yellow-500'
              }`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Target: {config.targetThroughputPerHour}/hr
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Queue Depth</p>
                <p className="text-2xl font-bold">{metrics?.pendingJobs || 0}</p>
              </div>
              <Target className={`h-8 w-8 ${
                (metrics?.pendingJobs || 0) < 50 
                  ? 'text-green-500' 
                  : 'text-yellow-500'
              }`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics?.processingJobs || 0} currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA Breaches (24h)</p>
                <p className="text-2xl font-bold">{metrics?.breachCount24h || 0}</p>
              </div>
              {(metrics?.breachCount24h || 0) === 0 ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Critical violations requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Breaches */}
      {breaches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent SLA Events</CardTitle>
            <CardDescription>Warnings and violations from the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {breaches.map((breach) => (
                <div 
                  key={breach.id} 
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    breach.severity === 'critical' 
                      ? 'bg-red-500/10 border border-red-500/20' 
                      : 'bg-yellow-500/10 border border-yellow-500/20'
                  }`}
                >
                  {breach.severity === 'critical' ? (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{breach.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(breach.timestamp, 'MMM d, h:mm a')} • {breach.type}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(breach.value)}/{breach.threshold}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SLA Thresholds Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current SLA Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Processing</p>
              <p className="font-medium">&lt; {config.maxProcessingTimeSeconds}s</p>
            </div>
            <div>
              <p className="text-muted-foreground">Validation</p>
              <p className="font-medium">&lt; {config.maxValidationTimeSeconds}s</p>
            </div>
            <div>
              <p className="text-muted-foreground">Export</p>
              <p className="font-medium">&lt; {config.maxExportTimeSeconds}s</p>
            </div>
            <div>
              <p className="text-muted-foreground">Throughput</p>
              <p className="font-medium">≥ {config.targetThroughputPerHour}/hr</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
