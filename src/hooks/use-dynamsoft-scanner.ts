import { useState, useEffect, useCallback, useRef } from 'react';
import Dynamsoft from 'dwt';
import { WebTwain } from 'dwt/dist/types/WebTwain';

interface ScannerInfo {
  id: string;
  name: string;
  index: number;
}

interface UseDynamsoftScannerReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  scanners: ScannerInfo[];
  selectedScanner: string;
  setSelectedScanner: (id: string) => void;
  scan: () => Promise<Blob[]>;
  refreshScanners: () => void;
}

// Global singleton to persist across component remounts
let globalDwt: WebTwain | null = null;
let globalInitPromise: Promise<WebTwain> | null = null;
let isInitializing = false;
let dwtCounter = 0; // Unique ID counter to prevent duplicate WebTwainId errors

export const useDynamsoftScanner = (licenseKey: string | null): UseDynamsoftScannerReturn => {
  const [isReady, setIsReady] = useState(!!globalDwt);
  const [isLoading, setIsLoading] = useState(!globalDwt && !!licenseKey);
  const [error, setError] = useState<string | null>(null);
  const [scanners, setScanners] = useState<ScannerInfo[]>([]);
  const [selectedScanner, setSelectedScanner] = useState<string>('');
  const mountedRef = useRef(true);
  const scannersLoadedRef = useRef(false);

  // Stable refresh function that doesn't depend on selectedScanner
  const refreshScannerList = useCallback(() => {
    if (!globalDwt) {
      console.log('DWT not initialized');
      return;
    }

    globalDwt.GetSourceNamesAsync(false).then((sources: string[]) => {
      console.log('GetSourceNamesAsync result:', sources);
      
      const detected: ScannerInfo[] = sources.map((name: string, index: number) => ({
        id: `twain-${index}`,
        name: name || `Scanner ${index + 1}`,
        index
      }));
      
      setScanners(detected);
      
      // Only set default scanner on first load
      if (detected.length > 0 && !scannersLoadedRef.current) {
        scannersLoadedRef.current = true;
        setSelectedScanner(detected[0].id);
      }
    }).catch((err: Error) => {
      console.error('GetSourceNamesAsync error:', err);
      // Fallback to sync method
      try {
        const count = globalDwt?.SourceCount || 0;
        const detected: ScannerInfo[] = [];
        for (let i = 0; i < count; i++) {
          const name = globalDwt?.GetSourceNameItems(i);
          detected.push({
            id: `twain-${i}`,
            name: name || `Scanner ${i + 1}`,
            index: i
          });
        }
        setScanners(detected);
        if (detected.length > 0 && !scannersLoadedRef.current) {
          scannersLoadedRef.current = true;
          setSelectedScanner(detected[0].id);
        }
      } catch (syncErr) {
        console.error('Sync scanner enumeration failed:', syncErr);
        setError('Cannot communicate with scanner service');
      }
    });
  }, []); // No dependencies - stable reference

  // Initialize Dynamsoft Web TWAIN
  useEffect(() => {
    mountedRef.current = true;
    
    if (!licenseKey) {
      setIsLoading(false);
      setError('License key not configured');
      return;
    }

    // If already initialized, use existing instance
    if (globalDwt) {
      console.log('Using existing DWT instance');
      setIsReady(true);
      setIsLoading(false);
      if (!scannersLoadedRef.current) {
        refreshScannerList();
      }
      return;
    }

    // If initialization is already in progress, don't start another
    if (isInitializing || globalInitPromise) {
      console.log('DWT initialization already in progress...');
      if (globalInitPromise) {
        globalInitPromise.then(() => {
          if (mountedRef.current) {
            setIsReady(true);
            setIsLoading(false);
            refreshScannerList();
          }
        }).catch((err) => {
          if (mountedRef.current) {
            setError(err.message);
            setIsLoading(false);
          }
        });
      }
      return;
    }

    // Start new initialization
    isInitializing = true;
    setIsLoading(true);
    
    console.log('Starting new DWT initialization...');
    
    // Configure Dynamsoft
    Dynamsoft.DWT.ProductKey = licenseKey;
    Dynamsoft.DWT.ResourcesPath = 'https://unpkg.com/dwt@latest/dist';
    Dynamsoft.DWT.AutoLoad = false;

    // Create hidden container
    let container = document.getElementById('dwtcontrolContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dwtcontrolContainer';
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    // Use unique ID to prevent "Duplicate WebTwainId" errors
    const uniqueId = `dwtObject_${++dwtCounter}`;
    
    globalInitPromise = new Promise<WebTwain>((resolve, reject) => {
      Dynamsoft.DWT.CreateDWTObjectEx(
        { WebTwainId: uniqueId },
        (dwt: WebTwain) => {
          console.log('DWT object created successfully');
          globalDwt = dwt;
          isInitializing = false;
          resolve(dwt);
        },
        (err: { code: number; message: string }) => {
          console.error('DWT creation failed:', err);
          let errorMsg = `Scanner SDK Error (${err.code}): ${err.message}`;
          
          if (err.code === -2300 || err.message.toLowerCase().includes('service')) {
            errorMsg = 'Dynamsoft Service not responding. Please restart Dynamsoft Service from System Tray.';
          } else if (err.code === -2319) {
            errorMsg = 'License expired or invalid';
          }
          
          isInitializing = false;
          globalInitPromise = null;
          reject(new Error(errorMsg));
        }
      );
    });

    globalInitPromise.then(() => {
      if (mountedRef.current) {
        setIsReady(true);
        setIsLoading(false);
        setTimeout(refreshScannerList, 500);
      }
    }).catch((err) => {
      if (mountedRef.current) {
        setError(err.message);
        setIsLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [licenseKey, refreshScannerList]);

  const scan = useCallback(async (): Promise<Blob[]> => {
    if (!globalDwt) {
      throw new Error('Scanner not ready. Please refresh the page.');
    }

    const scanner = scanners.find(s => s.id === selectedScanner);
    if (!scanner) {
      throw new Error('No scanner selected');
    }

    console.log('Starting scan with scanner:', scanner.name, 'index:', scanner.index);

    try {
      // Select source by index first
      globalDwt.SelectSourceByIndex(scanner.index);
      
      // Open and acquire using async methods
      await globalDwt.SelectSourceAsync();
      
      console.log('Source selected, acquiring image...');
      
      await globalDwt.AcquireImageAsync({
        IfCloseSourceAfterAcquire: true,
        PixelType: Dynamsoft.DWT.EnumDWT_PixelType.TWPT_RGB,
        Resolution: 300,
        IfFeederEnabled: false,
        IfDuplexEnabled: false,
        IfShowUI: true,
      });
      
      console.log('Scan completed, images in buffer:', globalDwt.HowManyImagesInBuffer);
      
      const blobs: Blob[] = [];
      const imageCount = globalDwt.HowManyImagesInBuffer;

      if (imageCount === 0) {
        return [];
      }

      for (let i = 0; i < imageCount; i++) {
        try {
          // Try multiple methods to get image data
          let blob: Blob | null = null;
          
          // Method 1: Try GetImageURL (returns data URL)
          try {
            const dataUrl = globalDwt!.GetImageURL(i, 300, 300);
            if (dataUrl && dataUrl.startsWith('data:')) {
              const base64 = dataUrl.split(',')[1];
              const byteChars = atob(base64);
              const byteNums = new Array(byteChars.length);
              for (let j = 0; j < byteChars.length; j++) {
                byteNums[j] = byteChars.charCodeAt(j);
              }
              blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
              console.log(`Method 1 (GetImageURL) succeeded for image ${i + 1}`);
            }
          } catch (e1) {
            console.log('GetImageURL failed, trying ConvertToBase64...', e1);
          }
          
          // Method 2: Try ConvertToBase64 if Method 1 failed
          if (!blob) {
            try {
              const base64Result = await new Promise<string>((res, rej) => {
                globalDwt!.ConvertToBase64(
                  [i],
                  Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
                  (result: { getData: (index: number, count: number) => string; getLength: () => number }) => {
                    const base64String = result.getData(0, result.getLength());
                    res(base64String);
                  },
                  (errorCode: number, errorString: string) => rej(new Error(`${errorCode}: ${errorString}`))
                );
              });
              
              const byteCharacters = atob(base64Result);
              const byteNumbers = new Array(byteCharacters.length);
              for (let j = 0; j < byteCharacters.length; j++) {
                byteNumbers[j] = byteCharacters.charCodeAt(j);
              }
              blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
              console.log(`Method 2 (ConvertToBase64) succeeded for image ${i + 1}`);
            } catch (e2) {
              console.log('ConvertToBase64 failed', e2);
            }
          }
          
          if (blob && blob.size > 0) {
            blobs.push(blob);
            console.log(`Image ${i + 1} converted successfully, size: ${blob.size} bytes`);
          } else {
            console.error(`Failed to convert image ${i + 1}`);
          }
        } catch (e) {
          console.error('Error converting image:', e);
        }
      }

      globalDwt.RemoveAllImages();
      return blobs;
      
    } catch (error) {
      console.error('Scan error:', error);
      const err = error as { message?: string; code?: number };
      const errorMessage = err.message || 'Unknown error';
      
      if (errorMessage.toLowerCase().includes('cancel') || errorMessage.includes('-1032')) {
        return []; // User cancelled
      }
      
      if (errorMessage.toLowerCase().includes('destroyed')) {
        globalDwt = null;
        globalInitPromise = null;
        throw new Error('Scanner connection lost. Please refresh the page and try again.');
      }
      
      throw new Error(errorMessage);
    }
  }, [scanners, selectedScanner]);

  return {
    isReady,
    isLoading,
    error,
    scanners,
    selectedScanner,
    setSelectedScanner,
    scan,
    refreshScanners: refreshScannerList
  };
};
