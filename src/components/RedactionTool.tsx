import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eraser, Save, Undo, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RedactionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RedactionToolProps {
  imageUrl: string;
  documentId: string;
  onRedactionSaved: (redactedUrl: string, isPermanent: boolean) => void;
  onCancel: () => void;
}

export const RedactionTool = ({ 
  imageUrl, 
  documentId, 
  onRedactionSaved,
  onCancel 
}: RedactionToolProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [redactionBoxes, setRedactionBoxes] = useState<RedactionBox[]>([]);
  const [redactionMode, setRedactionMode] = useState<'permanent' | 'version'>('version');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      canvas.width = img.width;
      canvas.height = img.height;
      redrawCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw all redaction boxes
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    redactionBoxes.forEach(box => {
      ctx.fillRect(box.x, box.y, box.width, box.height);
    });
  };

  useEffect(() => {
    redrawCanvas();
  }, [redactionBoxes]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setStartPoint(coords);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPoint = getCanvasCoordinates(e);
    
    // Redraw everything
    redrawCanvas();

    // Draw current rectangle being created
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;
    
    ctx.fillRect(startPoint.x, startPoint.y, width, height);
    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const currentPoint = getCanvasCoordinates(e);
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;

    // Only add box if it has some size
    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      const newBox: RedactionBox = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(width),
        height: Math.abs(height)
      };
      
      setRedactionBoxes(prev => [...prev, newBox]);
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  const handleUndo = () => {
    setRedactionBoxes(prev => prev.slice(0, -1));
  };

  const handleSaveRedaction = async () => {
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

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      // Upload to storage
      const fileName = `redacted_${documentId}_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Update document record with properly typed metadata
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

      const updateData = redactionMode === 'permanent'
        ? {
            file_url: publicUrl,
            redaction_metadata: redactionMetadata as any
          }
        : {
            redacted_file_url: publicUrl,
            redaction_metadata: redactionMetadata as any
          };

      const { error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) throw updateError;

      toast({
        title: 'Redaction Saved',
        description: redactionMode === 'permanent' 
          ? 'Original document has been permanently redacted'
          : 'Redacted version created, original preserved'
      });

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

        <p className="text-xs text-muted-foreground">
          💡 Click and drag to draw redaction boxes. Redacted areas will appear as black boxes.
        </p>

        <div className="flex gap-2">
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