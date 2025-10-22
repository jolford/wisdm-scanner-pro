import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ExternalLink } from 'lucide-react';

interface PhysicalScannerProps {
  onScanComplete: (text: string, imageData: string, fileName: string) => void;
  isProcessing: boolean;
}

export const PhysicalScanner = ({ onScanComplete, isProcessing }: PhysicalScannerProps) => {
  const [showInstructions, setShowInstructions] = useState(true);

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Physical Scanner Support (Optional)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Physical scanners with TWAIN/ISIS protocols are available as an optional enterprise add-on. This is a one-time administrator setup that enables all users in your organization - no individual subscriptions required.
            </p>
            
            {showInstructions && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <p className="font-medium">Administrator Setup (One-Time):</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Contact your system administrator about enabling physical scanner support</li>
                  <li>Admin signs up for Dynamsoft Web TWAIN (one license covers all users)</li>
                  <li>Admin downloads and configures the SDK with the organization license key</li>
                  <li>All users in your organization can then use physical scanners</li>
                </ol>
                
                <div className="pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">
                    <strong>Supported Scanner Protocols:</strong>
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>• TWAIN protocol (Windows, macOS, Linux)</li>
                    <li>• ISIS protocol (Windows)</li>
                    <li>• SANE protocol (Linux)</li>
                    <li>• WIA protocol (Windows)</li>
                    <li>• ICA protocol (macOS)</li>
                  </ul>
                </div>
                
                <div className="bg-accent/10 border border-accent/30 rounded p-3 mt-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note for Administrators:</strong> Dynamsoft Web TWAIN requires a commercial license for production use. One organizational license enables scanner support for all your users.
                  </p>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => window.open('https://www.dynamsoft.com/web-twain/overview/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Admin: Learn About Dynamsoft
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm">
            <strong className="text-primary">Pro Tip:</strong> For immediate scanning, use the "Upload File" tab to scan documents using your device's camera or upload pre-scanned images/PDFs.
          </p>
        </div>
      </div>
    </Card>
  );
};
