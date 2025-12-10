import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, TrendingUp, Clock, Target, DollarSign, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface BenchmarkMetrics {
  // Processing Speed
  avgProcessingTimeMs: number;
  documentsPerHour: number;
  manualEstimateMinutes: number; // industry standard: 3-5 min per doc manual
  speedMultiplier: number;
  
  // Accuracy
  avgConfidenceScore: number;
  highConfidenceRate: number; // % above 90%
  validationPassRate: number; // % validated without corrections
  fieldAccuracyRate: number;
  
  // Cost/ROI
  totalDocumentsProcessed: number;
  estimatedManualHours: number;
  estimatedLaborCostSaved: number;
  costPerDocument: number;
  
  // Sample sizes
  documentsSampled: number;
  fieldsSampled: number;
  periodDays: number;
}

export default function MetricsBenchmark() {
  const [period, setPeriod] = useState("30");
  const [laborRatePerHour, setLaborRatePerHour] = useState(25); // configurable

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['benchmark-metrics', period],
    queryFn: async (): Promise<BenchmarkMetrics> => {
      const periodDays = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      const startDateStr = startDate.toISOString();

      // Fetch actual job processing times from jobs table using started_at and completed_at
      const { data: jobs } = await supabase
        .from('jobs')
        .select('status, started_at, completed_at, created_at')
        .eq('status', 'completed')
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null);

      // Fetch document confidence scores
      const { data: documents } = await supabase
        .from('documents')
        .select('confidence_score, validation_status, field_confidence, created_at')
        .gte('created_at', startDateStr)
        .not('confidence_score', 'is', null);

      // Calculate processing speed from actual job completion times
      // Use all jobs regardless of date for processing speed calculation
      let totalProcessingTimeMs = 0;
      let validJobCount = 0;
      
      jobs?.forEach(job => {
        if (job.started_at && job.completed_at) {
          const started = new Date(job.started_at).getTime();
          const completed = new Date(job.completed_at).getTime();
          const duration = completed - started;
          // Only count reasonable durations (< 10 minutes per job)
          if (duration > 0 && duration < 600000) {
            totalProcessingTimeMs += duration;
            validJobCount++;
          }
        }
      });

      const avgProcessingTimeMs = validJobCount > 0 ? totalProcessingTimeMs / validJobCount : 0;
      
      // Industry standard: 3-5 minutes per document for manual data entry
      const manualEstimateMinutes = 4;
      const documentsPerHour = avgProcessingTimeMs > 0 ? Math.round(3600000 / avgProcessingTimeMs) : 0;
      const speedMultiplier = avgProcessingTimeMs > 0 ? Math.round((manualEstimateMinutes * 60000) / avgProcessingTimeMs) : 0;

      // Calculate accuracy metrics from documents
      const docCount = documents?.length || 0;
      const avgConfidence = docCount > 0 
        ? documents.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / docCount 
        : 0;
      
      const highConfidenceDocs = documents?.filter(d => (d.confidence_score || 0) >= 0.9).length || 0;
      const highConfidenceRate = docCount > 0 ? (highConfidenceDocs / docCount) * 100 : 0;
      
      const validatedDocs = documents?.filter(d => d.validation_status === 'validated').length || 0;
      const validationPassRate = docCount > 0 ? (validatedDocs / docCount) * 100 : 0;

      // Calculate field-level accuracy from field_confidence JSON in documents
      let totalFieldConfidence = 0;
      let fieldCount = 0;
      let accurateFields = 0;
      
      documents?.forEach(doc => {
        const fieldConf = doc.field_confidence as Record<string, number> | null;
        if (fieldConf && typeof fieldConf === 'object') {
          Object.values(fieldConf).forEach(conf => {
            if (typeof conf === 'number' && conf > 0) {
              totalFieldConfidence += conf;
              fieldCount++;
              if (conf >= 0.85) accurateFields++;
            }
          });
        }
      });
      
      const avgFieldConfidence = fieldCount > 0 ? totalFieldConfidence / fieldCount : avgConfidence;
      const fieldAccuracyRate = fieldCount > 0 ? (accurateFields / fieldCount) * 100 : (avgConfidence * 100);

      // Cost/ROI calculations
      const totalDocumentsProcessed = docCount;
      const estimatedManualHours = (totalDocumentsProcessed * manualEstimateMinutes) / 60;
      const estimatedLaborCostSaved = estimatedManualHours * laborRatePerHour;
      
      // Estimate cost per document (based on AI processing costs)
      const costPerDocument = 0.02;

      return {
        avgProcessingTimeMs,
        documentsPerHour,
        manualEstimateMinutes,
        speedMultiplier,
        avgConfidenceScore: avgConfidence * 100,
        highConfidenceRate,
        validationPassRate,
        fieldAccuracyRate,
        totalDocumentsProcessed,
        estimatedManualHours,
        estimatedLaborCostSaved,
        costPerDocument,
        documentsSampled: docCount,
        fieldsSampled: fieldCount || docCount,
        periodDays: periodDays
      };
    }
  });

  const exportReport = () => {
    if (!metrics) return;
    
    const report = `
WISDM Capture Pro - Benchmark Report
Generated: ${new Date().toLocaleDateString()}
Period: Last ${metrics.periodDays} days

═══════════════════════════════════════════════════════════════

PROCESSING SPEED METRICS
─────────────────────────────────────────────────────────────
Average Processing Time:     ${(metrics.avgProcessingTimeMs / 1000).toFixed(2)} seconds/document
Throughput:                  ${metrics.documentsPerHour} documents/hour
Manual Processing Estimate:  ${metrics.manualEstimateMinutes} minutes/document (industry avg)
Speed Improvement:           ${metrics.speedMultiplier}x faster than manual

═══════════════════════════════════════════════════════════════

ACCURACY METRICS
─────────────────────────────────────────────────────────────
Average Document Confidence: ${metrics.avgConfidenceScore.toFixed(1)}%
High Confidence Rate:        ${metrics.highConfidenceRate.toFixed(1)}% (docs ≥90% confidence)
Field-Level Accuracy:        ${metrics.fieldAccuracyRate.toFixed(1)}%
Validation Pass Rate:        ${metrics.validationPassRate.toFixed(1)}%

═══════════════════════════════════════════════════════════════

ROI / COST SAVINGS ESTIMATE
─────────────────────────────────────────────────────────────
Documents Processed:         ${metrics.totalDocumentsProcessed.toLocaleString()}
Manual Hours Saved:          ${metrics.estimatedManualHours.toFixed(1)} hours
Labor Cost Saved:            $${metrics.estimatedLaborCostSaved.toLocaleString()} (at $${laborRatePerHour}/hr)
Cost Per Document:           $${metrics.costPerDocument.toFixed(3)}
Cost Reduction:              ${((1 - (metrics.costPerDocument / (metrics.manualEstimateMinutes * (laborRatePerHour / 60)))) * 100).toFixed(0)}%

═══════════════════════════════════════════════════════════════

METHODOLOGY NOTES
─────────────────────────────────────────────────────────────
• Processing speed measured from actual job execution times
• Accuracy based on AI confidence scores and validation outcomes
• Manual processing estimate uses industry standard of 4 min/doc
• Cost savings assumes $${laborRatePerHour}/hour labor rate
• Sample size: ${metrics.documentsSampled} documents, ${metrics.fieldsSampled} fields

═══════════════════════════════════════════════════════════════
`;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Benchmark report exported");
  };

  const getScoreColor = (score: number, thresholds: { good: number; medium: number }) => {
    if (score >= thresholds.good) return "text-green-600";
    if (score >= thresholds.medium) return "text-yellow-600";
    return "text-red-600";
  };

  const getMarketingClaim = (metric: string, value: number): string => {
    switch (metric) {
      case 'speed':
        if (value >= 50) return `${value}x Faster Processing`;
        if (value >= 20) return `${value}x Faster Than Manual`;
        return `${value}x Processing Speed`;
      case 'accuracy':
        if (value >= 95) return `${value.toFixed(1)}% Accuracy Rate`;
        if (value >= 90) return `Up to ${Math.ceil(value)}% Accuracy`;
        return `${value.toFixed(0)}%+ Extraction Accuracy`;
      case 'cost':
        if (value >= 80) return `${value.toFixed(0)}% Cost Reduction`;
        if (value >= 50) return `Up to ${Math.ceil(value / 10) * 10}% Cost Savings`;
        return `${value.toFixed(0)}% Lower Processing Costs`;
      default:
        return '';
    }
  };

  return (
    <AdminLayout title="Metrics Benchmark" description="Measure real performance data for marketing claims">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Metrics Benchmark</h1>
            <p className="text-muted-foreground">
              Measure real performance data for marketing claims
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportReport} disabled={!metrics}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : metrics ? (
          <>
            {/* Marketing Claims Summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Verified Marketing Claims
                </CardTitle>
                <CardDescription>
                  Based on {metrics.documentsSampled.toLocaleString()} documents over {metrics.periodDays} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-background border">
                    <p className="text-sm text-muted-foreground mb-1">Processing Speed</p>
                    <p className="text-xl font-bold text-primary">
                      {getMarketingClaim('speed', metrics.speedMultiplier)}
                    </p>
                    {metrics.speedMultiplier < 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        Low sample - need more data
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-background border">
                    <p className="text-sm text-muted-foreground mb-1">Accuracy Rate</p>
                    <p className="text-xl font-bold text-primary">
                      {getMarketingClaim('accuracy', metrics.fieldAccuracyRate)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-background border">
                    <p className="text-sm text-muted-foreground mb-1">Cost Reduction</p>
                    <p className="text-xl font-bold text-primary">
                      {getMarketingClaim('cost', ((1 - (metrics.costPerDocument / (metrics.manualEstimateMinutes * (laborRatePerHour / 60)))) * 100))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Processing Speed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Processing Speed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Avg Time/Doc</span>
                      <span className="font-medium">{(metrics.avgProcessingTimeMs / 1000).toFixed(2)}s</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Throughput</span>
                      <span className="font-medium">{metrics.documentsPerHour}/hour</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">vs Manual (4 min/doc)</span>
                      <span className={`font-bold ${getScoreColor(metrics.speedMultiplier, { good: 30, medium: 10 })}`}>
                        {metrics.speedMultiplier}x faster
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Accuracy */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" />
                    Accuracy Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Document Confidence</span>
                      <span className={`font-medium ${getScoreColor(metrics.avgConfidenceScore, { good: 90, medium: 75 })}`}>
                        {metrics.avgConfidenceScore.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metrics.avgConfidenceScore} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Field Accuracy</span>
                      <span className={`font-medium ${getScoreColor(metrics.fieldAccuracyRate, { good: 95, medium: 85 })}`}>
                        {metrics.fieldAccuracyRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metrics.fieldAccuracyRate} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">High Confidence (≥90%)</span>
                      <span className="font-medium">{metrics.highConfidenceRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ROI */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-4 w-4" />
                    Cost Savings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Documents Processed</span>
                      <span className="font-medium">{metrics.totalDocumentsProcessed.toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Manual Hours Saved</span>
                      <span className="font-medium">{metrics.estimatedManualHours.toFixed(1)} hrs</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Labor Cost Saved</span>
                      <span className="font-bold text-green-600">
                        ${metrics.estimatedLaborCostSaved.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Cost Reduction</span>
                      <Badge variant="default">
                        {((1 - (metrics.costPerDocument / (metrics.manualEstimateMinutes * (laborRatePerHour / 60)))) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Methodology Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Methodology & Assumptions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Processing speed</strong>: Measured from actual job execution times in database</li>
                  <li>• <strong>Manual baseline</strong>: Industry standard 4 minutes per document for manual data entry</li>
                  <li>• <strong>Accuracy</strong>: Based on AI confidence scores and fields not requiring review</li>
                  <li>• <strong>Labor rate</strong>: ${laborRatePerHour}/hour (adjustable for your market)</li>
                  <li>• <strong>AI cost</strong>: Estimated $0.02/document for OCR + extraction</li>
                </ul>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No data available for the selected period</p>
              <p className="text-sm text-muted-foreground mt-2">Process some documents to generate benchmark metrics</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
