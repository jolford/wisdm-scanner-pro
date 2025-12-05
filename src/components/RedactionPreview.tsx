import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  Download, 
  ArrowLeftRight,
  Shield,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { DetectedKeyword, PII_CATEGORIES } from '@/lib/keyword-redaction';

interface RedactionPreviewProps {
  documentId: string;
  imageUrl: string;
  detectedKeywords: DetectedKeyword[];
  ocrMetadata?: any;
  onApprove: (selectedCategories: string[]) => Promise<void>;
  onCancel: () => void;
}

interface PreviewRedaction {
  category: string;
  label: string;
  icon: string;
  count: number;
  selected: boolean;
  severity: 'high' | 'medium' | 'low';
}

export function RedactionPreview({
  documentId,
  imageUrl,
  detectedKeywords,
  ocrMetadata,
  onApprove,
  onCancel
}: RedactionPreviewProps) {
  const { signedUrl } = useSignedUrl(imageUrl);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showRedactions, setShowRedactions] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  
  // Group keywords by category for selection
  const [redactionGroups, setRedactionGroups] = useState<PreviewRedaction[]>([]);

  // Initialize redaction groups from detected keywords
  useEffect(() => {
    const groupedByCategory = detectedKeywords.reduce((acc, kw) => {
      if (!acc[kw.category]) {
        const categoryInfo = PII_CATEGORIES[kw.category as keyof typeof PII_CATEGORIES];
        acc[kw.category] = {
          category: kw.category,
          label: categoryInfo?.label || kw.category,
          icon: categoryInfo?.icon || '🔒',
          count: 0,
          selected: true,
          severity: (categoryInfo?.severity === 'critical' ? 'high' : categoryInfo?.severity) || 'medium'
        };
      }
      acc[kw.category].count += kw.matches.length;
      return acc;
    }, {} as Record<string, PreviewRedaction>);

    setRedactionGroups(Object.values(groupedByCategory));
  }, [detectedKeywords]);

  // Load and render images
  useEffect(() => {
    if (!signedUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Setup original canvas
      const origCanvas = originalCanvasRef.current;
      const prevCanvas = previewCanvasRef.current;
      if (!origCanvas || !prevCanvas) return;

      const scale = Math.min(400 / img.width, 500 / img.height);
      const width = img.width * scale;
      const height = img.height * scale;

      origCanvas.width = width;
      origCanvas.height = height;
      prevCanvas.width = width;
      prevCanvas.height = height;

      // Draw original
      const origCtx = origCanvas.getContext('2d');
      if (origCtx) {
        origCtx.drawImage(img, 0, 0, width, height);
      }

      setImageLoaded(true);
      drawPreview(img, scale);
    };

    img.src = signedUrl;
  }, [signedUrl]);

  // Redraw preview when selections change
  useEffect(() => {
    if (!imageLoaded || !signedUrl) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const scale = canvas.width / img.width;
      drawPreview(img, scale);
    };
    img.src = signedUrl;
  }, [redactionGroups, showRedactions, imageLoaded]);

  const drawPreview = (img: HTMLImageElement, scale: number) => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!showRedactions) return;

    // Get selected categories
    const selectedCategories = redactionGroups
      .filter(g => g.selected)
      .map(g => g.category);

    // Draw redaction boxes for selected categories
    detectedKeywords.forEach(kw => {
      if (!selectedCategories.includes(kw.category)) return;

      kw.matches.forEach(match => {
        if (match.boundingBox) {
          const box = match.boundingBox;
          const x = box.x * scale;
          const y = box.y * scale;
          const width = box.width * scale;
          const height = box.height * scale;

          // Add padding
          const padding = 4;
          
          // Draw black redaction box
          ctx.fillStyle = 'rgba(0, 0, 0, 1)';
          ctx.fillRect(
            x - padding, 
            y - padding, 
            width + padding * 2, 
            height + padding * 2
          );
        }
      });
    });
  };

  const toggleCategory = (category: string) => {
    setRedactionGroups(prev => prev.map(g => 
      g.category === category ? { ...g, selected: !g.selected } : g
    ));
  };

  const selectAll = () => {
    setRedactionGroups(prev => prev.map(g => ({ ...g, selected: true })));
  };

  const selectNone = () => {
    setRedactionGroups(prev => prev.map(g => ({ ...g, selected: false })));
  };

  const handleApprove = async () => {
    const selectedCategories = redactionGroups
      .filter(g => g.selected)
      .map(g => g.category);

    if (selectedCategories.length === 0) {
      toast.error('Please select at least one category to redact');
      return;
    }

    setIsApproving(true);
    try {
      await onApprove(selectedCategories);
      toast.success('Redactions applied successfully');
    } catch (error: any) {
      toast.error('Failed to apply redactions: ' + error.message);
    } finally {
      setIsApproving(false);
    }
  };

  const totalSelected = redactionGroups.filter(g => g.selected).reduce((sum, g) => sum + g.count, 0);
  const totalDetected = redactionGroups.reduce((sum, g) => sum + g.count, 0);

  return (
    <Card className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Redaction Preview</h2>
            <p className="text-sm text-muted-foreground">
              Review and approve redactions before applying
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-6">
        {/* Preview Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('side-by-side')}
              >
                <ArrowLeftRight className="h-4 w-4 mr-1" />
                Side by Side
              </Button>
              <Button
                variant={viewMode === 'overlay' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('overlay')}
              >
                <Eye className="h-4 w-4 mr-1" />
                Overlay
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRedactions(!showRedactions)}
            >
              {showRedactions ? (
                <><EyeOff className="h-4 w-4 mr-1" /> Hide Redactions</>
              ) : (
                <><Eye className="h-4 w-4 mr-1" /> Show Redactions</>
              )}
            </Button>
          </div>

          {viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Original</Label>
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <canvas ref={originalCanvasRef} className="w-full h-auto" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  Preview
                  {showRedactions && (
                    <Badge variant="secondary" className="text-xs">
                      {totalSelected} redactions
                    </Badge>
                  )}
                </Label>
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <canvas ref={previewCanvasRef} className="w-full h-auto" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                {showRedactions ? 'With Redactions' : 'Original'}
                {showRedactions && (
                  <Badge variant="secondary" className="text-xs">
                    {totalSelected} redactions
                  </Badge>
                )}
              </Label>
              <div className="border rounded-lg overflow-hidden bg-muted/30 max-w-md mx-auto">
                <canvas 
                  ref={showRedactions ? previewCanvasRef : originalCanvasRef} 
                  className="w-full h-auto" 
                />
              </div>
            </div>
          )}
        </div>

        {/* Selection Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Detected PII</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
              <Button variant="ghost" size="sm" onClick={selectNone}>None</Button>
            </div>
          </div>

          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {redactionGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sensitive data detected</p>
                </div>
              ) : (
                redactionGroups.map(group => (
                  <div
                    key={group.category}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      group.selected 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-muted/30 border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => toggleCategory(group.category)}
                  >
                    <Checkbox
                      checked={group.selected}
                      onCheckedChange={() => toggleCategory(group.category)}
                    />
                    <span className="text-lg">{group.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{group.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.count} instance{group.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge 
                      variant={group.severity === 'high' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {group.severity}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Selected for redaction:</span>
              <span className="font-semibold">{totalSelected} of {totalDetected}</span>
            </div>

            {totalSelected > 0 && totalSelected < totalDetected && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                <span>Some PII will not be redacted</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleApprove}
                disabled={isApproving || totalSelected === 0}
              >
                {isApproving ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Applying...</>
                ) : (
                  <><Check className="h-4 w-4 mr-1" /> Apply Redactions</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
