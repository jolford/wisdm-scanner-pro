import { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface PDFPage {
  pageNumber: number;
  canvas: HTMLCanvasElement | null;
  thumbnail: string | null;
  isLoading: boolean;
}

export const usePDFViewer = (url: string | null) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!url || !url.toLowerCase().includes('.pdf')) {
      setPdfDoc(null);
      setPages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const loadPDF = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        
        // Initialize page array
        const initialPages: PDFPage[] = Array.from({ length: pdf.numPages }, (_, i) => ({
          pageNumber: i + 1,
          canvas: null,
          thumbnail: null,
          isLoading: false
        }));
        setPages(initialPages);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF document');
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [url]);

  // Render page to canvas
  const renderPage = useCallback(async (
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = 2.0
  ): Promise<void> => {
    if (!pdfDoc) return;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      
      if (!context) return;

      const renderContext: any = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error(`Error rendering page ${pageNumber}:`, err);
    }
  }, [pdfDoc]);

  // Generate thumbnail
  const generateThumbnail = useCallback(async (pageNumber: number): Promise<string | null> => {
    if (!pdfDoc) return null;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnails
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      
      if (!context) return null;

      const renderContext: any = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (err) {
      console.error(`Error generating thumbnail for page ${pageNumber}:`, err);
      return null;
    }
  }, [pdfDoc]);

  // Get text content for search/selection
  const getPageText = useCallback(async (pageNumber: number): Promise<string> => {
    if (!pdfDoc) return '';

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      return textContent.items.map((item: any) => item.str).join(' ');
    } catch (err) {
      console.error(`Error getting text for page ${pageNumber}:`, err);
      return '';
    }
  }, [pdfDoc]);

  return {
    pdfDoc,
    pages,
    currentPage,
    setCurrentPage,
    totalPages,
    isLoading,
    error,
    renderPage,
    generateThumbnail,
    getPageText
  };
};
