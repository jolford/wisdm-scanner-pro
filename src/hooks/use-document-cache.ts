import { useEffect, useRef } from 'react';

// Image cache with size limits
const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 50;
const cacheAccessOrder: string[] = [];

export const useDocumentCache = () => {
  const loadingImages = useRef(new Set<string>());

  const preloadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      // Check if already cached
      if (imageCache.has(url)) {
        const cachedImg = imageCache.get(url)!;
        // Move to end of access order (most recent)
        const index = cacheAccessOrder.indexOf(url);
        if (index > -1) {
          cacheAccessOrder.splice(index, 1);
        }
        cacheAccessOrder.push(url);
        resolve(cachedImg);
        return;
      }

      // Check if already loading
      if (loadingImages.current.has(url)) {
        // Wait for existing load to complete
        const checkInterval = setInterval(() => {
          if (imageCache.has(url)) {
            clearInterval(checkInterval);
            resolve(imageCache.get(url)!);
          }
        }, 50);
        return;
      }

      // Start loading
      loadingImages.current.add(url);
      const img = new Image();
      
      img.onload = () => {
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
        resolve(img);
      };

      img.onerror = () => {
        loadingImages.current.delete(url);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });
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
