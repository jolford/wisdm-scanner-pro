import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Package } from 'lucide-react';
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const Downloads = () => {
  const { toast } = useToast();

  const downloadFile = useCallback(async (path: string, filename?: string) => {
    try {
      const res = await fetch(path, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch ${path}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Download started', description: filename || path });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  const sourceFiles = [
    { path: '/downloads/scanner-app/electron/main.js', label: 'electron/main.js' },
    { path: '/downloads/scanner-app/electron/tray.js', label: 'electron/tray.js' },
    { path: '/downloads/scanner-app/electron/protocol.js', label: 'electron/protocol.js' },
    { path: '/downloads/scanner-app/src/scanner.js', label: 'src/scanner.js' },
    { path: '/downloads/scanner-app/src/uploader.js', label: 'src/uploader.js' },
    { path: '/downloads/scanner-app/native/ricoh-scanner.cc', label: 'native/ricoh-scanner.cc' },
    { path: '/downloads/scanner-app/native/binding.gyp', label: 'native/binding.gyp' },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Downloads</h1>
      
      <div className="grid gap-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Package className="h-8 w-8 text-primary mt-1" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">WISDM Scanner Desktop App</h2>
              <p className="text-muted-foreground mb-4">
                Desktop application for scanning documents with Ricoh/Fujitsu scanners. Includes native Ricoh SDK integration for optimal performance.
              </p>
              
              <div className="space-y-2 mb-4 text-sm">
                <p><strong>Requirements:</strong> Windows 10/11 (64-bit), Ricoh Scanner SDK</p>
                <p><strong>Version:</strong> 1.0.0</p>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => downloadFile('/downloads/scanner-app/package.json', 'package.json')}>
                  <Download className="h-4 w-4 mr-2" />
                  Download package.json
                </Button>
                <Button variant="outline" onClick={() => downloadFile('/downloads/scanner-app/README.md', 'README.md')}>
                  <FileText className="h-4 w-4 mr-2" />
                  README
                </Button>
                <Button variant="outline" onClick={() => downloadFile('/downloads/scanner-app/INSTALLATION.md', 'INSTALLATION.md')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Installation Guide
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-3">Source Code Files</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {sourceFiles.map((f) => (
              <button
                key={f.path}
                onClick={() => downloadFile(f.path)}
                className="text-left text-primary hover:underline"
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Downloads;
