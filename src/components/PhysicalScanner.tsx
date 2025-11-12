import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Download, Scan, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PhysicalScannerProps {
  projectId?: string;
  batchId?: string;
  customerId?: string;
  onScanComplete?: () => void;
}

export const PhysicalScanner = ({ projectId, batchId, customerId, onScanComplete }: PhysicalScannerProps) => {
  const [isAppInstalled, setIsAppInstalled] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if desktop app is installed by attempting protocol launch
  useEffect(() => {
    const checkInstallation = () => {
      const testLink = document.createElement('a');
      testLink.href = 'wisdm-scan://test';
      testLink.style.display = 'none';
      
      const timeoutId = setTimeout(() => {
        setIsAppInstalled(false);
      }, 2000);

      testLink.addEventListener('click', () => {
        clearTimeout(timeoutId);
        setIsAppInstalled(true);
      });

      document.body.appendChild(testLink);
      testLink.click();
      document.body.removeChild(testLink);
    };

    checkInstallation();
  }, []);

  const handleScan = async () => {
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
      // Get current session
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
      
      // Build protocol URL
      const protocolUrl = `wisdm-scan://scan?` + 
        `token=${encodeURIComponent(session.access_token)}` +
        `&project=${encodeURIComponent(projectId)}` +
        `&batch=${encodeURIComponent(batchId)}` +
        `&customer=${encodeURIComponent(customerId)}` +
        `&supabase=${encodeURIComponent(supabaseUrl)}`;

      // Trigger desktop app via protocol
      window.location.href = protocolUrl;

      toast({
        title: 'Scanner Activated',
        description: 'Desktop scanner app launched. Please complete scan on your device.',
      });

      // Call onScanComplete after a delay (assuming scan completes)
      setTimeout(() => {
        if (onScanComplete) {
          onScanComplete();
        }
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

  const handleDownload = () => {
    navigate('/downloads');
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Scan className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Ricoh/Fujitsu Desktop Scanner</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Scan documents directly from your USB-connected Ricoh or Fujitsu scanner using our desktop application.
            </p>
            
            {isAppInstalled === null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking for scanner app...</span>
              </div>
            )}

            {isAppInstalled === false && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-2">Scanner App Not Installed</p>
                    <p className="text-muted-foreground mb-3">
                      To use your physical scanner, download and install the WISDM Scanner desktop application. This is a one-time setup.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleDownload}
                  className="w-full"
                  variant="default"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Scanner App
                </Button>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Requirements:</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Windows 10/11 (64-bit)</li>
                    <li>Ricoh/Fujitsu scanner connected via USB</li>
                    <li>Ricoh Scanner SDK</li>
                  </ul>
                </div>
              </div>
            )}

            {isAppInstalled === true && (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-4">
                  <CheckCircle className="h-4 w-4" />
                  <span>Scanner app installed and ready</span>
                </div>

                <Button
                  onClick={handleScan}
                  disabled={isScanning || !projectId || !batchId}
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
              </>
            )}
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm">
            <strong className="text-primary">How it works:</strong> The desktop app runs in your system tray and communicates with your Ricoh/Fujitsu scanner. Click "Scan Document" to trigger scanning, and the document will be automatically uploaded to your current batch.
          </p>
        </div>
      </div>
    </Card>
  );
};
