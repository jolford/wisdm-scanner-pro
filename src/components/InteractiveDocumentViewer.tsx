import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCw, MousePointer, Highlighter, Maximize2, Minimize2, ExternalLink, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ViewOriginalButton } from './ViewOriginalButton';
import { DocumentThumbnailNav } from './DocumentThumbnailNav';
import { useDocumentCache } from '@/hooks/use-document-cache';
import { usePDFViewer } from '@/hooks/use-pdf-viewer';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InteractiveDocumentViewerProps {
  imageUrl: string;
  fileName: string;
  documentId?: string;
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
  piiRegions?: Array<{ type: string; category: string; text: string; bbox?: any }>; 
  ab1466Violations?: Array<{ term: string; category: string; text: string; boundingBox?: BoundingBox }>;
  showingOriginal?: boolean;
  onToggleOriginal?: () => void;
  piiDebug?: boolean;
  onPopout?: () => void;
}

export const InteractiveDocumentViewer = ({
  imageUrl,
  fileName,
  documentId,
  boundingBoxes = {},
  onFieldClick,
  onRegionClick,
  highlightedField,
  offensiveHighlights = [],
  piiRegions = [],
  ab1466Violations = [],
  showingOriginal = false,
  onToggleOriginal,
  piiDebug = false,
  onPopout
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
  const [imageLoading, setImageLoading] = useState(true);
  const [thumbnailsCollapsed, setThumbnailsCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isPdf = typeof imageUrl === 'string' && imageUrl.toLowerCase().includes('.pdf');
  
  // Use the image URL directly - stabilization was causing issues
  const displayImageUrl = imageUrl;
  
  // Track which URL we've already loaded to prevent re-loading
  const loadedUrlRef = useRef<string | null>(null);
  
  // Enhanced hooks
  const { preloadImage, getCachedImage } = useDocumentCache();
  const {
    pdfDoc,
    pages,
    currentPage,
    setCurrentPage,
    totalPages,
    isLoading: pdfLoading,
    error: pdfError,
    renderPage,
    generateThumbnail,
    getPageText
  } = usePDFViewer(isPdf ? displayImageUrl : null);
  
  // Load image with caching (only for non-PDF images)
  useEffect(() => {
    if (!displayImageUrl || isPdf) return;
    
    // Skip if we've already loaded this URL
    const baseUrl = displayImageUrl.split('?')[0];
    if (loadedUrlRef.current === baseUrl) return;
    
    setImageLoading(true);
    loadedUrlRef.current = baseUrl;
    
    preloadImage(displayImageUrl)
      .then((img) => {
        setImageDimensions({ width: img.width, height: img.height });
        setImageLoading(false);
      })
      .catch((err) => {
        console.error('Error preloading image:', err);
        setImageLoading(false);
        loadedUrlRef.current = null; // Allow retry on error
      });
  }, [displayImageUrl, isPdf]); // Removed preloadImage from deps

  // Keep canvas in sync with image size (handles page/container resize) - images only
  useEffect(() => {
    if (isPdf) return; // no canvas overlay sizing for PDFs
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
  }, [imageUrl, isPdf]);

  // Draw highlights on canvas (images only)
  useEffect(() => {
    if (isPdf) return;
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

    // Draw PII redaction boxes (only if not showing original)
    if (!showingOriginal && piiRegions && piiRegions.length > 0) {
      piiRegions.forEach((region) => {
        if (!region.bbox) return;
        const raw = region.bbox;
        const bx = Number(raw.x); const by = Number(raw.y); const bw = Number(raw.width); const bh = Number(raw.height);
        if (![bx,by,bw,bh].every((n) => isFinite(n))) return;
        const isPercent = bx <= 100 && by <= 100 && bw <= 100 && bh <= 100;
        const x = isPercent ? (bx / 100) * canvas.width : bx;
        const y = isPercent ? (by / 100) * canvas.height : by;
        const width = isPercent ? (bw / 100) * canvas.width : bw;
        const height = isPercent ? (bh / 100) * canvas.height : bh;

        // Draw black redaction box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.90)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        if (piiDebug) {
          // Debug outline and label
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, width, height);
          ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
          ctx.font = 'bold 11px sans-serif';
          const label = `${region.category || 'PII'} (${Math.round((x / canvas.width) * 100)}%,${Math.round((y / canvas.height) * 100)}%)`;
          ctx.fillText(label, x, Math.max(10, y - 6));
        }
      });
    }

    // Draw AB1466 violation redaction boxes (black boxes over discriminatory text)
    if (!showingOriginal && ab1466Violations && ab1466Violations.length > 0) {
      ab1466Violations.forEach((violation) => {
        if (!violation.boundingBox) return;
        const bbox = violation.boundingBox;
        const bx = Number(bbox.x); const by = Number(bbox.y); const bw = Number(bbox.width); const bh = Number(bbox.height);
        if (![bx,by,bw,bh].every((n) => isFinite(n))) return;
        
        // Assume percentage coordinates (0-100)
        const isPercent = bx <= 100 && by <= 100 && bw <= 100 && bh <= 100;
        const x = isPercent ? (bx / 100) * canvas.width : bx;
        const y = isPercent ? (by / 100) * canvas.height : by;
        const width = isPercent ? (bw / 100) * canvas.width : bw;
        const height = isPercent ? (bh / 100) * canvas.height : bh;

        // Draw solid black redaction box for AB1466 violations
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
      });
    }
  }, [boundingBoxes, highlightedField, imageZoom, offensiveHighlights, canvasSize, piiRegions, ab1466Violations, showingOriginal, piiDebug, isPdf]);

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

  // Enhanced zoom controls with smooth transitions
  const handleZoom = (delta: number, centerX?: number, centerY?: number) => {
    console.log('[Zoom] handleZoom called with delta:', delta, 'current zoom:', imageZoom);
    setImageZoom(prev => {
      const newZoom = Math.max(0.25, Math.min(prev + delta, 5));
      console.log('[Zoom] Setting new zoom from', prev, 'to', newZoom);
      
      // Adjust pan offset to zoom towards mouse position
      if (centerX !== undefined && centerY !== undefined && containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const relX = (centerX - rect.left) / rect.width;
        const relY = (centerY - rect.top) / rect.height;
        
        const zoomRatio = newZoom / prev;
        setPanOffset(prevOffset => ({
          x: prevOffset.x * zoomRatio + (centerX - rect.left) * (1 - zoomRatio),
          y: prevOffset.y * zoomRatio + (centerY - rect.top) * (1 - zoomRatio)
        }));
      }
      
      return newZoom;
    });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleZoom(delta, e.clientX, e.clientY);
    }
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

  // Render PDF page when current page changes (use fixed scale for quality, CSS handles zoom)
  useEffect(() => {
    if (!isPdf || !pdfDoc || !pdfCanvasRef.current) return;

    const canvas = pdfCanvasRef.current;
    renderPage(currentPage, canvas, 2.0); // Fixed scale for quality
  }, [currentPage, isPdf, pdfDoc, renderPage]);

  // Generate thumbnails for PDF navigation
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([]);
  
  useEffect(() => {
    if (isPdf && totalPages > 0) {
      setThumbnails(Array(totalPages).fill(null));
    }
  }, [isPdf, totalPages]);

  const handleGenerateThumbnail = async (pageNum: number): Promise<string | null> => {
    if (thumbnails[pageNum - 1]) return thumbnails[pageNum - 1];
    
    const thumbnail = await generateThumbnail(pageNum);
    if (thumbnail) {
      setThumbnails(prev => {
        const next = [...prev];
        next[pageNum - 1] = thumbnail;
        return next;
      });
    }
    return thumbnail;
  };

  return (
    <TooltipProvider>
      <Card ref={cardRef} className="p-0 flex flex-row min-h-[280px] overflow-hidden border-2 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-background via-background to-primary/5">
        {/* Thumbnail Navigation for PDFs */}
        {isPdf && totalPages > 1 && (
          <DocumentThumbnailNav
            totalPages={totalPages}
            currentPage={currentPage}
            onPageSelect={setCurrentPage}
            thumbnails={thumbnails}
            onGenerateThumbnail={handleGenerateThumbnail}
            isCollapsed={thumbnailsCollapsed}
            onToggleCollapse={() => setThumbnailsCollapsed(!thumbnailsCollapsed)}
          />
        )}
        
        {/* Main viewer area */}
        <div className="flex-1 flex flex-col min-w-0">
        {/* Header with enhanced gradient */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/8 to-primary/5 px-6 py-4 border-b backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2 text-foreground">
              <Highlighter className="h-5 w-5 text-primary animate-pulse" />
              Document Viewer
            </h3>
            <div className="flex items-center gap-3">
              {onPopout && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onPopout}
                      size="sm"
                      variant="outline"
                      className="hover:bg-primary/20 hover:text-primary transition-all duration-200"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Pop-out
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in separate window for dual monitor</TooltipContent>
                </Tooltip>
              )}
              <Badge variant="secondary" className="text-sm font-mono px-3 py-1.5 bg-gradient-to-r from-primary/30 to-primary/15 border-primary/30 shadow-md">
                {Math.round(imageZoom * 100)}%
              </Badge>
              <Badge variant="outline" className="max-w-[200px] truncate bg-background/50 backdrop-blur-sm">{fileName}</Badge>
            </div>
          </div>
        </div>
        
        {/* Controls with enhanced glass morphism */}
        <div className="px-6 py-3 bg-gradient-to-r from-muted/40 via-muted/30 to-muted/20 backdrop-blur-md border-b flex items-center gap-2 flex-wrap shadow-inner">
          {/* Zoom controls group */}
          <div className="flex items-center gap-1 bg-background/90 backdrop-blur-md rounded-lg border border-primary/20 p-1 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleZoom(0.25)}
                  className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary hover:scale-110 transition-all duration-200"
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
                  variant="ghost"
                  onClick={() => handleZoom(-0.25)}
                  className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary hover:scale-110 transition-all duration-200"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (-)</TooltipContent>
            </Tooltip>
          </div>

          {/* Fit controls group */}
          <div className="flex items-center gap-1 bg-background/90 backdrop-blur-md rounded-lg border border-primary/20 p-1 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleFitToWidth}
                  className="h-8 px-2 text-xs hover:bg-primary/20 hover:text-primary hover:scale-105 transition-all duration-200 font-medium"
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
                  variant="ghost"
                  onClick={handleFitToHeight}
                  className="h-8 px-2 text-xs hover:bg-primary/20 hover:text-primary hover:scale-105 transition-all duration-200 font-medium"
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
                  variant="ghost"
                  onClick={handleActualSize}
                  className="h-8 px-2 text-xs hover:bg-primary/20 hover:text-primary hover:scale-105 transition-all duration-200 font-medium"
                >
                  100%
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actual size</TooltipContent>
            </Tooltip>
          </div>
          
          {/* Transform controls group */}
          <div className="flex items-center gap-1 bg-background/90 backdrop-blur-md rounded-lg border border-primary/20 p-1 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                  className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary hover:scale-110 hover:rotate-90 transition-all duration-300"
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
                  variant="ghost"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary hover:scale-110 transition-all duration-200"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen (F)</TooltipContent>
            </Tooltip>
          </div>

          {/* View Original Button for PII documents */}
          {documentId && piiRegions && piiRegions.length > 0 && onToggleOriginal && (
            <ViewOriginalButton
              documentId={documentId}
              showingOriginal={showingOriginal}
              onToggle={onToggleOriginal}
            />
          )}

          {/* Enhanced mode selector group with animations */}
          <div className="ml-auto flex items-center gap-1 bg-background/90 backdrop-blur-md rounded-lg border border-primary/20 p-1 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={clickMode === 'highlight' ? 'default' : 'ghost'}
                  onClick={() => setClickMode('highlight')}
                  className={`h-8 w-8 p-0 transition-all duration-200 ${
                    clickMode === 'highlight' 
                      ? 'shadow-md scale-105' 
                      : 'hover:bg-primary/20 hover:text-primary hover:scale-105'
                  }`}
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
                  variant={clickMode === 'extract' ? 'default' : 'ghost'}
                  onClick={() => setClickMode('extract')}
                  className={`h-8 w-8 p-0 transition-all duration-200 ${
                    clickMode === 'extract' 
                      ? 'shadow-md scale-105' 
                      : 'hover:bg-primary/20 hover:text-primary hover:scale-105'
                  }`}
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Click to extract text at position</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Document with overlay - enhanced styling */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-gradient-to-br from-primary/5 via-background to-muted/10 p-6 relative group"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? 'grabbing' : (imageZoom > 1 ? 'grab' : 'default') }}
        >
          {/* Loading indicator */}
          {(imageLoading || pdfLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {isPdf ? 'Loading PDF...' : 'Loading image...'}
                </p>
              </div>
            </div>
          )}

          {/* Error indicator */}
          {pdfError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-destructive font-medium">{pdfError}</p>
                <Button onClick={() => window.location.reload()} size="sm" variant="outline">
                  Retry
                </Button>
              </div>
            </div>
          )}

          <div 
            className="relative inline-block transition-transform duration-200 ease-out"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
            }}
          >
            {isPdf && pdfDoc ? (
              <div className="flex items-center justify-center">
                <canvas
                  ref={pdfCanvasRef}
                  className="max-w-none shadow-2xl rounded-lg border-2 border-primary/10 hover:border-primary/30"
                  style={{
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.15s ease-out',
                    width: 'auto',
                    height: 'auto'
                  }}
                />
              </div>
            ) : !isPdf ? (
              <>
                <img
                  ref={imageRef}
                  src={displayImageUrl}
                  alt="Document"
                  className="max-w-none select-none shadow-2xl rounded-lg border-2 border-primary/10 hover:border-primary/30 hover:shadow-primary/20"
                  style={{
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                    transformOrigin: 'top left',
                    filter: 'contrast(1.03) brightness(1.02) saturate(1.05)',
                    transition: 'transform 0.15s ease-out',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: 'none'
                  }}
                  onLoad={() => {
                    console.log('[Zoom] Image loaded, current zoom:', imageZoom);
                    setImageLoading(false);
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
                  className="absolute top-0 left-0 pointer-events-auto select-none rounded-lg"
                  style={{
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                    transformOrigin: 'top left',
                    cursor: isPanning ? 'grabbing' : (clickMode === 'extract' ? 'crosshair' : 'pointer')
                  }}
                />
              </>
            ) : null}
          </div>

          {/* Enhanced info section with gradient and animations */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1.5 text-xs bg-gradient-to-r from-background/98 via-primary/5 to-background/98 backdrop-blur-md border border-primary/30 rounded-lg px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:shadow-primary/20">
            {clickMode === 'extract' && (
              <p className="text-primary font-medium flex items-center gap-2 animate-pulse">
                <MousePointer className="h-3.5 w-3.5" />
                Click anywhere on the document to extract text at that position
              </p>
            )}
            <p className="text-muted-foreground font-mono text-[10px] flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse"></span>
              ⌨️ +/- zoom · Shift+drag pan · R reset · F fullscreen · Shift+arrows rotate
            </p>
          </div>
        </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};
