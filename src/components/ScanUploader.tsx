import { useState, useRef } from 'react';
import { Upload, Scan, FileText, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isTiffFile, convertTiffToPngDataUrl } from '@/lib/image-utils';
import { compressImage, processPdfPageForOcr, preprocessFileForUploadMany, dataUrlToFile } from '@/lib/document-preprocessor';
import { MobileCapture } from '@/components/MobileCapture';
import { useIsMobile } from '@/hooks/use-mobile';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ScanUploaderProps {
  onScanComplete: (text: string, imageUrl: string, fileName: string) => void;
  onPdfUpload: (file: File, preRenderedImageUrl?: string) => void;
  onMultipleFilesUpload: (files: File[]) => void;
  /**
   * Optional per-project PDF separation config.
   * When set to page_count + pagesPerDocument=1, single multi-page PDFs will be expanded to one image per page.
   */
  pdfSeparation?: {
    method: 'none' | 'barcode' | 'blank_page' | 'page_count';
    pagesPerDocument?: number;
  };
  isProcessing: boolean;
}

export const ScanUploader = ({ onScanComplete, onPdfUpload, onMultipleFilesUpload, pdfSeparation, isProcessing }: ScanUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileCapture, setShowMobileCapture] = useState(false);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleFile = async (file: File) => {
    // Handle PDFs
    if (file.type === 'application/pdf') {
      setIsPreprocessing(true);
      try {
        const sepMethod = pdfSeparation?.method;
        const pagesPerDoc = pdfSeparation?.pagesPerDocument ?? 1;

        // If this project is configured for 1-page-per-document separation, expand the PDF into per-page images.
        if (sepMethod === 'page_count' && pagesPerDoc === 1) {
          console.log(`[ScanUploader] Splitting PDF into per-page images (page_count=1): ${file.name}`);
          const { files: outFiles, kind } = await preprocessFileForUploadMany(file, { maxPdfPages: 50 });
          if (kind === 'pdf_as_images' && outFiles.length > 1) {
            console.log(`[ScanUploader] Split complete: ${outFiles.length} pages -> uploading as multiple files`);
            onMultipleFilesUpload(outFiles);
            return;
          }
        }

        // Default optimized path: pre-render first page for faster OCR preview
        console.log(`Pre-rendering PDF: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
        const { dataUrl } = await processPdfPageForOcr(file);
        console.log('PDF pre-rendered to image successfully');
        onPdfUpload(file, dataUrl);
      } catch (error) {
        console.error('PDF pre-processing failed:', error);
        toast({
          title: 'PDF Processing',
          description: 'Using server-side processing for this PDF.',
          variant: 'default',
        });
        onPdfUpload(file);
      } finally {
        setIsPreprocessing(false);
      }
      return;
    }

    // Handle images with compression
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image or PDF file.',
        variant: 'destructive',
      });
      return;
    }

    // Convert TIFF to PNG using UTIF
    if (isTiffFile(file)) {
      try {
        const pngDataUrl = await convertTiffToPngDataUrl(file);
        onScanComplete('', pngDataUrl, file.name.replace(/\.tiff?$/i, '.png'));
        return;
      } catch (e) {
        toast({
          title: 'Failed to read TIFF',
          description: 'Could not decode the TIFF image. Please convert it to PNG or JPG and try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Compress large images before processing
    setIsPreprocessing(true);
    try {
      const { dataUrl, originalSize, compressedSize } = await compressImage(file);
      if (compressedSize < originalSize) {
        console.log(`Image optimized: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB`);
      }
      onScanComplete('', dataUrl, file.name);
    } catch (error) {
      console.error('Image compression failed:', error);
      // Fallback to uncompressed
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onScanComplete('', imageData, file.name);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsPreprocessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (files.length === 1) {
      await handleFile(files[0]);
      return;
    }

    // MULTI-FILE OPTIMIZATION: expand PDFs to per-page images + compress images
    setIsPreprocessing(true);
    try {
      const processed: File[] = [];
      for (const f of files) {
        console.log(`[ScanUploader] Processing file: ${f.name}, type: ${f.type}`);

        // Preserve TIFF support
        if (isTiffFile(f)) {
          console.log(`[ScanUploader] Converting TIFF: ${f.name}`);
          const pngDataUrl = await convertTiffToPngDataUrl(f);
          const pngFile = await dataUrlToFile(pngDataUrl, f.name.replace(/\.tiff?$/i, '.png'), 'image/png');
          processed.push(pngFile);
          continue;
        }

        const { files: outFiles, kind } = await preprocessFileForUploadMany(f);
        console.log(
          `[ScanUploader] Preprocessed ${f.name} -> ${outFiles.length} file(s) (kind: ${kind}):`,
          outFiles.map(x => `${x.name} (${x.type})`)
        );
        processed.push(...outFiles);
      }
      console.log(`[ScanUploader] Uploading ${processed.length} preprocessed files:`, processed.map(f => `${f.name} (${f.type})`));
      onMultipleFilesUpload(processed);
    } catch (err) {
      console.error('[ScanUploader] Multi-file preprocessing failed, uploading originals:', err);
      toast({
        title: 'Upload Optimization Skipped',
        description: 'Uploading original files (OCR may be slower).',
      });
      onMultipleFilesUpload(files);
    } finally {
      setIsPreprocessing(false);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    if (files.length === 1) {
      await handleFile(files[0]);
      return;
    }

    // MULTI-FILE OPTIMIZATION: expand PDFs to per-page images + compress images
    setIsPreprocessing(true);
    try {
      const processed: File[] = [];
      for (const f of files) {
        console.log(`[ScanUploader] Processing file: ${f.name}, type: ${f.type}`);

        if (isTiffFile(f)) {
          console.log(`[ScanUploader] Converting TIFF: ${f.name}`);
          const pngDataUrl = await convertTiffToPngDataUrl(f);
          const pngFile = await dataUrlToFile(pngDataUrl, f.name.replace(/\.tiff?$/i, '.png'), 'image/png');
          processed.push(pngFile);
          continue;
        }

        const { files: outFiles, kind } = await preprocessFileForUploadMany(f);
        console.log(
          `[ScanUploader] Preprocessed ${f.name} -> ${outFiles.length} file(s) (kind: ${kind}):`,
          outFiles.map(x => `${x.name} (${x.type})`)
        );
        processed.push(...outFiles);
      }
      console.log(`[ScanUploader] Uploading ${processed.length} preprocessed files:`, processed.map(f => `${f.name} (${f.type})`));
      onMultipleFilesUpload(processed);
    } catch (err) {
      console.error('[ScanUploader] Multi-file preprocessing failed, uploading originals:', err);
      toast({
        title: 'Upload Optimization Skipped',
        description: 'Uploading original files (OCR may be slower).',
      });
      onMultipleFilesUpload(files);
    } finally {
      setIsPreprocessing(false);
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
        ${(isProcessing || isPreprocessing) ? 'pointer-events-none opacity-50' : ''}
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
          {(isProcessing || isPreprocessing) ? (
              <LoadingSpinner className="[&>div]:border-primary-foreground/20 [&>div:nth-child(2)]:border-t-primary-foreground [&>div:nth-child(2)]:border-r-primary-foreground/60 [&>div:last-child>div]:bg-primary-foreground" />
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
            {isPreprocessing ? 'Optimizing Document...' : isProcessing ? 'Processing Document...' : 'Upload Document or Image'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop or click to select files
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports JPG, PNG, WEBP, TIFF, PDF • Multiple files supported
          </p>
        </div>

        {!isProcessing && !isPreprocessing && (
          <div className="flex gap-2 mt-2">
            <Button variant="outline">
              Select File
            </Button>
            {isMobile && (
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMobileCapture(true);
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            )}
          </div>
        )}
      </div>

      <MobileCapture
        open={showMobileCapture}
        onClose={() => setShowMobileCapture(false)}
        onCapture={handleFile}
      />
    </div>
  );
};
