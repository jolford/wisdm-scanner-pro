import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crop, RotateCcw } from 'lucide-react';
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
  const { toast } = useToast();

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const redrawCanvas = () => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

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

  useEffect(() => {
    redrawCanvas();
  }, [startPoint, endPoint, image]);

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

      // Draw the cropped region
      cropCtx.drawImage(
        image,
        x, y, width, height,
        0, 0, width, height
      );

      const croppedImageData = cropCanvas.toDataURL('image/png');

      // Run OCR on the selected region
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
      <div className="relative overflow-auto max-h-[500px] bg-muted/30 rounded-lg">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsSelecting(false)}
          className="cursor-crosshair max-w-full h-auto"
          style={{ display: 'block' }}
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