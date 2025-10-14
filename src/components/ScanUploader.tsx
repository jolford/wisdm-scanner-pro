import { useState, useRef } from 'react';
import { Upload, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ScanUploaderProps {
  onScanComplete: (text: string, imageUrl: string) => void;
  isProcessing: boolean;
}

export const ScanUploader = ({ onScanComplete, isProcessing }: ScanUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      onScanComplete('', imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-all duration-300 hover:shadow-[var(--shadow-elegant)]
        ${isDragging ? 'border-primary bg-accent/10 scale-[1.02]' : 'border-border hover:border-primary/50'}
        ${isProcessing ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-20 animate-pulse" />
          <div className="relative bg-gradient-to-br from-primary to-accent p-4 rounded-full">
            {isProcessing ? (
              <Scan className="h-8 w-8 text-primary-foreground animate-pulse" />
            ) : (
              <Upload className="h-8 w-8 text-primary-foreground" />
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {isProcessing ? 'Processing Image...' : 'Upload Document or Image'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop or click to select an image
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports JPG, PNG, WEBP
          </p>
        </div>

        {!isProcessing && (
          <Button variant="outline" className="mt-2">
            Select File
          </Button>
        )}
      </div>
    </div>
  );
};
