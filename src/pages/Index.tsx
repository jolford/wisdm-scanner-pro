import { useState } from 'react';
import { ScanUploader } from '@/components/ScanUploader';
import { ScanResult } from '@/components/ScanResult';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Scan, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [extractedText, setExtractedText] = useState('');
  const [currentImage, setCurrentImage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleScanComplete = async (text: string, imageUrl: string) => {
    setCurrentImage(imageUrl);
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: { imageData: imageUrl },
      });

      if (error) {
        console.error('OCR error:', error);
        throw error;
      }

      setExtractedText(data.text);
      toast({
        title: 'Scan Complete',
        description: 'Text has been successfully extracted from your image.',
      });
    } catch (error: any) {
      console.error('Error processing scan:', error);
      toast({
        title: 'Scan Failed',
        description: error.message || 'Failed to process the image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setExtractedText('');
    setCurrentImage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-lg blur-md opacity-50" />
                <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-lg">
                  <Scan className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  AI Scanner Pro
                </h1>
                <p className="text-sm text-muted-foreground">Advanced OCR & ICR Technology</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              <span>Powered by AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {!extractedText ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">
                Scan Documents with AI Precision
              </h2>
              <p className="text-lg text-muted-foreground">
                Upload any image or document to extract text with advanced OCR and handwriting recognition
              </p>
            </div>
            <ScanUploader onScanComplete={handleScanComplete} isProcessing={isProcessing} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Scan Results</h2>
              <Button onClick={handleReset} variant="outline">
                New Scan
              </Button>
            </div>
            <ScanResult text={extractedText} imageUrl={currentImage} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>High-quality OCR and ICR powered by advanced AI technology</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
