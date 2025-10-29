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
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

if ((pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
}

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
      reader.onloadend = async () => {
        const rawDataUrl = reader.result as string;
        // Compress reference image
        const compressedDataUrl = await compressImage(rawDataUrl, 500);
        setReferenceImage(compressedDataUrl);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading reference image:', error);
    }
  };

  const compressImage = async (dataUrl: string, maxSizeKB = 500): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Scale down if too large
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels to stay under size limit
        let quality = 0.85;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        while (result.length > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
      img.src = dataUrl;
    });
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
      // Prefer Storage SDK download to avoid URL quirks
      let blob: Blob | null = null;
      try {
        // Extract storage path from URL
        let filePath: string | null = null;
        try {
          const u = new URL(documentImageUrl);
          const m = u.pathname.match(/\/documents\/(.+)$/);
          filePath = m ? decodeURIComponent(m[1]) : null;
        } catch {
          const m = documentImageUrl.match(/\/documents\/(.+?)(?:\?|#|$)/);
          filePath = m ? decodeURIComponent(m[1]) : null;
        }
        if (filePath) {
          const { data, error } = await supabase.storage.from('documents').download(filePath);
          if (!error && data) blob = data as Blob;
        }
      } catch {}

      if (!blob) {
        const signedUrl = await getSignedUrl(documentImageUrl);
        const response = await fetch(signedUrl);
        blob = await response.blob();
      }


      const isPdf = /pdf$/i.test(blob.type) || /\.pdf($|\?)/i.test(documentImageUrl);
      let rawDataUrl: string;
      
      if (isPdf) {
        // Render first page of PDF to PNG using pdfjs
        const buffer = await blob.arrayBuffer();
        const loadingTask = (pdfjsLib as any).getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        let viewport = page.getViewport({ scale: 1.2 });
        const maxDim = 1200;
        const scale = Math.min(1.6, maxDim / Math.max(viewport.width, viewport.height));
        viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        rawDataUrl = canvas.toDataURL('image/png');
      } else {
        const reader = new FileReader();
        rawDataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
      }

      // Compress image to reduce size
      const compressedDataUrl = await compressImage(rawDataUrl, 500);
      setSignatureImage(compressedDataUrl);

      setResult(null);
      toast({
        title: 'Document loaded',
        description: 'Ready to detect signature from document',
      });
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

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (img: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      // Compress the uploaded image
      const compressedDataUrl = await compressImage(rawDataUrl, 500);
      setImage(compressedDataUrl);
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
