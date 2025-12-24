import { useState, useEffect, useRef } from 'react';

interface UseLazyImageOptions {
  src: string;
  placeholder?: string;
  threshold?: number;
  rootMargin?: string;
}

interface UseLazyImageResult {
  imageSrc: string;
  isLoaded: boolean;
  isInView: boolean;
  ref: React.RefObject<HTMLElement>;
}

/**
 * Lazy loading hook for images using Intersection Observer
 * Only loads images when they enter the viewport
 */
export function useLazyImage({
  src,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E',
  threshold = 0.1,
  rootMargin = '50px',
}: UseLazyImageOptions): UseLazyImageResult {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setIsLoaded(true); // Still mark as loaded on error
  }, [isInView, src]);

  return {
    imageSrc: isInView && isLoaded ? src : placeholder,
    isLoaded,
    isInView,
    ref,
  };
}

/**
 * Hook for batch lazy loading multiple images
 */
export function useLazyImages(sources: string[]) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const preloadImage = (src: string) => {
    if (loadedImages.has(src)) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setLoadedImages((prev) => new Set(prev).add(src));
        resolve();
      };
      img.onerror = reject;
    });
  };

  const preloadAll = async () => {
    await Promise.allSettled(sources.map(preloadImage));
  };

  return {
    loadedImages,
    preloadImage,
    preloadAll,
    isLoaded: (src: string) => loadedImages.has(src),
  };
}
