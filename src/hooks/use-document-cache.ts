import { useRef } from 'react';
import { isTiffUrl, convertTiffUrlToDataUrl } from '@/lib/image-utils';

// Image cache with size limits
const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 50;
const cacheAccessOrder: string[] = [];

// Cache for converted TIFF data URLs
const tiffConversionCache = new Map<string, string>();

export const useDocumentCache = () => {
  const loadingImages = useRef(new Set<string>());

  const preloadImage = async (url: string): Promise<HTMLImageElement> => {
    // Check if already cached
    if (imageCache.has(url)) {
      const cachedImg = imageCache.get(url)!;
      // Move to end of access order (most recent)
      const index = cacheAccessOrder.indexOf(url);
      if (index > -1) {
        cacheAccessOrder.splice(index, 1);
      }
      cacheAccessOrder.push(url);
      return cachedImg;
    }

    // Check if already loading
    if (loadingImages.current.has(url)) {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (imageCache.has(url)) {
            clearInterval(checkInterval);
            resolve(imageCache.get(url)!);
          }
        }, 50);
      });
    }

    loadingImages.current.add(url);

    try {
      // Handle TIFF files - convert to displayable format
      let imageUrl = url;
      if (isTiffUrl(url)) {
        // Check if we already converted this TIFF
        if (tiffConversionCache.has(url)) {
          imageUrl = tiffConversionCache.get(url)!;
        } else {
          console.log('[DocumentCache] Converting TIFF to PNG:', url);
          imageUrl = await convertTiffUrlToDataUrl(url);
          tiffConversionCache.set(url, imageUrl);
        }
      }

      // Load the image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imgEl = new Image();
        imgEl.onload = () => resolve(imgEl);
        imgEl.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        imgEl.src = imageUrl;
      });

      loadingImages.current.delete(url);

      // Implement LRU cache eviction
      if (imageCache.size >= MAX_CACHE_SIZE) {
        const oldestUrl = cacheAccessOrder.shift();
        if (oldestUrl) {
          imageCache.delete(oldestUrl);
        }
      }

      imageCache.set(url, img);
      cacheAccessOrder.push(url);
      return img;
    } catch (error) {
      loadingImages.current.delete(url);
      throw error;
    }
  };

  const getCachedImage = (url: string): HTMLImageElement | null => {
    return imageCache.get(url) || null;
  };

  const clearCache = () => {
    imageCache.clear();
    cacheAccessOrder.length = 0;
  };

  return {
    preloadImage,
    getCachedImage,
    clearCache
  };
};
