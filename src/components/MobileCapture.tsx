import { useState, useRef } from 'react';
import { Camera, X, Check, RotateCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { enhanceImage, type EnhancementOptions } from '@/lib/image-enhancement';

interface MobileCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  open: boolean;
}

export function MobileCapture({ onCapture, onClose, open }: MobileCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showEnhancement, setShowEnhancement] = useState(false);
  const [enhancementOptions, setEnhancementOptions] = useState<EnhancementOptions>({
    autoCrop: true,
    perspectiveCorrection: true,
    contrastAdjustment: 20,
    brightnessAdjustment: 10,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Store original canvas for enhancement
    originalCanvasRef.current = canvas;

    // Apply enhancements by default
    applyEnhancements();
    stopCamera();
  };

  const applyEnhancements = () => {
    if (!originalCanvasRef.current) return;

    const enhancedCanvas = enhanceImage(originalCanvasRef.current, enhancementOptions);
    const imageData = enhancedCanvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
  };

  const confirmCapture = () => {
    if (!capturedImage) return;

    // Convert base64 to File
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        handleClose();
      })
      .catch(error => {
        console.error('Error converting image:', error);
        toast.error('Failed to process captured image');
      });
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    originalCanvasRef.current = null;
    setShowEnhancement(false);
    startCamera();
  };

  const switchCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    originalCanvasRef.current = null;
    setShowEnhancement(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Capture Document</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 relative overflow-hidden">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                onLoadedMetadata={startCamera}
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={switchCamera}
                >
                  <RotateCw className="h-5 w-5" />
                </Button>
                
                <Button
                  size="icon"
                  className="h-16 w-16 rounded-full"
                  onClick={capturePhoto}
                >
                  <Camera className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleClose}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <img
                src={capturedImage}
                alt="Captured document"
                className="w-full h-full object-contain"
              />
              
              {showEnhancement && (
                <div className="absolute top-4 left-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Enhancement Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEnhancement(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-crop" className="text-xs">Auto-Crop</Label>
                      <Switch
                        id="auto-crop"
                        checked={enhancementOptions.autoCrop}
                        onCheckedChange={(checked) => {
                          setEnhancementOptions({ ...enhancementOptions, autoCrop: checked });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="perspective" className="text-xs">Perspective Correction</Label>
                      <Switch
                        id="perspective"
                        checked={enhancementOptions.perspectiveCorrection}
                        onCheckedChange={(checked) => {
                          setEnhancementOptions({ ...enhancementOptions, perspectiveCorrection: checked });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contrast" className="text-xs">
                        Contrast: {enhancementOptions.contrastAdjustment}
                      </Label>
                      <Slider
                        id="contrast"
                        min={-50}
                        max={50}
                        step={5}
                        value={[enhancementOptions.contrastAdjustment || 0]}
                        onValueChange={([value]) => {
                          setEnhancementOptions({ ...enhancementOptions, contrastAdjustment: value });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brightness" className="text-xs">
                        Brightness: {enhancementOptions.brightnessAdjustment}
                      </Label>
                      <Slider
                        id="brightness"
                        min={-50}
                        max={50}
                        step={5}
                        value={[enhancementOptions.brightnessAdjustment || 0]}
                        onValueChange={([value]) => {
                          setEnhancementOptions({ ...enhancementOptions, brightnessAdjustment: value });
                        }}
                      />
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={applyEnhancements}
                      className="w-full"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={retakePhoto}
                >
                  <X className="mr-2 h-5 w-5" />
                  Retake
                </Button>

                {!showEnhancement && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowEnhancement(true)}
                  >
                    <Wand2 className="mr-2 h-5 w-5" />
                    Enhance
                  </Button>
                )}
                
                <Button
                  size="lg"
                  onClick={confirmCapture}
                >
                  <Check className="mr-2 h-5 w-5" />
                  Use Photo
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
