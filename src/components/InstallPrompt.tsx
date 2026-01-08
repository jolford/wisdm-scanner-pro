import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const navigate = useNavigate();
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

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

    // Capture install prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  const handleInstallClick = () => {
    // If we have the prompt ready, trigger it
    if (deferredPrompt) {
      deferredPrompt.prompt();
    } else {
      // Otherwise navigate to install page with instructions
      navigate('/install');
    }
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
          <h3 className="font-semibold text-sm mb-1">Install AxiomIQ Capture Pro</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Get faster access and work offline. Install our app on your device.
          </p>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {deferredPrompt ? 'Install Now' : 'View Instructions'}
            </Button>
            {isEmbedded && !deferredPrompt && (
              <Button
                variant="link"
                size="sm"
                className="px-1"
                onClick={() => window.open('/install', '_blank', 'noopener')}
              >
                Open in new tab to install
              </Button>
            )}
          </div>
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
