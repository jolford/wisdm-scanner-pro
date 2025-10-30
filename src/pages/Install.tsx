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
      toast({
        title: 'Install Instructions',
        description: 'On iOS: Tap Share → Add to Home Screen. On Android: Use your browser menu.',
      });
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      toast({
        title: 'App Installed!',
        description: 'WISDM Capture Pro has been added to your home screen.',
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
                <p><strong>iOS:</strong> Tap Share <span className="mx-1">→</span> Add to Home Screen</p>
                <p><strong>Android:</strong> Tap Menu <span className="mx-1">→</span> Install App</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}