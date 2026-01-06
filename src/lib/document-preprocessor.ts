/**
 * Document Preprocessor
 * 
 * Client-side optimization for OCR processing:
 * 1. Compress images before upload to reduce file size
 * 2. Pre-render PDFs to images client-side to avoid server-side conversion
 */

import imageCompression from 'browser-image-compression';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use CDN for reliability
const pdfjsVersion = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;

console.log('[document-preprocessor] PDF.js version:', pdfjsVersion);

/**
 * Compression options for different scenarios
 */
const COMPRESSION_OPTIONS = {
  standard: {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.85,
  },
  aggressive: {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.75,
  },
  highQuality: {
    maxSizeMB: 2,
    maxWidthOrHeight: 3000,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.92,
  },
};

/**
 * Compress an image file for OCR processing
 * @param file - The image file to compress
 * @param mode - Compression mode: 'standard', 'aggressive', or 'highQuality'
 * @returns Compressed file and its data URL
 */
export async function compressImage(
  file: File,
  mode: 'standard' | 'aggressive' | 'highQuality' = 'standard'
): Promise<{ file: File; dataUrl: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;
  
  // Skip compression for already small files (< 500KB)
  if (originalSize < 500 * 1024) {
    const dataUrl = await fileToDataUrl(file);
    return { file, dataUrl, originalSize, compressedSize: originalSize };
  }
  
  const options = COMPRESSION_OPTIONS[mode];
  const compressedFile = await imageCompression(file, options);
  const dataUrl = await fileToDataUrl(compressedFile);
  
  console.log(`Image compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${((1 - compressedFile.size / originalSize) * 100).toFixed(0)}% reduction)`);
  
  return {
    file: compressedFile,
    dataUrl,
    originalSize,
    compressedSize: compressedFile.size,
  };
}

/**
 * Convert a file to a data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a data URL (data:image/*;base64,...) to a File
 */
export async function dataUrlToFile(
  dataUrl: string,
  fileName: string,
  mimeType?: string
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = mimeType || blob.type || 'application/octet-stream';
  return new File([blob], fileName, { type });
}

/**
 * Preprocess a single file for upload:
 * - PDF -> render first page to compressed JPEG File
 * - Image -> compress and return compressed File
 */
export async function preprocessFileForUpload(
  file: File
): Promise<{ file: File; kind: 'pdf_as_image' | 'image' | 'other' }>
{
  console.log(`[preprocessFileForUpload] Processing: ${file.name}, type: ${file.type}, size: ${(file.size/1024).toFixed(1)}KB`);

  if (file.type === 'application/pdf') {
    try {
      console.log(`[preprocessFileForUpload] Rendering PDF first page to image...`);
      const { dataUrl } = await processPdfPageForOcr(file, 1);
      const imageFileName = file.name.replace(/\.pdf$/i, '') + '-page-1.jpg';
      const imageFile = await dataUrlToFile(dataUrl, imageFileName, 'image/jpeg');
      console.log(`[preprocessFileForUpload] PDF converted: ${imageFileName}, size: ${(imageFile.size/1024).toFixed(1)}KB`);
      return { file: imageFile, kind: 'pdf_as_image' };
    } catch (e) {
      console.error(`[preprocessFileForUpload] PDF conversion failed for ${file.name}:`, e);
      // Return original file if conversion fails
      return { file, kind: 'other' };
    }
  }

  if (file.type.startsWith('image/')) {
    const { file: compressed } = await compressImage(file, 'standard');
    console.log(`[preprocessFileForUpload] Image compressed: ${file.name} -> ${(compressed.size/1024).toFixed(1)}KB`);
    return { file: compressed, kind: 'image' };
  }

  console.log(`[preprocessFileForUpload] Unsupported type, returning as-is: ${file.name}`);
  return { file, kind: 'other' };
}

/**
 * Preprocess a file into one-or-many uploadable files.
 *
 * IMPORTANT: Cashout / voucher PDFs often contain the real values on later pages.
 * If we only rasterize page 1, OCR/extraction will look "empty".
 */
export async function preprocessFileForUploadMany(
  file: File,
  opts?: { maxPdfPages?: number }
): Promise<{ files: File[]; kind: 'pdf_as_images' | 'image' | 'other' }>
{
  const maxPdfPages = opts?.maxPdfPages ?? 25;

  if (file.type === 'application/pdf') {
    try {
      console.log(`[preprocessFileForUploadMany] Rendering PDF pages to images (max ${maxPdfPages})...`);
      const { pages, totalPages } = await renderPdfToImages(file, maxPdfPages);

      if (totalPages > maxPdfPages) {
        console.warn(`[preprocessFileForUploadMany] PDF has ${totalPages} pages; only rendering first ${maxPdfPages}.`);
      }

      const out: File[] = [];
      for (const p of pages) {
        const pageFileName = file.name.replace(/\.pdf$/i, '') + `-page-${p.pageNum}.jpg`;
        const pageFile = await dataUrlToFile(p.dataUrl, pageFileName, 'image/jpeg');
        // Extra compression to keep uploads snappy and OCR friendly
        const { file: compressed } = await compressImage(pageFile, 'standard');
        out.push(compressed);
      }

      console.log(`[preprocessFileForUploadMany] PDF converted to ${out.length} image(s)`);
      return { files: out, kind: 'pdf_as_images' };
    } catch (e) {
      console.error(`[preprocessFileForUploadMany] PDF conversion failed for ${file.name}:`, e);
      return { files: [file], kind: 'other' };
    }
  }

  if (file.type.startsWith('image/')) {
    const { file: compressed } = await compressImage(file, 'standard');
    return { files: [compressed], kind: 'image' };
  }

  return { files: [file], kind: 'other' };
}
/**
 * Render a PDF page to a canvas and return as data URL
 * @param pdfDoc - PDF document object
 * @param pageNum - Page number (1-indexed)
 * @param scale - Render scale (higher = better quality but larger size)
 */
async function renderPdfPageToDataUrl(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = 2.0
): Promise<string> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  // Render page
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise;
  
  // Convert to JPEG for smaller size
  return canvas.toDataURL('image/jpeg', 0.90);
}

/**
 * Pre-render a PDF file to images client-side
 * This avoids server-side PDF conversion which is unreliable
 * @param file - The PDF file to process
 * @param maxPages - Maximum number of pages to render (default: 10)
 * @returns Array of rendered page images with metadata
 */
export async function renderPdfToImages(
  file: File,
  maxPages: number = 10
): Promise<{
  pages: Array<{ pageNum: number; dataUrl: string; width: number; height: number }>;
  totalPages: number;
}> {
  // Load PDF
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdfDoc.numPages;
  const pagesToRender = Math.min(totalPages, maxPages);
  
  console.log(`Rendering ${pagesToRender} of ${totalPages} PDF pages client-side...`);
  
  const pages: Array<{ pageNum: number; dataUrl: string; width: number; height: number }> = [];
  
  // Render pages in parallel (up to 3 at a time to avoid memory issues)
  const batchSize = 3;
  for (let i = 0; i < pagesToRender; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, pagesToRender); j++) {
      batch.push(
        (async () => {
          const page = await pdfDoc.getPage(j + 1);
          const viewport = page.getViewport({ scale: 2.0 });
          const dataUrl = await renderPdfPageToDataUrl(pdfDoc, j + 1);
          return {
            pageNum: j + 1,
            dataUrl,
            width: viewport.width,
            height: viewport.height,
          };
        })()
      );
    }
    const results = await Promise.all(batch);
    pages.push(...results);
  }
  
  console.log(`PDF pre-rendering complete: ${pages.length} pages converted to images`);
  
  return { pages, totalPages };
}

/**
 * Process a single PDF page and compress it
 * Returns a compressed image ready for OCR
 */
export async function processPdfPageForOcr(
  file: File,
  pageNum: number = 1
): Promise<{ dataUrl: string; width: number; height: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  // Render page
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise;
  
  // Convert to blob for compression
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
  });
  
  // Compress if large
  const tempFile = new File([blob], `page-${pageNum}.jpg`, { type: 'image/jpeg' });
  const { dataUrl } = await compressImage(tempFile, 'standard');
  
  return {
    dataUrl,
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Batch process multiple files with compression
 * @param files - Array of files to process
 * @param onProgress - Progress callback
 */
export async function batchProcessFiles(
  files: File[],
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{ file: File; dataUrl: string; isPdf: boolean; pages?: number }>> {
  const results: Array<{ file: File; dataUrl: string; isPdf: boolean; pages?: number }> = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length);
    
    if (file.type === 'application/pdf') {
      // Pre-render first page of PDF
      const { dataUrl } = await processPdfPageForOcr(file);
      const { totalPages } = await renderPdfToImages(file, 1);
      results.push({ file, dataUrl, isPdf: true, pages: totalPages });
    } else if (file.type.startsWith('image/')) {
      // Compress image
      const { dataUrl } = await compressImage(file);
      results.push({ file, dataUrl, isPdf: false });
    }
  }
  
  onProgress?.(files.length, files.length);
  return results;
}
