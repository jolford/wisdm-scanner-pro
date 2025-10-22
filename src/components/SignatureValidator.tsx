import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ValidationResult {
  // Detection mode results
  signatureDetected?: boolean;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  characteristics?: {
    isHandwritten: boolean;
    hasFlowingStrokes: boolean;
    complexity: string;
    clarity: string;
  };
  // Comparison mode results
  match?: boolean;
  similarityScore?: number;
  recommendation?: 'accept' | 'review' | 'reject';
  differences?: string[];
  similarities?: string[];
  analysis?: string;
  error?: string;
}

export function SignatureValidator() {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (img: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImage(dataUrl);
      setResult(null); // Clear previous results
    };
    reader.readAsDataURL(file);
  };

  const validateSignature = async () => {
    if (!signatureImage) {
      toast({
        title: 'Missing signature',
        description: 'Please upload a signature to validate.',
        variant: 'destructive',
      });
      return;
    }

    setValidating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-signature', {
        body: {
          signatureImage,
          referenceImage,
          strictMode,
        },
      });

      if (error) throw error;

      setResult(data);

      // Show toast based on result
      if (data.error) {
        toast({
          title: 'Validation incomplete',
          description: data.error,
          variant: 'destructive',
        });
      } else if (data.match !== undefined) {
        // Comparison mode
        const variant = data.recommendation === 'accept' ? 'default' : 
                       data.recommendation === 'reject' ? 'destructive' : 
                       'default';
        toast({
          title: data.match ? 'Signatures match' : 'Signatures differ',
          description: `Similarity: ${Math.round((data.similarityScore || 0) * 100)}% - ${data.recommendation}`,
          variant: variant as any,
        });
      } else if (data.signatureDetected !== undefined) {
        // Detection mode
        toast({
          title: data.signatureDetected ? 'Signature detected' : 'No signature found',
          description: `Confidence: ${Math.round((data.confidence || 0) * 100)}%`,
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: 'Validation failed',
        description: 'Failed to validate signature. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  };

  const getRecommendationIcon = (recommendation?: string) => {
    if (recommendation === 'accept') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (recommendation === 'reject') return <XCircle className="h-5 w-5 text-red-600" />;
    return <AlertCircle className="h-5 w-5 text-yellow-600" />;
  };

  const getRecommendationColor = (recommendation?: string) => {
    if (recommendation === 'accept') return 'default';
    if (recommendation === 'reject') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Signature Validation</CardTitle>
          <CardDescription>
            Upload signatures to validate authenticity and compare against reference samples
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Signature to Validate */}
          <div className="space-y-3">
            <Label>Signature to Validate</Label>
            <div className="flex items-center gap-4">
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setSignatureImage)}
                className="hidden"
              />
              <Button
                onClick={() => signatureInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {signatureImage ? 'Change Signature' : 'Upload Signature'}
              </Button>
            </div>
            {signatureImage && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <img
                  src={signatureImage}
                  alt="Signature"
                  className="max-h-32 mx-auto object-contain"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Reference Signature (Optional) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Reference Signature (Optional)</Label>
              <Badge variant="outline">For Comparison</Badge>
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={referenceInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setReferenceImage)}
                className="hidden"
              />
              <Button
                onClick={() => referenceInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {referenceImage ? 'Change Reference' : 'Upload Reference'}
              </Button>
            </div>
            {referenceImage && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="max-h-32 mx-auto object-contain"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Validation Options */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Strict Mode</Label>
              <p className="text-sm text-muted-foreground">
                Use stricter validation criteria
              </p>
            </div>
            <Switch
              checked={strictMode}
              onCheckedChange={setStrictMode}
              disabled={!referenceImage}
            />
          </div>

          {/* Validate Button */}
          <Button
            onClick={validateSignature}
            disabled={!signatureImage || validating}
            className="w-full"
            size="lg"
          >
            {validating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Validate Signature
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && !result.error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Validation Results
              {result.recommendation && getRecommendationIcon(result.recommendation)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Detection Mode Results */}
            {result.signatureDetected !== undefined && (
              <div className="space-y-3">
                <Alert>
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {result.signatureDetected ? 'Signature Detected' : 'No Signature Found'}
                      </span>
                      <Badge variant={result.signatureDetected ? 'default' : 'destructive'}>
                        {Math.round((result.confidence || 0) * 100)}% Confidence
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>

                {result.characteristics && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <p className="text-sm font-medium">
                        {result.characteristics.isHandwritten ? 'Handwritten' : 'Digital'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Complexity</Label>
                      <p className="text-sm font-medium capitalize">
                        {result.characteristics.complexity}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Clarity</Label>
                      <p className="text-sm font-medium capitalize">
                        {result.characteristics.clarity}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Strokes</Label>
                      <p className="text-sm font-medium">
                        {result.characteristics.hasFlowingStrokes ? 'Flowing' : 'Discrete'}
                      </p>
                    </div>
                  </div>
                )}

                {result.analysis && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Analysis</Label>
                    <p className="text-sm">{result.analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Comparison Mode Results */}
            {result.match !== undefined && (
              <div className="space-y-3">
                <Alert>
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {result.match ? 'Signatures Match' : 'Signatures Differ'}
                      </span>
                      <Badge variant={result.match ? 'default' : 'destructive'}>
                        {Math.round((result.similarityScore || 0) * 100)}% Similar
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>

                {result.recommendation && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">Recommendation:</span>
                    <Badge variant={getRecommendationColor(result.recommendation) as any}>
                      {result.recommendation.toUpperCase()}
                    </Badge>
                  </div>
                )}

                {result.similarities && result.similarities.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-green-600">Similarities</Label>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {result.similarities.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.differences && result.differences.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-red-600">Differences</Label>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {result.differences.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.analysis && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Detailed Analysis</Label>
                    <p className="text-sm">{result.analysis}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
