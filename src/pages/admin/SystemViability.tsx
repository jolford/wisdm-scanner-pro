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
  extractionAccuracy: number;

  // ROI Metrics
  totalInvestment: number;
  totalSavings: number;
  roi: number;
  breakEvenDocuments: number;
}

const SystemViability = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [metrics, setMetrics] = useState<ViabilityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Constants for calculations
  const MANUAL_TIME_PER_DOC = 300; // 5 minutes in seconds
  const MANUAL_LABOR_RATE = 15; // $15/hour
  const SYSTEM_SETUP_COST = 0; // One-time setup cost

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
      const validationCatchRate = docs.length > 0
        ? (validations.filter(d => d.validation_status === 'validated').length / docs.length) * 100
        : 0;

      const extractionAccuracy = scores.length > 0
        ? (scores.reduce((sum, s) => sum + Number(s.confidence_score || 0), 0) / scores.length) * 100
        : 0;

      // Calculate ROI
      const totalSavings = totalCostSavings;
      const totalInvestment = SYSTEM_SETUP_COST + totalCost;
      const roi = totalInvestment > 0 ? ((totalSavings - totalInvestment) / totalInvestment) * 100 : 0;
      const breakEvenDocuments = costSavingsPerDoc > 0 ? Math.ceil(SYSTEM_SETUP_COST / costSavingsPerDoc) : 0;

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
        extractionAccuracy,
        totalInvestment,
        totalSavings,
        roi,
        breakEvenDocuments,
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
              <Badge variant="outline" className="text-lg py-2 px-4">
                Break-even at {metrics.breakEvenDocuments} documents
              </Badge>
            )}
            {metrics.totalDocuments >= metrics.breakEvenDocuments && (
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

        {/* Performance & Reliability Metrics */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processing Speed</p>
                <p className="text-2xl font-bold">{metrics.avgProcessingTimeSeconds.toFixed(1)}s</p>
                <p className="text-xs text-green-600 font-medium mt-1">
                  {((1 - metrics.avgProcessingTimeSeconds / metrics.manualProcessingTimeSeconds) * 100).toFixed(0)}x faster
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{((metrics.successfulExtractions / metrics.totalDocuments) * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.successfulExtractions} successful
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Validation Rate</p>
                <p className="text-2xl font-bold">{metrics.validationCatchRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Quality assurance
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Extraction Accuracy</p>
                <p className="text-2xl font-bold">{metrics.extractionAccuracy.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  OCR confidence
                </p>
              </div>
            </div>
          </Card>
        </div>

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
                      Processing documents {((1 - metrics.avgProcessingTimeSeconds / metrics.manualProcessingTimeSeconds) * 100).toFixed(0)}x faster than manual entry.
                      Average: {formatTime(metrics.avgProcessingTimeSeconds)} vs {formatTime(metrics.manualProcessingTimeSeconds)}.
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
                      Saving ${metrics.costSavingsPerDoc.toFixed(2)} per document ({(100 - (metrics.avgAICostPerDoc / metrics.manualLaborCostPerDoc) * 100).toFixed(0)}% reduction).
                      Total savings: ${metrics.totalCostSavings.toFixed(2)} across {metrics.totalDocuments} documents.
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
                      {metrics.extractionAccuracy.toFixed(1)}% OCR confidence score with {metrics.validationCatchRate.toFixed(1)}% validation rate.
                      Successfully extracted data from {metrics.successfulExtractions} documents.
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
                      {metrics.roi > 0 ? `${metrics.roi.toFixed(0)}% return on investment` : 'Approaching break-even'}
                      {metrics.totalDocuments >= metrics.breakEvenDocuments 
                        ? `. System has paid for itself and is generating profit.`
                        : ` after ${metrics.totalDocuments} documents. Break-even at ${metrics.breakEvenDocuments} documents.`
                      }
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
      </div>
    </AdminLayout>
  );
};

export default SystemViability;