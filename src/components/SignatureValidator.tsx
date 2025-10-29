import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader2, FileImage } from 'lucide-react';
import { getSignedUrl } from '@/hooks/use-signed-url';

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

interface SignatureValidatorProps {
  documentImageUrl?: string;
  projectId?: string;
  currentMetadata?: Record<string, any>;
}

export function SignatureValidator({ documentImageUrl, projectId, currentMetadata }: SignatureValidatorProps = {}) {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [referenceSignatures, setReferenceSignatures] = useState<any[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [loadingDocImage, setLoadingDocImage] = useState(false);
  
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch reference signatures when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchReferenceSignatures();
    }
  }, [projectId]);

  // Auto-match reference signature when metadata changes
  useEffect(() => {
    if (!currentMetadata || !referenceSignatures.length) return;
    
    // Try common entity ID fields
    const entityIdFields = ['voter_id', 'Voter ID', 'voter id', 'entity_id', 'Entity ID'];
    for (const field of entityIdFields) {
      const entityId = currentMetadata[field];
      if (entityId) {
        const match = referenceSignatures.find(r => 
          String(r.entity_id).toLowerCase() === String(entityId).toLowerCase()
        );
        if (match) {
          setSelectedReferenceId(match.id);
          loadReferenceImage(match);
          break;
        }
      }
    }
  }, [currentMetadata, referenceSignatures]);

  const fetchReferenceSignatures = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('signature_references')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true);
      
      if (error) throw error;
      setReferenceSignatures(data || []);
    } catch (error) {
      console.error('Error fetching reference signatures:', error);
    }
  };

  const loadReferenceImage = async (reference: any) => {
    try {
      const signedUrl = await getSignedUrl(reference.signature_image_url);
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading reference image:', error);
    }
  };

  const handleUseCurrentDocument = async () => {
    if (!documentImageUrl) {
      toast({
        title: 'No document image',
        description: 'Document image not available',
        variant: 'destructive',
      });
      return;
    }

    setLoadingDocImage(true);
    try {
      const signedUrl = await getSignedUrl(documentImageUrl);
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureImage(reader.result as string);
        setResult(null);
        toast({
          title: 'Document loaded',
          description: 'Ready to detect signature from document',
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading document image:', error);
      toast({
        title: 'Failed to load document',
        description: 'Could not load document image',
        variant: 'destructive',
      });
    } finally {
      setLoadingDocImage(false);
    }
  };

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

  const handleReferenceChange = async (refId: string) => {
    setSelectedReferenceId(refId);
    if (refId === 'none') {
      setReferenceImage(null);
      setStrictMode(false);
      return;
    }
    
    const reference = referenceSignatures.find(r => r.id === refId);
    if (reference) {
      await loadReferenceImage(reference);
      setStrictMode(true);
    }
  };

  const validateSignature = async () => {
    if (!signatureImage) {
      toast({
        title: 'No signature image',
        description: 'Please upload a signature image or use current document',
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
          strictMode: !!referenceImage,
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
            {documentImageUrl 
              ? 'Use current document or upload a signature image to detect/compare' 
              : 'Upload signature images to detect or compare signatures using AI vision'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reference Signature Selection */}
          {referenceSignatures.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Compare Against Reference</Label>
              <Select value={selectedReferenceId || 'none'} onValueChange={handleReferenceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reference signature..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Detection only)</SelectItem>
                  {referenceSignatures.map((ref) => (
                    <SelectItem key={ref.id} value={ref.id}>
                      {ref.entity_name || ref.entity_id} ({ref.entity_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Signature Image Upload */}
          <div className="space-y-3">
            <Label htmlFor="signature-upload" className="text-sm font-medium">
              Signature to Validate
            </Label>
            <div className="flex gap-2">
              {documentImageUrl && (
                <Button
                  type="button"
                  variant="default"
                  className="flex-1"
                  onClick={handleUseCurrentDocument}
                  disabled={loadingDocImage}
                >
                  {loadingDocImage ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileImage className="h-4 w-4 mr-2" />
                  )}
                  Use Current Document
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className={documentImageUrl ? 'flex-1' : 'w-full'}
                onClick={() => signatureInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Signature
              </Button>
              <input
                ref={signatureInputRef}
                id="signature-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, setSignatureImage)}
              />
            </div>
            {signatureImage && (
              <div className="relative w-full h-32 bg-muted rounded border">
                <img
                  src={signatureImage}
                  alt="Signature to validate"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          {/* Reference Image Display (if selected from database) */}
          {referenceImage && selectedReferenceId && selectedReferenceId !== 'none' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reference Signature</Label>
              <div className="relative w-full h-32 bg-muted rounded border">
                <img
                  src={referenceImage}
                  alt="Reference signature"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Using stored reference for comparison
              </p>
            </div>
          )}

          {/* Validate Button */}
          <Button
            onClick={validateSignature}
            disabled={!signatureImage || validating}
            className="w-full"
            size="lg"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                {referenceImage ? 'Compare Against Reference' : 'Detect Signature'}
              </>
            )}
          </Button>

          {/* Validation Results */}
          {result && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Validation Results</h3>

                {result.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                )}

                {/* Comparison Results */}
                {result.match !== undefined && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getRecommendationIcon(result.recommendation)}
                        Signature Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={result.match ? 'default' : 'secondary'}>
                          {result.match ? '✓ Match' : '≈ No Match'}
                        </Badge>
                        {result.similarityScore !== undefined && (
                          <Badge variant="outline">
                            {Math.round(result.similarityScore * 100)}% similarity
                          </Badge>
                        )}
                        {result.recommendation && (
                          <Badge variant={getRecommendationColor(result.recommendation) as any}>
                            {result.recommendation.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      {result.analysis && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Analysis:</strong> {result.analysis}
                        </div>
                      )}

                      {result.similarities && result.similarities.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-green-700 dark:text-green-400">Similarities:</div>
                          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                            {result.similarities.map((sim, idx) => (
                              <li key={idx}>{sim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.differences && result.differences.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-red-700 dark:text-red-400">Differences:</div>
                          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                            {result.differences.map((diff, idx) => (
                              <li key={idx}>{diff}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Detection Results */}
                {result.signatureDetected !== undefined && !result.match && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        {result.signatureDetected ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        Signature Detection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Badge variant={result.signatureDetected ? 'default' : 'destructive'}>
                          {result.signatureDetected ? '✓ Detected' : '✗ Not Found'}
                        </Badge>
                        {result.confidence !== undefined && (
                          <Badge variant="outline">
                            {Math.round(result.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>

                      {result.characteristics && (
                        <div className="space-y-2 text-sm">
                          <div className="font-medium">Characteristics:</div>
                          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                            <div>Handwritten: {result.characteristics.isHandwritten ? 'Yes' : 'No'}</div>
                            <div>Flowing Strokes: {result.characteristics.hasFlowingStrokes ? 'Yes' : 'No'}</div>
                            <div>Complexity: {result.characteristics.complexity}</div>
                            <div>Clarity: {result.characteristics.clarity}</div>
                          </div>
                        </div>
                      )}

                      {result.boundingBox && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Location:</strong> ({result.boundingBox.x}, {result.boundingBox.y}) - 
                          Size: {result.boundingBox.width}×{result.boundingBox.height}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
