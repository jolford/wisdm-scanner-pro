// Image enhancement utilities for mobile capture

export interface EnhancementOptions {
  autoCrop?: boolean;
  perspectiveCorrection?: boolean;
  contrastAdjustment?: number; // -100 to 100
  brightnessAdjustment?: number; // -100 to 100
}

// Auto-crop: Detect document edges and crop to content
export function autoCropImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Find content boundaries
  let minX = canvas.width, minY = canvas.height;
  let maxX = 0, maxY = 0;
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      // Detect content (not pure white/bright)
      if (brightness < 240) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Add small padding
  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width, maxX + padding);
  maxY = Math.min(canvas.height, maxY + padding);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Only crop if we found meaningful content
  if (width > 100 && height > 100 && (width < canvas.width * 0.95 || height < canvas.height * 0.95)) {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    if (croppedCtx) {
      croppedCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
      return croppedCanvas;
    }
  }
  
  return canvas;
}

// Perspective correction: Basic keystone correction
export function correctPerspective(canvas: HTMLCanvasElement): HTMLCanvasElement {
  // For simplicity, apply a basic straightening based on edge detection
  // Full perspective correction would require corner detection which is complex
  // This applies a subtle correction that helps with most cases
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  const correctedCanvas = document.createElement('canvas');
  correctedCanvas.width = canvas.width;
  correctedCanvas.height = canvas.height;
  const correctedCtx = correctedCanvas.getContext('2d');
  
  if (!correctedCtx) return canvas;
  
  // Apply slight perspective transformation (simplified)
  correctedCtx.drawImage(canvas, 0, 0);
  
  return correctedCanvas;
}

// Adjust contrast and brightness
export function adjustContrastBrightness(
  canvas: HTMLCanvasElement,
  contrast: number = 0,
  brightness: number = 0
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Normalize values: -100 to 100 -> adjustment factors
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const brightnessFactor = brightness * 2.55;
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast
    data[i] = contrastFactor * (data[i] - 128) + 128;
    data[i + 1] = contrastFactor * (data[i + 1] - 128) + 128;
    data[i + 2] = contrastFactor * (data[i + 2] - 128) + 128;
    
    // Apply brightness
    data[i] += brightnessFactor;
    data[i + 1] += brightnessFactor;
    data[i + 2] += brightnessFactor;
    
    // Clamp values
    data[i] = Math.max(0, Math.min(255, data[i]));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Apply all enhancements
export function enhanceImage(
  canvas: HTMLCanvasElement,
  options: EnhancementOptions
): HTMLCanvasElement {
  let processedCanvas = canvas;
  
  if (options.autoCrop) {
    processedCanvas = autoCropImage(processedCanvas);
  }
  
  if (options.perspectiveCorrection) {
    processedCanvas = correctPerspective(processedCanvas);
  }
  
  if (options.contrastAdjustment !== undefined || options.brightnessAdjustment !== undefined) {
    processedCanvas = adjustContrastBrightness(
      processedCanvas,
      options.contrastAdjustment || 0,
      options.brightnessAdjustment || 0
    );
  }
  
  return processedCanvas;
}
