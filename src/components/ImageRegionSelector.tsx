import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crop, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ImageRegionSelectorProps {
  imageUrl: string;
  onRegionSelected: (metadata: Record<string, string>) => void;
  extractionFields: Array<{ name: string; description: string }>;
}

export const ImageRegionSelector = ({ 
  imageUrl, 
  onRegionSelected,
  extractionFields 
}: ImageRegionSelectorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Fetch the image as a blob to avoid CORS issues
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.onload = () => {
          setImage(img);
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            // Set reasonable max dimensions
            const maxWidth = 1200;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            redrawCanvasWithZoom(canvas, img, zoom);
          }
          // Clean up blob URL
          URL.revokeObjectURL(objectUrl);
        };
        
        img.onerror = () => {
          console.error('Failed to load image for region selector');
          toast({
            title: 'Image Load Error',
            description: 'Failed to load image for region selection',
            variant: 'destructive',
          });
          URL.revokeObjectURL(objectUrl);
        };
        
        img.src = objectUrl;
      } catch (error) {
        console.error('Error loading image:', error);
        toast({
          title: 'Image Load Error',
          description: 'Could not load image for selection',
          variant: 'destructive',
        });
      }
    };

    loadImage();
  }, [imageUrl, toast]);

  const redrawCanvasWithZoom = (canvas: HTMLCanvasElement, img: HTMLImageElement, zoomLevel: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw image with zoom
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    ctx.drawImage(img, 0, 0, canvas.width / zoomLevel, canvas.height / zoomLevel);
    ctx.restore();

    // Draw selection rectangle
    if (startPoint && endPoint) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const width = endPoint.x - startPoint.x;
      const height = endPoint.y - startPoint.y;
      ctx.strokeRect(startPoint.x, startPoint.y, width, height);
      
      // Fill with semi-transparent blue
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(startPoint.x, startPoint.y, width, height);
    }
  };

  const redrawCanvas = () => {
    if (!canvasRef.current || !image) return;
    redrawCanvasWithZoom(canvasRef.current, image, zoom);
  };

  useEffect(() => {
    redrawCanvas();
  }, [startPoint, endPoint, image, zoom]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setStartPoint(coords);
    setEndPoint(coords);
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting) return;
    const coords = getCanvasCoordinates(e);
    setEndPoint(coords);
  };

  const handleMouseUp = async () => {
    if (!isSelecting || !startPoint || !endPoint) return;
    setIsSelecting(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate crop dimensions
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width < 10 || height < 10) {
      toast({
        title: 'Selection too small',
        description: 'Please select a larger area',
        variant: 'destructive',
      });
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    setIsProcessing(true);

    try {
      // Create a new canvas for the cropped region
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = width;
      cropCanvas.height = height;
      const cropCtx = cropCanvas.getContext('2d');
      
      if (!cropCtx || !image) throw new Error('Canvas context not available');

      // Draw the cropped region from the canvas (not the image element)
      const sourceCanvas = canvas;
      const sourceCtx = sourceCanvas.getContext('2d');
      if (!sourceCtx) throw new Error('Source canvas context not available');
      
      const imageData = sourceCtx.getImageData(x, y, width, height);
      cropCtx.putImageData(imageData, 0, 0);

      const croppedImageData = cropCanvas.toDataURL('image/png');

      // Run OCR on the selected region (table extraction not applicable for region selection)
      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: { 
          imageData: croppedImageData,
          isPdf: false,
          extractionFields: extractionFields
        },
      });

      if (error) throw error;

      toast({
        title: 'Region Processed',
        description: 'OCR completed on selected region',
      });

      onRegionSelected(data.metadata || {});

      // Reset selection
      setStartPoint(null);
      setEndPoint(null);
      redrawCanvas();
    } catch (error: any) {
      console.error('Error processing region:', error);
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process the selected region',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStartPoint(null);
    setEndPoint(null);
    redrawCanvas();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Crop className="h-4 w-4" />
            Select Region to Re-OCR
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Click and drag to select an area for OCR correction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="h-8 px-2"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium px-2 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="h-8 px-2"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!startPoint && !endPoint}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>
      <div className="relative overflow-auto bg-muted/30 rounded-lg" style={{ maxHeight: 'min(70vh, 800px)' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsSelecting(false)}
          className="cursor-crosshair w-full h-auto"
          style={{ display: 'block', maxWidth: '100%' }}
        />
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm">Processing region...</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};