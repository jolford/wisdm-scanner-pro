import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Download, Scan, CheckCircle, Loader2, RefreshCw, Monitor, Usb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { useDynamsoftScanner } from '@/hooks/use-dynamsoft-scanner';

interface PhysicalScannerProps {
  projectId?: string;
  batchId?: string;
  customerId?: string;
  onScanComplete?: (files: File[]) => void;
}

interface ScannerDevice {
  id: string;
  name: string;
  type: 'twain' | 'wia' | 'browser' | 'desktop-app';
}

export const PhysicalScanner = ({ projectId, batchId, customerId, onScanComplete }: PhysicalScannerProps) => {
  const [isAppInstalled, setIsAppInstalled] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedScanner, setSelectedScanner] = useState<string>('');
  const [availableScanners, setAvailableScanners] = useState<ScannerDevice[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [dynamsoftKey, setDynamsoftKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Dynamsoft TWAIN scanner hook
  const {
    isReady: isDynamsoftReady,
    isLoading: isDynamsoftLoading,
    error: dynamsoftError,
    scanners: twainScanners,
    scan: dynamsoftScan,
    refreshScanners: refreshTwainScanners
  } = useDynamsoftScanner(dynamsoftKey);

  // Fetch Dynamsoft license key
  useEffect(() => {
    const fetchLicenseKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-dynamsoft-key');
        if (error) throw error;
        if (data?.licenseKey) {
          setDynamsoftKey(data.licenseKey);
        }
      } catch (err) {
        console.log('Could not fetch Dynamsoft key:', err);
      }
    };
    fetchLicenseKey();
  }, []);

  // Check if desktop app is installed
  useEffect(() => {
    const checkInstallation = () => {
      // Check for desktop app via protocol
      const timeoutId = setTimeout(() => {
        setIsAppInstalled(false);
      }, 2000);

      // Try to detect if protocol handler exists
      try {
        const testFrame = document.createElement('iframe');
        testFrame.style.display = 'none';
        testFrame.src = 'wisdm-scan://ping';
        document.body.appendChild(testFrame);
        
        setTimeout(() => {
          document.body.removeChild(testFrame);
          clearTimeout(timeoutId);
        }, 1000);
      } catch {
        clearTimeout(timeoutId);
        setIsAppInstalled(false);
      }
    };

    checkInstallation();
  }, []);

  // Detect available scanners
  const detectScanners = async () => {
    setIsDetecting(true);
    const detected: ScannerDevice[] = [];

    // Add TWAIN scanners from Dynamsoft (priority)
    if (isDynamsoftReady && twainScanners.length > 0) {
      twainScanners.forEach((scanner) => {
        detected.push({
          id: scanner.id,
          name: `🖨️ ${scanner.name}`,
          type: 'twain'
        });
      });
    }

    // Add browser capture option (always available)
    detected.push({
      id: 'browser-capture',
      name: 'Browser Camera/File Capture',
      type: 'browser'
    });

    // Check for ImageCapture API support
    if ('ImageCapture' in window) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        videoDevices.forEach((device, index) => {
          detected.push({
            id: device.deviceId || `camera-${index}`,
            name: device.label || `Camera ${index + 1}`,
            type: 'browser'
          });
        });
      } catch (err) {
        console.log('Could not enumerate media devices:', err);
      }
    }

    // Add desktop app option if installed
    if (isAppInstalled) {
      detected.push({
        id: 'desktop-app',
        name: 'WISDM Desktop Scanner (Ricoh/Fujitsu)',
        type: 'desktop-app'
      });
    }

    setAvailableScanners(detected);
    
    if (detected.length > 0 && !selectedScanner) {
      // Prefer TWAIN scanner if available
      const twainScanner = detected.find(s => s.type === 'twain');
      setSelectedScanner(twainScanner?.id || detected[0].id);
    }

    setIsDetecting(false);
    
    const twainCount = detected.filter(s => s.type === 'twain').length;
    toast({
      title: 'Scanner Detection Complete',
      description: twainCount > 0 
        ? `Found ${twainCount} TWAIN scanner(s) and ${detected.length - twainCount} other option(s)`
        : `Found ${detected.length} scanner option(s)`,
    });
  };

  // Initial detection - also refresh when Dynamsoft is ready
  useEffect(() => {
    detectScanners();
  }, [isAppInstalled, isDynamsoftReady, twainScanners.length]);

  const handleBrowserCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);

    try {
      const fileArray = Array.from(files);
      
      toast({
        title: 'Capture Complete',
        description: `${fileArray.length} file(s) captured successfully`,
      });

      if (onScanComplete) {
        onScanComplete(fileArray);
      }
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: 'Capture Failed',
        description: 'Failed to process captured files.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDesktopScan = async () => {
    if (!projectId || !batchId || !customerId) {
      toast({
        title: 'Configuration Required',
        description: 'Please select a project and batch before scanning.',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to use the scanner.',
          variant: 'destructive',
        });
        setIsScanning(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const protocolUrl = `wisdm-scan://scan?` + 
        `token=${encodeURIComponent(session.access_token)}` +
        `&project=${encodeURIComponent(projectId)}` +
        `&batch=${encodeURIComponent(batchId)}` +
        `&customer=${encodeURIComponent(customerId)}` +
        `&supabase=${encodeURIComponent(supabaseUrl)}`;

      window.location.href = protocolUrl;

      toast({
        title: 'Scanner Activated',
        description: 'Desktop scanner app launched. Please complete scan on your device.',
      });

      setTimeout(() => {
        setIsScanning(false);
      }, 5000);

    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: 'Scan Failed',
        description: 'Failed to launch scanner. Please try again.',
        variant: 'destructive',
      });
      setIsScanning(false);
    }
  };

  const handleTwainScan = async () => {
    setIsScanning(true);

    try {
      const blobs = await dynamsoftScan();
      
      // Convert blobs to Files
      const files = blobs.map((blob, index) => 
        new File([blob], `scan-${Date.now()}-${index}.png`, { type: 'image/png' })
      );

      toast({
        title: 'Scan Complete',
        description: `${files.length} page(s) scanned successfully`,
      });

      if (onScanComplete) {
        onScanComplete(files);
      }
    } catch (error) {
      console.error('TWAIN scan error:', error);
      toast({
        title: 'Scan Failed',
        description: error instanceof Error ? error.message : 'Failed to scan document.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = () => {
    const scanner = availableScanners.find(s => s.id === selectedScanner);
    
    if (!scanner) {
      toast({
        title: 'No Scanner Selected',
        description: 'Please select a scanner first.',
        variant: 'destructive',
      });
      return;
    }

    if (scanner.type === 'twain') {
      handleTwainScan();
    } else if (scanner.type === 'desktop-app') {
      handleDesktopScan();
    } else {
      handleBrowserCapture();
    }
  };

  const handleDownload = () => {
    navigate('/downloads');
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Scan className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Physical Scanner</h3>
            <p className="text-sm text-muted-foreground">
              Scan documents directly from your connected scanner or camera.
            </p>
          </div>
        </div>

        {/* Scanner Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Select Scanner</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                detectScanners();
                if (isDynamsoftReady) refreshTwainScanners();
              }}
              disabled={isDetecting || isDynamsoftLoading}
              className="h-8"
            >
              {isDetecting || isDynamsoftLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 text-xs">Refresh</span>
            </Button>
          </div>

          <Select value={selectedScanner} onValueChange={setSelectedScanner}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a scanner..." />
            </SelectTrigger>
            <SelectContent>
              {availableScanners.map((scanner) => (
                <SelectItem key={scanner.id} value={scanner.id}>
                  <div className="flex items-center gap-2">
                    {scanner.type === 'twain' ? (
                      <Usb className="h-4 w-4 text-green-600" />
                    ) : scanner.type === 'desktop-app' ? (
                      <Monitor className="h-4 w-4 text-primary" />
                    ) : (
                      <Scan className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{scanner.name}</span>
                  </div>
                </SelectItem>
              ))}
              {availableScanners.length === 0 && (
                <SelectItem value="none" disabled>
                  No scanners detected
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Dynamsoft TWAIN status */}
          {isDynamsoftLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Initializing TWAIN scanner support...</span>
            </div>
          )}

          {isDynamsoftReady && twainScanners.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span>{twainScanners.length} TWAIN scanner(s) detected</span>
            </div>
          )}

          {isDynamsoftReady && twainScanners.length === 0 && !isDynamsoftLoading && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1 text-amber-800 dark:text-amber-200">Dynamsoft Service Required</p>
                  <p className="text-amber-700 dark:text-amber-300 text-xs">
                    To scan with USB TWAIN scanners, install the Dynamsoft Service (runs in background).
                  </p>
                </div>
              </div>
              <Button
                onClick={() => window.open('https://download.dynamsoft.com/DynamsoftServiceSetup.exe', '_blank')}
                size="sm"
                variant="outline"
                className="w-full border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Dynamsoft Service
              </Button>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                After installing, click Refresh to detect your scanner.
              </p>
            </div>
          )}

          {dynamsoftError && !isDynamsoftLoading && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span>TWAIN: {dynamsoftError}</span>
            </div>
          )}

          {/* Status indicators */}
          {isAppInstalled === true && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span>Desktop scanner app installed</span>
            </div>
          )}

          {isAppInstalled === false && !isDynamsoftReady && twainScanners.length === 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">No USB Scanners Detected</p>
                  <p className="text-muted-foreground text-xs">
                    Connect a TWAIN-compatible scanner and refresh, or install the desktop app for Ricoh/Fujitsu scanners.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDownload}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Desktop App
              </Button>
            </div>
          )}
        </div>

        {/* Hidden file input for browser capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          capture="environment"
          multiple
          onChange={handleFileCapture}
          className="hidden"
        />

        {/* Scan Button */}
        <Button
          onClick={handleScan}
          disabled={isScanning || !selectedScanner || !projectId || !batchId}
          className="w-full"
          size="lg"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Scan className="h-5 w-5 mr-2" />
              Scan Document
            </>
          )}
        </Button>

        {(!projectId || !batchId) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Please select a project and batch before scanning.
          </p>
        )}

        {/* Info section */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm">
            <strong className="text-primary">Tip:</strong> Use "Browser Camera/File Capture" for mobile devices or webcams. 
            For USB scanners (Ricoh/Fujitsu), install and use the desktop app.
          </p>
        </div>
      </div>
    </Card>
  );
};
