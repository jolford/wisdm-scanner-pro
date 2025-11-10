import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Loader2, Barcode, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface BarcodeResult {
  type: string;
  value: string;
  format: string;
  confidence: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export function BarcodeTestTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<BarcodeResult[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please select an image or PDF file');
      return;
    }

    setSelectedFile(file);
    setResults([]);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl('');
    }
  };

  const handleTest = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setTesting(true);
    setResults([]);

    try {
      // Upload file to temporary storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `barcode-test-${Date.now()}.${fileExt}`;
      const filePath = `temp/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60);

      if (!signedData) throw new Error('Failed to create signed URL');

      // Call barcode detection edge function
      const { data, error } = await supabase.functions.invoke('detect-barcodes', {
        body: { 
          imageUrl: signedData.signedUrl,
          fileName: selectedFile.name 
        },
      });

      if (error) throw error;

      if (data.barcodes && data.barcodes.length > 0) {
        setResults(data.barcodes);
        toast.success(`Found ${data.barcodes.length} barcode(s)`);
      } else {
        toast.info('No barcodes detected in the image');
        setResults([]);
      }

      // Clean up temporary file
      await supabase.storage.from('documents').remove([filePath]);
    } catch (error: any) {
      console.error('Barcode test error:', error);
      toast.error('Failed to test barcode: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Barcode className="h-5 w-5" />
          Barcode Test Tool
        </CardTitle>
        <CardDescription>
          Upload a document to detect and extract barcode values. Supports QR codes, Code 128, Code 39, EAN, UPC, and more.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Upload Test Document</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => document.getElementById('barcode-file')?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {selectedFile ? selectedFile.name : 'Choose File'}
            </Button>
            <input
              id="barcode-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {previewUrl && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">Preview:</p>
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-96 mx-auto rounded border"
            />
          </div>
        )}

        <Button
          onClick={handleTest}
          disabled={!selectedFile || testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Detecting Barcodes...
            </>
          ) : (
            <>
              <Barcode className="h-4 w-4 mr-2" />
              Test Barcode Detection
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Found {results.length} Barcode{results.length > 1 ? 's' : ''}
            </div>

            {results.map((result, index) => (
              <Card key={index}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Barcode #{index + 1}</span>
                    <Badge variant="secondary">{result.format}</Badge>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <p className="text-sm font-mono">{result.type}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Extracted Value</Label>
                      <p className="text-sm font-mono bg-muted px-3 py-2 rounded break-all">
                        {result.value}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Confidence</Label>
                      <p className="text-sm">
                        {(result.confidence * 100).toFixed(1)}%
                      </p>
                    </div>

                    {result.position && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Position</Label>
                        <p className="text-xs text-muted-foreground">
                          X: {result.position.x}, Y: {result.position.y}, 
                          W: {result.position.width}, H: {result.position.height}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
