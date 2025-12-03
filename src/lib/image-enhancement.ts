// Advanced image enhancement utilities for document capture
// Competitive with ABBYY FlexiCapture image processing

export interface EnhancementOptions {
  autoCrop?: boolean;
  perspectiveCorrection?: boolean;
  contrastAdjustment?: number; // -100 to 100
  brightnessAdjustment?: number; // -100 to 100
  backgroundWhitening?: boolean;
  deskew?: boolean;
  denoise?: boolean;
  sharpen?: boolean;
}

export interface ImageQualityAssessment {
  overallScore: number; // 0-100
  brightness: number; // 0-100
  contrast: number; // 0-100
  sharpness: number; // 0-100
  noise: number; // 0-100 (lower is better)
  skewAngle: number; // degrees
  isAcceptable: boolean;
  recommendations: string[];
}

// Assess image quality - returns quality metrics and recommendations
export function assessImageQuality(canvas: HTMLCanvasElement): ImageQualityAssessment {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      overallScore: 0,
      brightness: 0,
      contrast: 0,
      sharpness: 0,
      noise: 100,
      skewAngle: 0,
      isAcceptable: false,
      recommendations: ['Unable to analyze image']
    };
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const recommendations: string[] = [];

  // Calculate brightness (average luminance)
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  const avgBrightness = totalBrightness / (data.length / 4);
  const brightnessScore = Math.min(100, Math.max(0, 100 - Math.abs(avgBrightness - 128) * 0.78));
  
  if (avgBrightness < 80) recommendations.push('Image is too dark - increase lighting');
  if (avgBrightness > 200) recommendations.push('Image is overexposed - reduce lighting');

  // Calculate contrast (standard deviation of luminance)
  let varianceSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    varianceSum += Math.pow(luminance - avgBrightness, 2);
  }
  const stdDev = Math.sqrt(varianceSum / (data.length / 4));
  const contrastScore = Math.min(100, stdDev * 1.5);
  
  if (contrastScore < 30) recommendations.push('Low contrast detected - document may be washed out');

  // Calculate sharpness using Laplacian variance
  const sharpnessScore = calculateSharpness(imageData);
  if (sharpnessScore < 40) recommendations.push('Image appears blurry - ensure camera is focused');

  // Estimate noise level
  const noiseScore = estimateNoise(imageData);
  if (noiseScore > 50) recommendations.push('High noise detected - improve lighting conditions');

  // Estimate skew angle
  const skewAngle = estimateSkewAngle(imageData);
  if (Math.abs(skewAngle) > 5) recommendations.push(`Document appears tilted ${skewAngle.toFixed(1)}° - straighten before capture`);

  // Calculate overall score
  const overallScore = Math.round(
    (brightnessScore * 0.2) +
    (contrastScore * 0.25) +
    (sharpnessScore * 0.3) +
    ((100 - noiseScore) * 0.15) +
    (Math.max(0, 100 - Math.abs(skewAngle) * 5) * 0.1)
  );

  return {
    overallScore,
    brightness: Math.round(brightnessScore),
    contrast: Math.round(contrastScore),
    sharpness: Math.round(sharpnessScore),
    noise: Math.round(noiseScore),
    skewAngle: Math.round(skewAngle * 10) / 10,
    isAcceptable: overallScore >= 60,
    recommendations
  };
}

// Calculate sharpness using Laplacian operator
function calculateSharpness(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  let laplacianSum = 0;
  let count = 0;

  // Convert to grayscale and apply Laplacian
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      
      // Get neighboring pixels
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;
      
      const grayTop = data[top] * 0.299 + data[top + 1] * 0.587 + data[top + 2] * 0.114;
      const grayBottom = data[bottom] * 0.299 + data[bottom + 1] * 0.587 + data[bottom + 2] * 0.114;
      const grayLeft = data[left] * 0.299 + data[left + 1] * 0.587 + data[left + 2] * 0.114;
      const grayRight = data[right] * 0.299 + data[right + 1] * 0.587 + data[right + 2] * 0.114;
      
      // Laplacian: -4*center + neighbors
      const laplacian = Math.abs(-4 * gray + grayTop + grayBottom + grayLeft + grayRight);
      laplacianSum += laplacian;
      count++;
    }
  }

  // Normalize to 0-100 scale
  const avgLaplacian = count > 0 ? laplacianSum / count : 0;
  return Math.min(100, avgLaplacian * 2);
}

// Estimate noise using local variance method
function estimateNoise(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const windowSize = 3;
  let varianceSum = 0;
  let windowCount = 0;

  for (let y = 0; y < height - windowSize; y += windowSize) {
    for (let x = 0; x < width - windowSize; x += windowSize) {
      const pixels: number[] = [];
      
      for (let wy = 0; wy < windowSize; wy++) {
        for (let wx = 0; wx < windowSize; wx++) {
          const idx = ((y + wy) * width + (x + wx)) * 4;
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          pixels.push(gray);
        }
      }
      
      const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
      const variance = pixels.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pixels.length;
      varianceSum += variance;
      windowCount++;
    }
  }

  const avgVariance = windowCount > 0 ? varianceSum / windowCount : 0;
  return Math.min(100, avgVariance / 10);
}

// Estimate document skew angle using Hough transform approximation
function estimateSkewAngle(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Detect horizontal edges and accumulate angles
  const angleVotes: Map<number, number> = new Map();
  
  for (let y = 1; y < height - 1; y += 5) {
    let runStart = -1;
    let runLength = 0;
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      const isText = gray < 180;
      
      if (isText && runStart === -1) {
        runStart = x;
        runLength = 1;
      } else if (isText) {
        runLength++;
      } else if (!isText && runStart !== -1 && runLength > 20) {
        // Check for text line continuation in next row
        const nextY = y + 5;
        if (nextY < height) {
          for (let checkX = runStart; checkX < runStart + runLength; checkX += 10) {
            const nextIdx = (nextY * width + checkX) * 4;
            const nextGray = data[nextIdx] * 0.299 + data[nextIdx + 1] * 0.587 + data[nextIdx + 2] * 0.114;
            if (nextGray < 180) {
              const angle = Math.atan2(5, checkX - runStart) * (180 / Math.PI);
              const roundedAngle = Math.round(angle * 2) / 2;
              angleVotes.set(roundedAngle, (angleVotes.get(roundedAngle) || 0) + 1);
            }
          }
        }
        runStart = -1;
        runLength = 0;
      }
    }
  }

  // Find most common angle
  let maxVotes = 0;
  let dominantAngle = 0;
  angleVotes.forEach((votes, angle) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      dominantAngle = angle;
    }
  });

  return Math.max(-15, Math.min(15, dominantAngle));
}

// Background whitening - removes colored backgrounds for cleaner OCR
export function whitenBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Calculate histogram to find background color
  const histogram: number[] = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[gray]++;
  }

  // Find peak (most common brightness = background)
  let peakValue = 0;
  let peakIndex = 255;
  for (let i = 128; i < 256; i++) {
    if (histogram[i] > peakValue) {
      peakValue = histogram[i];
      peakIndex = i;
    }
  }

  // Apply adaptive thresholding with background whitening
  const threshold = peakIndex - 60;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    
    if (gray > threshold) {
      // Whiten background
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    } else {
      // Enhance text darkness
      const factor = gray / threshold;
      data[i] = Math.round(data[i] * factor);
      data[i + 1] = Math.round(data[i + 1] * factor);
      data[i + 2] = Math.round(data[i + 2] * factor);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Deskew - correct document rotation
export function deskewImage(canvas: HTMLCanvasElement, angle?: number): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const skewAngle = angle ?? estimateSkewAngle(imageData);
  
  if (Math.abs(skewAngle) < 0.5) return canvas; // No correction needed

  const radians = skewAngle * (Math.PI / 180);
  
  // Calculate new canvas size to fit rotated image
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const newWidth = Math.ceil(canvas.width * cos + canvas.height * sin);
  const newHeight = Math.ceil(canvas.height * cos + canvas.width * sin);

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = newWidth;
  rotatedCanvas.height = newHeight;
  const rotatedCtx = rotatedCanvas.getContext('2d');
  
  if (!rotatedCtx) return canvas;

  // Fill with white background
  rotatedCtx.fillStyle = 'white';
  rotatedCtx.fillRect(0, 0, newWidth, newHeight);
  
  // Rotate around center
  rotatedCtx.translate(newWidth / 2, newHeight / 2);
  rotatedCtx.rotate(-radians);
  rotatedCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return rotatedCanvas;
}

// Denoise - reduce image noise using median filter
export function denoiseImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data);

  // Apply 3x3 median filter
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const neighbors: number[][] = [[], [], []];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          neighbors[0].push(data[idx]);
          neighbors[1].push(data[idx + 1]);
          neighbors[2].push(data[idx + 2]);
        }
      }

      const idx = (y * width + x) * 4;
      neighbors[0].sort((a, b) => a - b);
      neighbors[1].sort((a, b) => a - b);
      neighbors[2].sort((a, b) => a - b);
      
      output[idx] = neighbors[0][4];
      output[idx + 1] = neighbors[1][4];
      output[idx + 2] = neighbors[2][4];
    }
  }

  const newImageData = new ImageData(output, width, height);
  ctx.putImageData(newImageData, 0, 0);
  return canvas;
}

// Sharpen - enhance text edges
export function sharpenImage(canvas: HTMLCanvasElement, amount: number = 0.5): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data);

  // Unsharp mask kernel
  const kernel = [
    0, -amount, 0,
    -amount, 1 + 4 * amount, -amount,
    0, -amount, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += data[idx] * kernel[ki++];
          }
        }

        const idx = (y * width + x) * 4 + c;
        output[idx] = Math.max(0, Math.min(255, Math.round(sum)));
      }
    }
  }

  const newImageData = new ImageData(output, width, height);
  ctx.putImageData(newImageData, 0, 0);
  return canvas;
}

// Auto-crop: Detect document edges and crop to content
export function autoCropImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Find content boundaries using edge detection
  let minX = canvas.width, minY = canvas.height;
  let maxX = 0, maxY = 0;
  
  // Use Sobel edge detection for better boundary finding
  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * canvas.width + x) * 4;
      const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      
      // Check if this pixel is content (not near-white)
      if (gray < 235) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Add padding
  const padding = Math.max(10, Math.min(canvas.width, canvas.height) * 0.02);
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width, maxX + padding);
  maxY = Math.min(canvas.height, maxY + padding);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Only crop if meaningful content found
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
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  // For advanced perspective correction, we'd need corner detection
  // This provides basic correction by applying deskew
  return deskewImage(canvas);
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
  
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const brightnessFactor = brightness * 2.55;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, contrastFactor * (data[i] - 128) + 128 + brightnessFactor));
    data[i + 1] = Math.max(0, Math.min(255, contrastFactor * (data[i + 1] - 128) + 128 + brightnessFactor));
    data[i + 2] = Math.max(0, Math.min(255, contrastFactor * (data[i + 2] - 128) + 128 + brightnessFactor));
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Apply all enhancements with quality-based auto-correction
export function enhanceImage(
  canvas: HTMLCanvasElement,
  options: EnhancementOptions
): HTMLCanvasElement {
  let processedCanvas = canvas;
  
  // Auto-apply corrections based on quality assessment
  const quality = assessImageQuality(canvas);
  
  // Apply deskew first if needed
  if (options.deskew || Math.abs(quality.skewAngle) > 2) {
    processedCanvas = deskewImage(processedCanvas);
  }
  
  // Denoise if high noise detected
  if (options.denoise || quality.noise > 40) {
    processedCanvas = denoiseImage(processedCanvas);
  }
  
  // Background whitening for documents
  if (options.backgroundWhitening) {
    processedCanvas = whitenBackground(processedCanvas);
  }
  
  // Auto crop
  if (options.autoCrop) {
    processedCanvas = autoCropImage(processedCanvas);
  }
  
  // Perspective correction
  if (options.perspectiveCorrection) {
    processedCanvas = correctPerspective(processedCanvas);
  }
  
  // Adjust contrast/brightness
  if (options.contrastAdjustment !== undefined || options.brightnessAdjustment !== undefined) {
    processedCanvas = adjustContrastBrightness(
      processedCanvas,
      options.contrastAdjustment || 0,
      options.brightnessAdjustment || 0
    );
  }
  
  // Sharpen for better text recognition
  if (options.sharpen || quality.sharpness < 50) {
    processedCanvas = sharpenImage(processedCanvas, 0.3);
  }
  
  return processedCanvas;
}

// Create enhancement profile for specific document types
export function getEnhancementProfile(documentType: string): EnhancementOptions {
  const profiles: Record<string, EnhancementOptions> = {
    invoice: {
      autoCrop: true,
      backgroundWhitening: true,
      deskew: true,
      sharpen: true,
      contrastAdjustment: 10
    },
    receipt: {
      autoCrop: true,
      backgroundWhitening: true,
      deskew: true,
      denoise: true,
      contrastAdjustment: 20
    },
    form: {
      autoCrop: true,
      deskew: true,
      sharpen: true,
      backgroundWhitening: false
    },
    handwritten: {
      autoCrop: true,
      deskew: true,
      denoise: true,
      sharpen: false, // Don't over-sharpen handwriting
      contrastAdjustment: 15,
      brightnessAdjustment: 5
    },
    id_document: {
      autoCrop: true,
      perspectiveCorrection: true,
      sharpen: true,
      contrastAdjustment: 10
    },
    default: {
      autoCrop: true,
      deskew: true,
      backgroundWhitening: true,
      sharpen: true
    }
  };

  return profiles[documentType] || profiles.default;
}
