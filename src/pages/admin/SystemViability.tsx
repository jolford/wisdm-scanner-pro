import { useRequireAuth } from "@/hooks/use-require-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  Target,
  Zap,
  ShieldCheck,
  Activity
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

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
  roi: number;
  breakEvenDocuments: number;
  paybackPeriodMonths: number;
}

const SystemViability = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [metrics, setMetrics] = useState<ViabilityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Constants for calculations (now visible to users)
  const MANUAL_TIME_PER_DOC = 300; // 5 minutes in seconds
  const MANUAL_LABOR_RATE = 25; // $25/hour (realistic data entry rate)
  const SYSTEM_SETUP_COST = 2500; // One-time setup cost (training, implementation, configuration)
  const MONTHLY_SUBSCRIPTION = 0; // Monthly platform cost (if applicable)

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
        : 30; // Default 30 seconds

      // Calculate costs
      const totalCost = costs.reduce((sum, c) => sum + Number(c.total_cost_usd || 0), 0);
      const totalDocsProcessed = costs.reduce((sum, c) => sum + (c.documents_processed || 0), 0);
      const avgAICostPerDoc = totalDocsProcessed > 0 ? totalCost / totalDocsProcessed : 0.02; // Default $0.02

      // Manual labor cost calculation
      const manualLaborCostPerDoc = (MANUAL_TIME_PER_DOC / 3600) * MANUAL_LABOR_RATE;

      // Calculate savings
      const timeSavedPerDocument = MANUAL_TIME_PER_DOC - avgProcessingTimeSeconds;
      const costSavingsPerDoc = manualLaborCostPerDoc - avgAICostPerDoc;
      const totalTimeSavedHours = (timeSavedPerDocument * docs.length) / 3600;
      const totalCostSavings = costSavingsPerDoc * docs.length;

      // Calculate accuracy metrics
      const successfulExtractions = validations.length;
      const validatedDocs = docs.filter(d => d.validation_status === 'validated').length;
      const rejectedDocs = docs.filter(d => d.validation_status === 'rejected').length;
      const pendingDocs = docs.filter(d => d.validation_status === 'pending').length;
      
      // Validation catch rate: % of docs that passed validation (quality metric)
      const validationCatchRate = docs.length > 0
        ? (validatedDocs / docs.length) * 100
        : 0;

      // Error detection rate: % of docs flagged for review
      const errorDetectionRate = docs.length > 0
        ? (rejectedDocs / docs.length) * 100
        : 0;

      const extractionAccuracy = scores.length > 0
        ? (scores.reduce((sum, s) => sum + Number(s.confidence_score || 0), 0) / scores.length) * 100
        : 0;

      // Calculate ROI
      const totalSavings = totalCostSavings;
      const totalInvestment = SYSTEM_SETUP_COST + totalCost;
      const netSavings = totalSavings - totalInvestment;
      const roi = totalInvestment > 0 ? (netSavings / totalInvestment) * 100 : 0;
      const breakEvenDocuments = costSavingsPerDoc > 0 ? Math.ceil(SYSTEM_SETUP_COST / costSavingsPerDoc) : 0;
      
      // Calculate payback period in months
      const docsPerMonth = docs.length > 0 ? docs.length / 12 : 100; // Assume 12 months of data or default
      const monthlyNetSavings = costSavingsPerDoc * docsPerMonth;
      const paybackPeriodMonths = monthlyNetSavings > 0 ? Math.ceil(SYSTEM_SETUP_COST / monthlyNetSavings) : 0;

      setMetrics({
        avgProcessingTimeSeconds,
        manualProcessingTimeSeconds: MANUAL_TIME_PER_DOC,
        timeSavedPerDocument,
        totalTimeSavedHours,
        avgAICostPerDoc,
        manualLaborCostPerDoc,
        costSavingsPerDoc,
        totalCostSavings,
        totalDocuments: docs.length,
        successfulExtractions,
        validationCatchRate,
        errorDetectionRate,
        extractionAccuracy,
        validatedDocs,
        rejectedDocs,
        pendingDocs,
        totalInvestment,
        totalSavings,
        roi,
        breakEvenDocuments,
        paybackPeriodMonths,
      });
    } catch (error) {
      console.error('Error loading viability metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading || !metrics) {
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
      description="Concrete proof of system performance and ROI"
    >
      <div className="space-y-6">
        {/* ROI Hero Section */}
        <Card className="p-8 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/30">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Target className="h-8 w-8 text-green-600" />
              <h2 className="text-3xl font-bold">System ROI</h2>
            </div>
            <div className="flex items-center justify-center gap-8">
              <div>
                <p className="text-5xl font-bold text-green-600">{metrics.roi.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground mt-2">Return on Investment</p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div>
                <p className="text-3xl font-bold">${metrics.totalSavings.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-2">Total Savings</p>
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
                    <h4 className="font-bold mb-1">Positive ROI</h4>
                    <p className="text-sm text-muted-foreground">
                      Net savings of ${(metrics.totalSavings - metrics.totalInvestment).toFixed(2)} with {metrics.roi.toFixed(0)}% ROI 
                      after {metrics.totalDocuments.toLocaleString()} documents processed (Break-even: {metrics.breakEvenDocuments.toLocaleString()} docs).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Proven Reliability</h4>
                    <p className="text-sm text-muted-foreground">
                      {((metrics.successfulExtractions / metrics.totalDocuments) * 100).toFixed(1)}% success rate processing real documents.
                      System has handled {metrics.totalDocuments.toLocaleString()} documents with validation workflow catching errors.
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
                      Saved {metrics.totalTimeSavedHours.toFixed(1)} hours of manual work total.
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Manual Processing Time</p>
                <p className="font-semibold">{formatTime(MANUAL_TIME_PER_DOC)} per document</p>
              </div>
              <div>
                <p className="text-muted-foreground">Manual Labor Rate</p>
                <p className="font-semibold">${MANUAL_LABOR_RATE}/hour</p>
              </div>
              <div>
                <p className="text-muted-foreground">System Setup Cost</p>
                <p className="font-semibold">${SYSTEM_SETUP_COST.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg AI Cost/Doc</p>
                <p className="font-semibold">${metrics.avgAICostPerDoc.toFixed(3)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SystemViability;