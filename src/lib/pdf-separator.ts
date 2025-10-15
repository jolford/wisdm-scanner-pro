import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

export interface SeparationConfig {
  method: 'barcode' | 'blank_page' | 'page_count' | 'none';
  barcodePatterns?: string[];
  blankPageThreshold?: number; // Percentage of white space to consider blank (e.g., 95)
  pagesPerDocument?: number;
}

interface DocumentBoundary {
  startPage: number;
  endPage: number;
  separatorType: string;
}

/**
 * Analyzes a PDF and determines document boundaries based on separation config
 */
export async function analyzePdfSeparation(
  pdfDoc: any,
  config: SeparationConfig
): Promise<DocumentBoundary[]> {
  if (config.method === 'none') {
    // Treat entire PDF as one document
    return [{
      startPage: 1,
      endPage: pdfDoc.numPages,
      separatorType: 'none'
    }];
  }

  if (config.method === 'page_count' && config.pagesPerDocument) {
    // Split by fixed page count
    return splitByPageCount(pdfDoc.numPages, config.pagesPerDocument);
  }

  if (config.method === 'blank_page') {
    // Detect blank pages as separators
    return await detectBlankPageSeparators(pdfDoc, config.blankPageThreshold || 95);
  }

  if (config.method === 'barcode') {
    // Detect barcode separator sheets
    return await detectBarcodeSeparators(pdfDoc, config.barcodePatterns || []);
  }

  // Default: treat as single document
  return [{
    startPage: 1,
    endPage: pdfDoc.numPages,
    separatorType: 'none'
  }];
}

/**
 * Split PDF by fixed page count
 */
function splitByPageCount(totalPages: number, pagesPerDoc: number): DocumentBoundary[] {
  const boundaries: DocumentBoundary[] = [];
  
  for (let i = 1; i <= totalPages; i += pagesPerDoc) {
    boundaries.push({
      startPage: i,
      endPage: Math.min(i + pagesPerDoc - 1, totalPages),
      separatorType: 'page_count'
    });
  }
  
  return boundaries;
}

/**
 * Detect blank pages as document separators
 */
async function detectBlankPageSeparators(
  pdfDoc: any,
  threshold: number
): Promise<DocumentBoundary[]> {
  const boundaries: DocumentBoundary[] = [];
  const blankPages: number[] = [];

  // Analyze each page for blank content
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Check if page has minimal text content
    const textLength = textContent.items.reduce((sum: number, item: any) => 
      sum + (item.str || '').trim().length, 0
    );

    // If very little text, consider it blank
    if (textLength < 50) {
      blankPages.push(pageNum);
    }
  }

  // Create document boundaries based on blank pages
  let currentStart = 1;
  
  for (const blankPage of blankPages) {
    if (blankPage > currentStart) {
      boundaries.push({
        startPage: currentStart,
        endPage: blankPage - 1,
        separatorType: 'blank_page'
      });
    }
    currentStart = blankPage + 1;
  }

  // Add final document if there are pages after last separator
  if (currentStart <= pdfDoc.numPages) {
    boundaries.push({
      startPage: currentStart,
      endPage: pdfDoc.numPages,
      separatorType: 'blank_page'
    });
  }

  return boundaries.length > 0 ? boundaries : [{
    startPage: 1,
    endPage: pdfDoc.numPages,
    separatorType: 'none'
  }];
}

/**
 * Detect barcode separator sheets
 */
async function detectBarcodeSeparators(
  pdfDoc: any,
  patterns: string[]
): Promise<DocumentBoundary[]> {
  const boundaries: DocumentBoundary[] = [];
  const separatorPages: number[] = [];

  // Analyze each page for separator patterns
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Get all text from page
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .toLowerCase();

    // Check for separator patterns
    const isSeparator = patterns.some(pattern => 
      pageText.includes(pattern.toLowerCase()) ||
      pageText.includes('separator') ||
      pageText.includes('divider')
    );

    if (isSeparator) {
      separatorPages.push(pageNum);
    }
  }

  // Create document boundaries based on separator pages
  let currentStart = 1;
  
  for (const separatorPage of separatorPages) {
    if (separatorPage > currentStart) {
      boundaries.push({
        startPage: currentStart,
        endPage: separatorPage - 1,
        separatorType: 'barcode'
      });
    }
    currentStart = separatorPage + 1;
  }

  // Add final document if there are pages after last separator
  if (currentStart <= pdfDoc.numPages) {
    boundaries.push({
      startPage: currentStart,
      endPage: pdfDoc.numPages,
      separatorType: 'barcode'
    });
  }

  return boundaries.length > 0 ? boundaries : [{
    startPage: 1,
    endPage: pdfDoc.numPages,
    separatorType: 'none'
  }];
}

/**
 * Extract pages from PDF within a boundary
 */
export async function extractPagesFromBoundary(
  pdfDoc: any,
  boundary: DocumentBoundary
): Promise<string[]> {
  const pageUrls: string[] = [];
  
  for (let pageNum = boundary.startPage; pageNum <= boundary.endPage; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    pageUrls.push(canvas.toDataURL('image/png'));
  }
  
  return pageUrls;
}

/**
 * Get document name for a boundary
 */
export function getDocumentName(
  fileName: string,
  boundaryIndex: number,
  totalBoundaries: number
): string {
  const baseName = fileName.replace(/\.pdf$/i, '');
  
  if (totalBoundaries === 1) {
    return fileName;
  }
  
  return `${baseName}_doc${boundaryIndex + 1}.pdf`;
}
