import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Package } from 'lucide-react';

const Downloads = () => {
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
                <Button asChild>
                  <a href="/downloads/scanner-app/package.json" download>
                    <Download className="h-4 w-4 mr-2" />
                    Download package.json
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/downloads/scanner-app/README.md" download>
                    <FileText className="h-4 w-4 mr-2" />
                    README
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/downloads/scanner-app/INSTALLATION.md" download>
                    <FileText className="h-4 w-4 mr-2" />
                    Installation Guide
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-3">Source Code Files</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a href="/downloads/scanner-app/electron/main.js" className="text-primary hover:underline">electron/main.js</a>
            <a href="/downloads/scanner-app/electron/tray.js" className="text-primary hover:underline">electron/tray.js</a>
            <a href="/downloads/scanner-app/electron/protocol.js" className="text-primary hover:underline">electron/protocol.js</a>
            <a href="/downloads/scanner-app/src/scanner.js" className="text-primary hover:underline">src/scanner.js</a>
            <a href="/downloads/scanner-app/src/uploader.js" className="text-primary hover:underline">src/uploader.js</a>
            <a href="/downloads/scanner-app/native/ricoh-scanner.cc" className="text-primary hover:underline">native/ricoh-scanner.cc</a>
            <a href="/downloads/scanner-app/native/binding.gyp" className="text-primary hover:underline">native/binding.gyp</a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Downloads;
