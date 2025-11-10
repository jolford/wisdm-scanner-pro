import { useState, useEffect, useRef } from 'react';
import { Canvas as FabricCanvas, Rect, FabricImage } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trash2, Edit2, Save, X } from 'lucide-react';
import { REGEX_PATTERNS, type PatternName } from '@/lib/regex-patterns';

interface Zone {
  id: string;
  fieldName: string;
  fieldType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rect?: Rect;
  validation_pattern?: string;
  validation_flags?: string;
}

interface ZoneTemplateEditorProps {
  imageUrl: string;
  onSave: (zones: Omit<Zone, 'id' | 'rect'>[]) => Promise<void>;
  onCancel: () => void;
  initialZones?: Zone[];
}

export function ZoneTemplateEditor({ imageUrl, onSave, onCancel, initialZones = [] }: ZoneTemplateEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [tempFieldName, setTempFieldName] = useState('');
  const [tempFieldType, setTempFieldType] = useState('text');
  const [tempPattern, setTempPattern] = useState('');
  const [tempFlags, setTempFlags] = useState('i');
  const [pendingZone, setPendingZone] = useState<Rect | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1000,
      height: 700,
      backgroundColor: '#f5f5f5',
      selection: false,
    });

    setFabricCanvas(canvas);

    // Load background image
    FabricImage.fromURL(imageUrl).then((img) => {
      const canvasWidth = 1000;
      const canvasHeight = 700;
      
      const scale = Math.min(
        canvasWidth / img.width!,
        canvasHeight / img.height!
      );
      
      img.scale(scale);
      img.set({
        selectable: false,
        evented: false,
        left: (canvasWidth - img.width! * scale) / 2,
        top: (canvasHeight - img.height! * scale) / 2,
      });
      
      canvas.backgroundImage = img;
      setImageSize({ width: img.width! * scale, height: img.height! * scale });
      canvas.renderAll();
    });

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  // Load initial zones when provided and canvas is ready
  useEffect(() => {
    if (!fabricCanvas || initialZones.length === 0) return;
    
    // Clear existing zones first
    const objects = fabricCanvas.getObjects();
    objects.forEach(obj => {
      if (obj instanceof Rect && obj !== fabricCanvas.backgroundImage) {
        fabricCanvas.remove(obj);
      }
    });

    const loadedZones = initialZones.map((zone) => {
      const rect = new Rect({
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: 'rgb(59, 130, 246)',
        strokeWidth: 2,
        selectable: true,
      });
      
      fabricCanvas.add(rect);
      
      return {
        ...zone,
        rect,
      };
    });
    
    setZones(loadedZones);
    fabricCanvas.renderAll();
  }, [fabricCanvas]);

  const startDrawing = () => {
    if (!fabricCanvas) return;
    setIsDrawing(true);
    
    let isDown = false;
    let rect: Rect | null = null;
    let startX = 0;
    let startY = 0;

    const mouseDown = (o: any) => {
      if (!isDown) {
        isDown = true;
        const pointer = fabricCanvas.getPointer(o.e);
        startX = pointer.x;
        startY = pointer.y;
        
        rect = new Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: 'rgba(59, 130, 246, 0.2)',
          stroke: 'rgb(59, 130, 246)',
          strokeWidth: 2,
          selectable: false,
        });
        
        fabricCanvas.add(rect);
      }
    };

    const mouseMove = (o: any) => {
      if (!isDown || !rect) return;
      const pointer = fabricCanvas.getPointer(o.e);
      
      if (pointer.x < startX) {
        rect.set({ left: pointer.x });
      }
      if (pointer.y < startY) {
        rect.set({ top: pointer.y });
      }
      
      rect.set({
        width: Math.abs(pointer.x - startX),
        height: Math.abs(pointer.y - startY),
      });
      
      fabricCanvas.renderAll();
    };

    const mouseUp = () => {
      if (!isDown || !rect) return;
      isDown = false;
      
      if (rect.width! < 20 || rect.height! < 20) {
        fabricCanvas.remove(rect);
        toast.error('Zone too small. Draw a larger area.');
        return;
      }
      
      setPendingZone(rect);
      setShowNameDialog(true);
      setIsDrawing(false);
      
      fabricCanvas.off('mouse:down', mouseDown);
      fabricCanvas.off('mouse:move', mouseMove);
      fabricCanvas.off('mouse:up', mouseUp);
    };

    fabricCanvas.on('mouse:down', mouseDown);
    fabricCanvas.on('mouse:move', mouseMove);
    fabricCanvas.on('mouse:up', mouseUp);
  };

  const saveZone = () => {
    if (!pendingZone || !tempFieldName.trim()) {
      toast.error('Please enter a field name');
      return;
    }

    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      fieldName: tempFieldName,
      fieldType: tempFieldType,
      x: Math.round(pendingZone.left!),
      y: Math.round(pendingZone.top!),
      width: Math.round(pendingZone.width!),
      height: Math.round(pendingZone.height!),
      rect: pendingZone,
      validation_pattern: tempPattern || undefined,
      validation_flags: tempFlags === 'none' ? '' : (tempFlags || 'i'),
    };

    pendingZone.set({ selectable: true });
    
    setZones([...zones, newZone]);
    setShowNameDialog(false);
    setTempFieldName('');
    setTempFieldType('text');
    setTempPattern('');
    setTempFlags('i');
    setPendingZone(null);
    toast.success(`Zone "${tempFieldName}" created`);
  };

  const deleteZone = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (zone?.rect && fabricCanvas) {
      fabricCanvas.remove(zone.rect);
    }
    setZones(zones.filter(z => z.id !== zoneId));
    toast.success('Zone deleted');
  };

  const handleSave = async () => {
    if (zones.length === 0) {
      toast.error('Please create at least one zone');
      return;
    }

    const zonesToSave = zones.map(({ fieldName, fieldType, x, y, width, height, validation_pattern, validation_flags }) => ({
      fieldName,
      fieldType,
      x,
      y,
      width,
      height,
      validation_pattern,
      validation_flags,
    }));

    await onSave(zonesToSave);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={startDrawing} disabled={isDrawing}>
          {isDrawing ? 'Drawing...' : 'Draw New Zone'}
        </Button>
        <Button onClick={handleSave} variant="default" disabled={zones.length === 0}>
          <Save className="h-4 w-4 mr-2" />
          Save Template
        </Button>
        <Button onClick={onCancel} variant="outline">
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4">
        <Card className="p-4">
          <canvas ref={canvasRef} className="border rounded" />
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Defined Zones ({zones.length})</h3>
          <div className="space-y-2">
            {zones.map((zone) => (
              <div key={zone.id} className="p-3 bg-muted rounded flex justify-between items-start">
                <div>
                  <p className="font-medium">{zone.fieldName}</p>
                  <p className="text-xs text-muted-foreground">
                    Type: {zone.fieldType}
                  </p>
                  {zone.validation_pattern && (
                    <p className="text-xs text-muted-foreground">
                      Pattern: <code className="bg-background px-1 py-0.5 rounded">{zone.validation_pattern.substring(0, 30)}{zone.validation_pattern.length > 30 ? '...' : ''}</code>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Position: {zone.x}, {zone.y}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Size: {zone.width} × {zone.height}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteZone(zone.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Field Name</Label>
              <Input
                value={tempFieldName}
                onChange={(e) => setTempFieldName(e.target.value)}
                placeholder="e.g., Customer Name, Invoice Number"
              />
            </div>
            <div>
              <Label>Field Type</Label>
              <Select value={tempFieldType} onValueChange={setTempFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Validation Pattern (Optional)</Label>
              <Select value={tempPattern || 'none'} onValueChange={(val) => setTempPattern(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pattern or leave blank" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] bg-background z-50">
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(REGEX_PATTERNS).map(([name, pattern]) => (
                    <SelectItem key={name} value={pattern}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Pattern...</SelectItem>
                </SelectContent>
              </Select>
              {tempPattern === 'custom' && (
                <Input
                  placeholder="Enter regex pattern"
                  value={tempPattern}
                  onChange={(e) => setTempPattern(e.target.value)}
                  className="mt-2"
                />
              )}
              {tempPattern && tempPattern !== 'custom' && tempPattern !== 'none' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pattern: <code className="bg-muted px-1 py-0.5 rounded">{tempPattern}</code>
                </p>
              )}
            </div>

            <div>
              <Label>Pattern Flags</Label>
              <Select value={tempFlags || 'none'} onValueChange={(val) => setTempFlags(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="i">Case Insensitive (i)</SelectItem>
                  <SelectItem value="gi">Global + Case Insensitive (gi)</SelectItem>
                  <SelectItem value="g">Global (g)</SelectItem>
                  <SelectItem value="none">Case Sensitive (no flags)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (pendingZone && fabricCanvas) {
                fabricCanvas.remove(pendingZone);
              }
              setShowNameDialog(false);
              setPendingZone(null);
              setTempFieldName('');
            }}>
              Cancel
            </Button>
            <Button onClick={saveZone}>Save Zone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
