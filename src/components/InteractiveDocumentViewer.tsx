import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCw, MousePointer, Highlighter, Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InteractiveDocumentViewerProps {
  imageUrl: string;
  fileName: string;
  boundingBoxes?: Record<string, BoundingBox>;
  onFieldClick?: (fieldName: string) => void;
  onRegionClick?: (x: number, y: number) => void;
  highlightedField?: string | null;
  offensiveHighlights?: Array<{
    text: string;
    category: string;
    severity: string;
    reason: string;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
  }>;
}

export const InteractiveDocumentViewer = ({
  imageUrl,
  fileName,
  boundingBoxes = {},
  onFieldClick,
  onRegionClick,
  highlightedField,
  offensiveHighlights = []
}: InteractiveDocumentViewerProps) => {
  const { toast } = useToast();
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [clickMode, setClickMode] = useState<'highlight' | 'extract'>('highlight');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Load image and get dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Keep canvas in sync with image size (handles page/container resize)
  useEffect(() => {
    const imgEl = imageRef.current;
    const canvas = canvasRef.current;
    if (!imgEl || !canvas) return;

    const updateSize = () => {
      const w = imgEl.offsetWidth;
      const h = imgEl.offsetHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        setCanvasSize({ width: w, height: h });
      }
    };

    updateSize();

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(imgEl);
    window.addEventListener('resize', updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [imageUrl]);

  // Draw highlights on canvas
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !boundingBoxes) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size to match displayed image
    const img = imageRef.current;
    canvas.width = img.offsetWidth;
    canvas.height = img.offsetHeight;

    // Draw bounding boxes
    Object.entries(boundingBoxes).forEach(([fieldName, bbox]) => {
      if (!bbox || typeof bbox.x !== 'number') return;

      const isHighlighted = highlightedField === fieldName;
      
      // Convert percentage to pixels
      const x = (bbox.x / 100) * canvas.width;
      const y = (bbox.y / 100) * canvas.height;
      const width = (bbox.width / 100) * canvas.width;
      const height = (bbox.height / 100) * canvas.height;

      // Draw highlight box
      ctx.strokeStyle = isHighlighted ? '#3b82f6' : '#10b981';
      ctx.lineWidth = isHighlighted ? 3 : 2;
      ctx.fillStyle = isHighlighted ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.1)';
      
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Draw field label
      ctx.fillStyle = isHighlighted ? '#3b82f6' : '#10b981';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(fieldName, x, y - 5);
    });

    // Draw offensive language highlights
    offensiveHighlights.forEach((highlight) => {
      if (!highlight.boundingBox) return;
      
      const bbox = highlight.boundingBox;
      // Convert percentage to pixels
      const x = (bbox.x / 100) * canvas.width;
      const y = (bbox.y / 100) * canvas.height;
      const width = (bbox.width / 100) * canvas.width;
      const height = (bbox.height / 100) * canvas.height;

      // Draw yellow highlight for offensive language
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Draw warning label
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('⚠️ ' + highlight.category, x, y - 5);
    });
  }, [boundingBoxes, highlightedField, imageZoom, offensiveHighlights, canvasSize]);

  // Pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.button === 0 && e.shiftKey) || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return; // Don't trigger click when panning
    if (!canvasRef.current || !onRegionClick) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate click position relative to canvas
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (clickMode === 'extract') {
      onRegionClick(x, y);
    } else {
      // Check if click is within any bounding box
      Object.entries(boundingBoxes).forEach(([fieldName, bbox]) => {
        if (!bbox) return;
        
        const clickX = x;
        const clickY = y;
        
        if (
          clickX >= bbox.x && 
          clickX <= bbox.x + bbox.width &&
          clickY >= bbox.y && 
          clickY <= bbox.y + bbox.height
        ) {
          onFieldClick?.(fieldName);
        }
      });
    }
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setImageZoom(prev => Math.max(0.25, Math.min(prev + delta, 5)));
  };

  const handleFitToWidth = () => {
    if (!containerRef.current || !imageDimensions.width) return;
    const containerWidth = containerRef.current.clientWidth - 32; // padding
    const zoom = containerWidth / imageDimensions.width;
    setImageZoom(zoom);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFitToHeight = () => {
    if (!containerRef.current || !imageDimensions.height) return;
    const containerHeight = containerRef.current.clientHeight - 32; // padding
    const zoom = containerHeight / imageDimensions.height;
    setImageZoom(zoom);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleActualSize = () => {
    setImageZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleReset = () => {
    setImageZoom(1);
    setImageRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
    if (!cardRef.current) return;
    
    if (!document.fullscreenElement) {
      try {
        await cardRef.current.requestFullscreen();
        setIsFullscreen(true);
        toast({ title: "Fullscreen mode", description: "Press F or ESC to exit" });
      } catch (err) {
        toast({ title: "Fullscreen failed", description: "Your browser may not support fullscreen", variant: "destructive" });
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          handleZoom(0.25);
          break;
        case '-':
          e.preventDefault();
          handleZoom(-0.25);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleReset();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault();
            setImageRotation(prev => (prev - 90 + 360) % 360);
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault();
            setImageRotation(prev => (prev + 90) % 360);
          }
          break;
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [imageZoom, imageRotation, panOffset]);

  return (
    <TooltipProvider>
      <Card ref={cardRef} className="p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Highlighter className="h-4 w-4" />
            Document Viewer
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              {Math.round(imageZoom * 100)}%
            </Badge>
            <Badge variant="outline">{fileName}</Badge>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleZoom(0.25)}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In (+)</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleZoom(-0.25)}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out (-)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFitToWidth}
                className="text-xs"
              >
                Fit Width
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to container width</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFitToHeight}
                className="text-xs"
              >
                Fit Height
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to container height</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleActualSize}
                className="text-xs"
              >
                100%
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actual size</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageRotation(prev => (prev + 90) % 360)}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate (Shift + Arrow)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fullscreen (F)</TooltipContent>
          </Tooltip>

          <div className="ml-auto flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={clickMode === 'highlight' ? 'default' : 'outline'}
                  onClick={() => setClickMode('highlight')}
                >
                  <Highlighter className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Click to highlight field</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={clickMode === 'extract' ? 'default' : 'outline'}
                  onClick={() => setClickMode('extract')}
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Click to extract text at position</TooltipContent>
            </Tooltip>
          </div>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="text-xs"
          >
            Reset (R)
          </Button>
        </div>

        {/* Document with overlay */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden bg-muted/30 rounded-lg p-4 relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning ? 'grabbing' : (imageZoom > 1 ? 'grab' : 'default') }}
        >
          <div 
            className="relative inline-block transition-transform"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
            }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Document"
              className="w-full h-auto object-contain transition-transform select-none"
              style={{
                transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                transformOrigin: 'center center'
              }}
              onLoad={() => {
                // Trigger canvas redraw when image loads
                if (canvasRef.current && imageRef.current) {
                  const canvas = canvasRef.current;
                  const w = imageRef.current.offsetWidth;
                  const h = imageRef.current.offsetHeight;
                  canvas.width = w;
                  canvas.height = h;
                  setCanvasSize({ width: w, height: h });
                }
              }}
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="absolute top-0 left-0 pointer-events-auto select-none"
              style={{
                transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                transformOrigin: 'center center',
                cursor: isPanning ? 'grabbing' : (clickMode === 'extract' ? 'crosshair' : 'pointer')
              }}
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground space-y-1">
          {clickMode === 'highlight' ? (
            <p>💡 Click on highlighted regions to focus on that field</p>
          ) : (
            <p>💡 Click anywhere on the document to extract text at that position</p>
          )}
          <p className="text-muted-foreground/70">
            ⌨️ Shortcuts: +/- zoom | Shift+drag pan | R reset | F fullscreen | Shift+arrows rotate
          </p>
        </div>
      </Card>
    </TooltipProvider>
  );
};
