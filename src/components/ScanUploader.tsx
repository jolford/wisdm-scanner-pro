import { useState, useRef } from 'react';
import { Upload, Scan, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ScanUploaderProps {
  onScanComplete: (text: string, imageUrl: string, fileName: string) => void;
  onPdfUpload: (file: File) => void;
  onMultipleFilesUpload: (files: File[]) => void;
  isProcessing: boolean;
}

export const ScanUploader = ({ onScanComplete, onPdfUpload, onMultipleFilesUpload, isProcessing }: ScanUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    // Handle PDFs separately
    if (file.type === 'application/pdf') {
      onPdfUpload(file);
      return;
    }

    // Handle images
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image or PDF file.',
        variant: 'destructive',
      });
      return;
    }

    // TIF/TIFF files are not well supported by browsers
    // Show a helpful error message
    if (file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
      toast({
        title: 'TIF Format Not Supported',
        description: 'Please convert TIF files to JPG, PNG, or WEBP before uploading. You can use free online converters or image editing software.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      onScanComplete('', imageData, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (files.length === 1) {
        handleFile(files[0]);
      } else {
        onMultipleFilesUpload(files);
      }
    }
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
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 1) {
      handleFile(files[0]);
    } else if (files.length > 1) {
      onMultipleFilesUpload(files);
    }
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
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
        multiple
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-20 animate-pulse" />
          <div className="relative bg-gradient-to-br from-primary to-accent p-4 rounded-full">
            {isProcessing ? (
              <Scan className="h-8 w-8 text-primary-foreground animate-pulse" />
            ) : (
              <div className="flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary-foreground mr-1" />
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {isProcessing ? 'Processing Document...' : 'Upload Document or Image'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop or click to select files
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports JPG, PNG, WEBP, PDF • Multiple files supported
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
