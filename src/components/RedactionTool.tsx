// React hooks for component lifecycle and state management
import { useRef, useState, useEffect } from 'react';

// UI components from shadcn/ui
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Icon imports for visual indicators
import { Eraser, Save, Undo, X, Wand2, AlertTriangle } from 'lucide-react';

// Custom hooks and utilities
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { detectKeywords, generateRedactionBoxes, mergeRedactionBoxes, type DetectedKeyword } from '@/lib/keyword-redaction';

/**
 * RedactionBox structure defining a rectangular area to redact on the image
 * Coordinates are in image pixels (not screen pixels)
 */
interface RedactionBox {
  x: number;        // X coordinate of top-left corner
  y: number;        // Y coordinate of top-left corner
  width: number;    // Width of the redaction box
  height: number;   // Height of the redaction box
}

/**
 * Props for the RedactionTool component
 */
interface RedactionToolProps {
  imageUrl: string;                      // URL of the image to redact
  documentId: string;                    // Document ID for saving redacted version
  ocrText?: string;                      // OCR text for keyword detection
  ocrMetadata?: any;                     // OCR metadata with bounding boxes
  onRedactionSaved: (redactedUrl: string, isPermanent: boolean) => void; // Callback when redaction is saved
  onCancel: () => void;                  // Callback to cancel redaction
}

/**
 * RedactionTool Component
 * Interactive canvas-based tool for redacting sensitive information from documents
 * Features:
 * - Draw rectangular redaction boxes on images
 * - Choice between permanent redaction or creating a redacted version
 * - Undo functionality for removing boxes
 * - Saves redacted image to Supabase Storage
 * - Updates document record with redaction metadata
 */
export const RedactionTool = ({ 
  imageUrl, 
  documentId,
  ocrText,
  ocrMetadata,
  onRedactionSaved,
  onCancel 
}: RedactionToolProps) => {
  // Refs for canvas and image elements
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);                    // Is user currently drawing a box
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null); // Starting point of current box
  const [redactionBoxes, setRedactionBoxes] = useState<RedactionBox[]>([]); // All completed redaction boxes
  
  // Keyword detection state
  const [detectedKeywords, setDetectedKeywords] = useState<DetectedKeyword[]>([]);
  const [showKeywordAlert, setShowKeywordAlert] = useState(false);
  
  // Redaction settings
  const [redactionMode, setRedactionMode] = useState<'permanent' | 'version'>('version'); // Permanent or create version
  const [isSaving, setIsSaving] = useState(false);                      // Save operation in progress
  
  const { toast } = useToast();

  /**
   * Detect keywords in OCR data when component mounts
   */
  useEffect(() => {
    if (ocrText && ocrText.length > 0) {
      const detected = detectKeywords(ocrText, ocrMetadata);
      setDetectedKeywords(detected);
      setShowKeywordAlert(detected.length > 0);
    }
  }, [ocrText, ocrMetadata]);

  /**
   * Load image onto canvas when component mounts or imageUrl changes
   * Sets up the canvas dimensions to match the image size
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';  // Required for canvas toBlob to work with external images
    img.onload = () => {
      imageRef.current = img;
      // Set canvas size to match image dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      redrawCanvas();  // Draw the image
    };
    img.src = imageUrl;
  }, [imageUrl]);

  /**
   * Redraw the entire canvas including image and all redaction boxes
   * Called after any change to the redaction boxes
   */
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // Clear canvas and draw the original image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw all completed redaction boxes as solid black rectangles
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';  // Solid black (100% opacity)
    redactionBoxes.forEach(box => {
      ctx.fillRect(box.x, box.y, box.width, box.height);
    });
  };

  // Redraw canvas whenever redaction boxes change
  useEffect(() => {
    redrawCanvas();
  }, [redactionBoxes]);

  /**
   * Convert mouse event coordinates to canvas pixel coordinates
   * Accounts for canvas scaling/sizing in the browser
   * @param e - Mouse event from canvas interaction
   * @returns Coordinates in canvas pixel space
   */
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    // Get canvas position and size in the browser
    const rect = canvas.getBoundingClientRect();
    // Calculate scale factors (canvas size vs displayed size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Convert browser coordinates to canvas coordinates
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  /**
   * Handle mouse down event - start drawing a new redaction box
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setStartPoint(coords);
    setIsDrawing(true);
  };

  /**
   * Handle mouse move event - show preview of redaction box being drawn
   * Only active when isDrawing is true (mouse is held down)
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPoint = getCanvasCoordinates(e);
    
    // Redraw everything (image + completed boxes)
    redrawCanvas();

    // Draw the current rectangle being created (semi-transparent preview)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';        // Semi-transparent black
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';  // White outline
    ctx.lineWidth = 2;
    
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;
    
    ctx.fillRect(startPoint.x, startPoint.y, width, height);
    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
  };

  /**
   * Handle mouse up event - complete the redaction box and add to list
   */
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const currentPoint = getCanvasCoordinates(e);
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;

    // Only add box if it has meaningful size (not just a click)
    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      // Normalize coordinates (handle negative width/height from right-to-left or bottom-to-top drawing)
      const newBox: RedactionBox = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(width),
        height: Math.abs(height)
      };
      
      setRedactionBoxes(prev => [...prev, newBox]);
    }

    // Reset drawing state
    setIsDrawing(false);
    setStartPoint(null);
  };

  /**
   * Remove the most recently added redaction box
   */
  const handleUndo = () => {
    setRedactionBoxes(prev => prev.slice(0, -1));  // Remove last item
  };

  /**
   * Apply automatic redaction based on detected keywords
   */
  const handleAutoRedact = () => {
    if (detectedKeywords.length === 0) {
      toast({
        title: 'No Keywords Detected',
        description: 'No sensitive keywords were found in the document',
        variant: 'destructive'
      });
      return;
    }

    // Generate redaction boxes from detected keywords
    const autoBoxes = generateRedactionBoxes(detectedKeywords, 15);
    
    // Merge overlapping boxes for cleaner redaction
    const mergedBoxes = mergeRedactionBoxes(autoBoxes, 30);
    
    // Add to existing boxes
    setRedactionBoxes(prev => [...prev, ...mergedBoxes]);
    
    toast({
      title: 'Auto-Redaction Applied',
      description: `Added ${mergedBoxes.length} redaction boxes for ${detectedKeywords.length} keyword(s)`
    });
    
    setShowKeywordAlert(false);
  };

  /**
   * Save the redacted image to storage and update the document record
   * Process:
   * 1. Convert canvas to image blob
   * 2. Upload to Supabase Storage
   * 3. Update document record with redacted URL and metadata
   */
  const handleSaveRedaction = async () => {
    // Validation: ensure at least one redaction box exists
    if (redactionBoxes.length === 0) {
      toast({
        title: 'No Redactions',
        description: 'Please draw at least one redaction box',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');

      // Convert canvas to blob (PNG image)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      // Upload redacted image to Supabase Storage
      const fileName = `redacted_${documentId}_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: false  // Don't overwrite if file exists
        });

      if (uploadError) throw uploadError;

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Prepare redaction metadata for storage
      const redactionMetadata = {
        redacted_at: new Date().toISOString(),
        redaction_boxes: redactionBoxes.map(box => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        })),
        mode: redactionMode
      };

      // Update document record based on redaction mode
      // Permanent: replace original file_url
      // Version: store in redacted_file_url (preserves original)
      const updateData = redactionMode === 'permanent'
        ? {
            file_url: publicUrl,                      // Replace original
            redaction_metadata: redactionMetadata as any
          }
        : {
            redacted_file_url: publicUrl,             // Keep original, add redacted version
            redaction_metadata: redactionMetadata as any
          };

      const { error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) throw updateError;

      // Success notification
      toast({
        title: 'Redaction Saved',
        description: redactionMode === 'permanent' 
          ? 'Original document has been permanently redacted'
          : 'Redacted version created, original preserved'
      });

      // Callback to parent component
      onRedactionSaved(publicUrl, redactionMode === 'permanent');
    } catch (error: any) {
      console.error('Error saving redaction:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save redacted document',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eraser className="h-5 w-5" />
          <h3 className="font-semibold">Redaction Tool</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Keyword Detection Alert */}
        {showKeywordAlert && detectedKeywords.length > 0 && (
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="ml-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold mb-2">Sensitive Keywords Detected</p>
                  <p className="text-sm mb-2">
                    Found {detectedKeywords.length} keyword(s) that may require redaction for compliance with fair housing laws (e.g., CA AB 1466):
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {detectedKeywords.slice(0, 10).map((kw, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {kw.term} ({kw.matches.length})
                      </Badge>
                    ))}
                    {detectedKeywords.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{detectedKeywords.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleAutoRedact}
                  className="shrink-0"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Auto-Redact
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div>
          <Label className="text-sm font-medium mb-2 block">Redaction Mode</Label>
          <RadioGroup
            value={redactionMode}
            onValueChange={(value) => setRedactionMode(value as 'permanent' | 'version')}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="version" id="version" />
              <Label htmlFor="version" className="font-normal cursor-pointer">
                Create Version (Preserve Original)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="permanent" id="permanent" />
              <Label htmlFor="permanent" className="font-normal cursor-pointer">
                Permanent (Replace Original)
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="border rounded-lg p-2 bg-muted/30 overflow-auto max-h-[500px]">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="cursor-crosshair max-w-full h-auto"
            style={{ display: 'block' }}
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <div className="flex-1">
            <p className="mb-1">💡 <strong>Manual:</strong> Click and drag to draw redaction boxes</p>
            {detectedKeywords.length > 0 && (
              <p>🤖 <strong>Auto:</strong> Click "Auto-Redact" to automatically redact detected sensitive keywords</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {detectedKeywords.length > 0 && redactionBoxes.length === 0 && (
            <Button
              onClick={handleAutoRedact}
              variant="secondary"
              className="flex-1"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Auto-Redact Keywords
            </Button>
          )}
          <Button
            onClick={handleUndo}
            variant="outline"
            disabled={redactionBoxes.length === 0 || isSaving}
            className="flex-1"
          >
            <Undo className="h-4 w-4 mr-2" />
            Undo Last ({redactionBoxes.length})
          </Button>
          <Button
            onClick={handleSaveRedaction}
            disabled={redactionBoxes.length === 0 || isSaving}
            className="flex-1 bg-gradient-to-r from-primary to-accent"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Redaction'}
          </Button>
        </div>
      </div>
    </Card>
  );
};