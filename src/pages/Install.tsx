import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import wisdmLogo from '@/assets/wisdm-logo.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const { toast } = useToast();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Detect platform for better instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      toast({
        title: isIOS ? 'iOS Installation' : isAndroid ? 'Android Installation' : 'Installation Instructions',
        description: isIOS 
          ? 'Tap the Share button (□↑) at the bottom, then select "Add to Home Screen"'
          : isAndroid
          ? 'Tap the menu (⋮) in your browser, then select "Install app" or "Add to Home Screen"'
          : 'Use your browser menu to install this app',
        duration: 8000,
      });
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        toast({
          title: 'App Installed!',
          description: 'WISDM Capture Pro has been added to your home screen.',
        });
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      toast({
        title: 'Installation Failed',
        description: 'Please try installing manually from your browser menu.',
        variant: 'destructive',
      });
    }
    
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={wisdmLogo} alt="WISDM Logo" className="h-20 w-auto" />
          </div>
          <CardTitle className="text-2xl md:text-3xl">Install WISDM Capture Pro</CardTitle>
          <CardDescription className="text-base">
            Get the best experience with our mobile app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEmbedded && (
            <div className="rounded-md border border-border/60 p-3 bg-muted/30 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Chrome hides install in embedded previews. Open in a new tab to install.</p>
              <Button variant="outline" size="sm" onClick={() => window.open(window.location.href, '_blank', 'noopener')}>Open in new tab</Button>
            </div>
          )}
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-500/10 p-4">
                  <Check className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Already Installed!</h3>
                <p className="text-muted-foreground">
                  WISDM Capture Pro is installed on your device.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Works Offline</h4>
                    <p className="text-sm text-muted-foreground">
                      Access your documents even without internet connection
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Fast & Lightweight</h4>
                    <p className="text-sm text-muted-foreground">
                      Instant loading and smooth performance on mobile
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Home Screen Access</h4>
                    <p className="text-sm text-muted-foreground">
                      Launch directly from your home screen like a native app
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleInstall} 
                className="w-full" 
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                Install App
              </Button>

              <div className="text-xs text-muted-foreground text-center space-y-2">
                <p className="font-medium">Manual Installation:</p>
                <p><strong>Desktop Chrome:</strong> Menu (⋮) → Save and share → Install page as app</p>
                <p><strong>Microsoft Edge:</strong> Menu (⋮) → Apps → Install this site as an app</p>
                <p><strong>iOS (Safari):</strong> Tap Share <span className="mx-1">→</span> Add to Home Screen</p>
                <p><strong>Android (Chrome):</strong> Menu (⋮) <span className="mx-1">→</span> Install app</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}