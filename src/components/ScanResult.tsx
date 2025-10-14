import { Copy, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface ScanResultProps {
  text: string;
  imageUrl: string;
}

export const ScanResult = ({ text, imageUrl }: ScanResultProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: 'Copied to clipboard',
      description: 'The extracted text has been copied.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Downloaded',
      description: 'Text file has been downloaded.',
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Original Image */}
      <Card className="p-6 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Original Image
        </h3>
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img
            src={imageUrl}
            alt="Scanned document"
            className="w-full h-auto"
          />
        </div>
      </Card>

      {/* Extracted Text */}
      <Card className="p-6 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Extracted Text
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="transition-all duration-200"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="transition-all duration-200"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
            {text}
          </pre>
        </div>
      </Card>
    </div>
  );
};
