import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

export function InstallPrompt() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if previously dismissed
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  const handleInstallClick = () => {
    navigate('/install');
  };

  // Don't show if installed or dismissed
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <Card className="mb-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="rounded-full bg-primary/10 p-2">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">Install WISDM Capture Pro</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Get faster access and work offline. Install our app on your device.
          </p>
          
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Install Now
          </Button>
        </div>

        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
