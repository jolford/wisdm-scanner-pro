import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Settings2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Sliders,
  Lightbulb,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

interface FieldCalibration {
  fieldName: string;
  currentThreshold: number;
  suggestedThreshold: number;
  historicalAccuracy: number;
  totalExtractions: number;
  correctExtractions: number;
  falsePositives: number;
  falseNegatives: number;
  trend: 'up' | 'down' | 'stable';
}

interface ConfidenceCalibrationProps {
  projectId?: string;
  onSave?: (calibrations: FieldCalibration[]) => void;
}

export function ConfidenceCalibration({ projectId, onSave }: ConfidenceCalibrationProps) {
  const [autoCalibrate, setAutoCalibrate] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Demo calibration data
  const [calibrations, setCalibrations] = useState<FieldCalibration[]>([
    { fieldName: 'Invoice Number', currentThreshold: 85, suggestedThreshold: 82, historicalAccuracy: 96.5, totalExtractions: 1250, correctExtractions: 1206, falsePositives: 12, falseNegatives: 32, trend: 'up' },
    { fieldName: 'Date', currentThreshold: 80, suggestedThreshold: 75, historicalAccuracy: 94.2, totalExtractions: 1250, correctExtractions: 1177, falsePositives: 28, falseNegatives: 45, trend: 'stable' },
    { fieldName: 'Vendor Name', currentThreshold: 75, suggestedThreshold: 80, historicalAccuracy: 89.1, totalExtractions: 1250, correctExtractions: 1114, falsePositives: 45, falseNegatives: 91, trend: 'down' },
    { fieldName: 'Total Amount', currentThreshold: 90, suggestedThreshold: 88, historicalAccuracy: 97.8, totalExtractions: 1250, correctExtractions: 1222, falsePositives: 8, falseNegatives: 20, trend: 'up' },
    { fieldName: 'Line Items', currentThreshold: 70, suggestedThreshold: 72, historicalAccuracy: 85.4, totalExtractions: 3200, correctExtractions: 2733, falsePositives: 120, falseNegatives: 347, trend: 'stable' },
    { fieldName: 'Tax Amount', currentThreshold: 85, suggestedThreshold: 83, historicalAccuracy: 93.6, totalExtractions: 980, correctExtractions: 917, falsePositives: 22, falseNegatives: 41, trend: 'up' },
    { fieldName: 'Address', currentThreshold: 75, suggestedThreshold: 78, historicalAccuracy: 88.2, totalExtractions: 1100, correctExtractions: 970, falsePositives: 55, falseNegatives: 75, trend: 'down' },
    { fieldName: 'PO Number', currentThreshold: 80, suggestedThreshold: 77, historicalAccuracy: 91.5, totalExtractions: 650, correctExtractions: 595, falsePositives: 18, falseNegatives: 37, trend: 'stable' },
  ]);

  const stats = useMemo(() => {
    const needsAdjustment = calibrations.filter(c => Math.abs(c.currentThreshold - c.suggestedThreshold) > 3);
    const avgAccuracy = calibrations.reduce((acc, c) => acc + c.historicalAccuracy, 0) / calibrations.length;
    const totalDocs = calibrations.reduce((acc, c) => acc + c.totalExtractions, 0);
    
    return {
      needsAdjustment: needsAdjustment.length,
      avgAccuracy,
      totalDocs,
      fieldsImproving: calibrations.filter(c => c.trend === 'up').length,
      fieldsDeclining: calibrations.filter(c => c.trend === 'down').length,
    };
  }, [calibrations]);

  const updateThreshold = (fieldName: string, newThreshold: number) => {
    setCalibrations(prev => prev.map(c => 
      c.fieldName === fieldName ? { ...c, currentThreshold: newThreshold } : c
    ));
  };

  const applyAllSuggestions = () => {
    setCalibrations(prev => prev.map(c => ({ ...c, currentThreshold: c.suggestedThreshold })));
    toast.success('Applied all suggested thresholds');
  };

  const applySuggestion = (fieldName: string) => {
    setCalibrations(prev => prev.map(c => 
      c.fieldName === fieldName ? { ...c, currentThreshold: c.suggestedThreshold } : c
    ));
    toast.success(`Applied suggestion for ${fieldName}`);
  };

  const runCalibration = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate recalculation
    setCalibrations(prev => prev.map(c => ({
      ...c,
      suggestedThreshold: Math.max(50, Math.min(95, c.currentThreshold + (Math.random() - 0.5) * 10)),
      historicalAccuracy: Math.min(99, c.historicalAccuracy + (Math.random() - 0.3) * 2),
    })));
    
    setIsAnalyzing(false);
    toast.success('Calibration analysis complete');
  };

  const handleSave = () => {
    onSave?.(calibrations);
    toast.success('Calibration settings saved');
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 border-t-2 border-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Confidence Calibration
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Auto-calibrate</Label>
            <Switch checked={autoCalibrate} onCheckedChange={setAutoCalibrate} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{stats.avgAccuracy.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Avg Accuracy</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{stats.totalDocs.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Extractions</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.fieldsImproving}</div>
            <div className="text-xs text-muted-foreground">Improving</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.needsAdjustment}</div>
            <div className="text-xs text-muted-foreground">Need Adjustment</div>
          </div>
        </div>

        <Tabs defaultValue="fields">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fields" className="flex items-center gap-1">
              <Sliders className="h-4 w-4" />
              Field Thresholds
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={runCalibration} disabled={isAnalyzing}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
                Re-analyze
              </Button>
              <Button variant="secondary" size="sm" onClick={applyAllSuggestions}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Apply All Suggestions
              </Button>
            </div>

            <ScrollArea className="h-[320px]">
              <div className="space-y-4 pr-4">
                {calibrations.map((cal) => {
                  const diff = cal.suggestedThreshold - cal.currentThreshold;
                  const hasSuggestion = Math.abs(diff) > 2;
                  
                  return (
                    <div key={cal.fieldName} className="p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cal.fieldName}</span>
                          {getTrendIcon(cal.trend)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cal.historicalAccuracy > 95 ? 'default' : cal.historicalAccuracy > 90 ? 'secondary' : 'destructive'}>
                            {cal.historicalAccuracy.toFixed(1)}% accuracy
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Threshold</span>
                          <span className="font-mono">{cal.currentThreshold}%</span>
                        </div>
                        <Slider
                          value={[cal.currentThreshold]}
                          min={50}
                          max={99}
                          step={1}
                          onValueChange={([v]) => updateThreshold(cal.fieldName, v)}
                        />
                      </div>

                      {hasSuggestion && (
                        <div className="flex items-center justify-between p-2 rounded bg-primary/5 text-sm">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            <span>
                              Suggest {diff > 0 ? 'increasing' : 'decreasing'} to {cal.suggestedThreshold}%
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => applySuggestion(cal.fieldName)}>
                            Apply
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{cal.totalExtractions.toLocaleString()} total</span>
                        <span className="text-green-600">{cal.correctExtractions.toLocaleString()} correct</span>
                        <span className="text-red-600">{cal.falsePositives} false +</span>
                        <span className="text-amber-600">{cal.falseNegatives} false -</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4 mt-4">
            <div className="space-y-3">
              {stats.needsAdjustment > 0 && (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800 dark:text-amber-200">
                        {stats.needsAdjustment} fields need threshold adjustment
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Based on historical accuracy data, adjusting these thresholds could reduce false positives by ~15%.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {stats.fieldsDeclining > 0 && (
                <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 dark:text-red-200">
                        {stats.fieldsDeclining} fields showing declining accuracy
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        Consider reviewing extraction templates for: {calibrations.filter(c => c.trend === 'down').map(c => c.fieldName).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-800 dark:text-green-200">
                      Overall extraction quality is {stats.avgAccuracy > 92 ? 'excellent' : 'good'}
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Average accuracy of {stats.avgAccuracy.toFixed(1)}% across {calibrations.length} field types.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Optimization Recommendations
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Lower thresholds for fields with high false negative rates to capture more data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Raise thresholds for fields with high false positive rates to improve precision</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Enable auto-calibration to continuously optimize based on user corrections</span>
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Save Calibration Settings
        </Button>
      </CardContent>
    </Card>
  );
}
