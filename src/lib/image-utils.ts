// Utility functions for image processing (TIFF conversion)
// Note: UTIF does not ship TypeScript types by default
// We keep the typing loose to avoid build issues.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let UTIF: any;

// Lazy load UTIF only when needed to keep bundle smaller
async function getUTIF() {
  if (!UTIF) {
    // Dynamic import to avoid SSR issues and reduce initial bundle
    // @ts-ignore
    UTIF = await import('utif');
  }
  return UTIF;
}

export function isTiffFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === 'image/tiff' || name.endsWith('.tif') || name.endsWith('.tiff');
}

// Convert a TIFF file into a PNG data URL
export async function convertTiffToPngDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const UTIF = await getUTIF();

  const ifds = UTIF.decode(arrayBuffer);
  if (!ifds || ifds.length === 0) {
    throw new Error('Failed to decode TIFF image.');
  }

  // Decode first page
  UTIF.decodeImage(arrayBuffer, ifds[0]);
  const rgba: Uint8Array = UTIF.toRGBA8(ifds[0]);
  const width: number = ifds[0].width;
  const height: number = ifds[0].height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context.');

  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);

  // Export as PNG to preserve quality, reduce size if very large
  return canvas.toDataURL('image/png');
}
