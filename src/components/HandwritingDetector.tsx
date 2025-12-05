import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PenTool, 
  Type, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface HandwritingRegion {
  id: string;
  type: 'handwriting' | 'printed' | 'mixed';
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  extractedText?: string;
  rawText?: string;
}

interface HandwritingDetectorProps {
  documentId: string;
  imageUrl: string;
  onDetectionComplete: (regions: HandwritingRegion[]) => void;
}

export function HandwritingDetector({
  documentId,
  imageUrl,
  onDetectionComplete
}: HandwritingDetectorProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [regions, setRegions] = useState<HandwritingRegion[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const analyzeDocument = async () => {
    setIsAnalyzing(true);
    setProgress(10);

    try {
      // Call the OCR function with handwriting detection enabled
      setProgress(30);
      
      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: {
          documentId,
          imageUrl,
          enableHandwritingDetection: true,
          detectTextTypes: true
        }
      });

      setProgress(70);

      if (error) throw error;

      // Parse the handwriting regions from the response
      const detectedRegions: HandwritingRegion[] = [];
      
      if (data?.handwritingAnalysis) {
        const analysis = data.handwritingAnalysis;
        
        // Process handwriting regions
        if (analysis.handwrittenRegions) {
          analysis.handwrittenRegions.forEach((region: any, index: number) => {
            detectedRegions.push({
              id: `hw-${index}`,
              type: 'handwriting',
              confidence: region.confidence || 0.75,
              boundingBox: region.boundingBox || { x: 0, y: 0, width: 100, height: 50 },
              extractedText: region.text,
              rawText: region.rawText
            });
          });
        }

        // Process printed regions
        if (analysis.printedRegions) {
          analysis.printedRegions.forEach((region: any, index: number) => {
            detectedRegions.push({
              id: `pr-${index}`,
              type: 'printed',
              confidence: region.confidence || 0.95,
              boundingBox: region.boundingBox || { x: 0, y: 0, width: 100, height: 50 },
              extractedText: region.text
            });
          });
        }

        // Process mixed regions
        if (analysis.mixedRegions) {
          analysis.mixedRegions.forEach((region: any, index: number) => {
            detectedRegions.push({
              id: `mx-${index}`,
              type: 'mixed',
              confidence: region.confidence || 0.85,
              boundingBox: region.boundingBox || { x: 0, y: 0, width: 100, height: 50 },
              extractedText: region.text
            });
          });
        }
      }

      setProgress(100);
      setRegions(detectedRegions);
      setAnalysisComplete(true);
      onDetectionComplete(detectedRegions);

      const handwrittenCount = detectedRegions.filter(r => r.type === 'handwriting').length;
      const printedCount = detectedRegions.filter(r => r.type === 'printed').length;
      
      toast.success(
        `Analysis complete: ${handwrittenCount} handwritten, ${printedCount} printed regions found`
      );
    } catch (error: any) {
      console.error('Handwriting detection error:', error);
      toast.error('Failed to analyze document: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'handwriting':
        return <PenTool className="h-4 w-4 text-blue-500" />;
      case 'printed':
        return <Type className="h-4 w-4 text-green-500" />;
      case 'mixed':
        return <FileText className="h-4 w-4 text-amber-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'handwriting':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">ICR</Badge>;
      case 'printed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">OCR</Badge>;
      case 'mixed':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Mixed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const handwrittenCount = regions.filter(r => r.type === 'handwriting').length;
  const printedCount = regions.filter(r => r.type === 'printed').length;
  const mixedCount = regions.filter(r => r.type === 'mixed').length;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Intelligent Character Recognition</h3>
      </div>

      {!analysisComplete && !isAnalyzing && (
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <PenTool className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <Type className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Detect and extract both handwritten (ICR) and printed (OCR) text
          </p>
          <Button onClick={analyzeDocument}>
            <Sparkles className="h-4 w-4 mr-2" />
            Analyze Document
          </Button>
        </div>
      )}

      {isAnalyzing && (
        <div className="space-y-4 py-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing document...</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            Detecting handwritten and printed text regions
          </p>
        </div>
      )}

      {analysisComplete && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">Analysis Complete</p>
              <p className="text-xs text-muted-foreground">
                {regions.length} text region{regions.length !== 1 ? 's' : ''} detected
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={analyzeDocument}>
              Re-analyze
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-center">
              <PenTool className="h-4 w-4 mx-auto mb-1 text-blue-600" />
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{handwrittenCount}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Handwritten</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
              <Type className="h-4 w-4 mx-auto mb-1 text-green-600" />
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{printedCount}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Printed</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-center">
              <FileText className="h-4 w-4 mx-auto mb-1 text-amber-600" />
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{mixedCount}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Mixed</p>
            </div>
          </div>

          {/* Region List */}
          {regions.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {regions.map(region => (
                <div 
                  key={region.id} 
                  className="flex items-start gap-3 p-2 rounded border bg-background"
                >
                  {getTypeIcon(region.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeBadge(region.type)}
                      <span className="text-xs text-muted-foreground">
                        {Math.round(region.confidence * 100)}% confidence
                      </span>
                    </div>
                    {region.extractedText && (
                      <p className="text-sm truncate">{region.extractedText}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {handwrittenCount > 0 && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Handwritten text detected. ICR accuracy may be lower than printed text.
                Please verify extracted values carefully.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}
