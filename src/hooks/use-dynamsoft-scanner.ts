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

export const useDynamsoftScanner = (licenseKey: string | null): UseDynamsoftScannerReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanners, setScanners] = useState<ScannerInfo[]>([]);
  const [selectedScanner, setSelectedScanner] = useState<string>('');
  const mountedRef = useRef(true);

  const refreshScannerList = useCallback(async () => {
    if (!globalDwt) {
      console.log('DWT not initialized');
      return;
    }

    try {
      const sources = await globalDwt.GetSourceNamesAsync(false);
      console.log('GetSourceNamesAsync result:', sources);
      
      const detected: ScannerInfo[] = sources.map((name: string, index: number) => ({
        id: `twain-${index}`,
        name: name || `Scanner ${index + 1}`,
        index
      }));
      
      if (mountedRef.current) {
        setScanners(detected);
        
        if (detected.length > 0 && !selectedScanner) {
          setSelectedScanner(detected[0].id);
        }
      }
    } catch (err) {
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
        if (mountedRef.current) {
          setScanners(detected);
          if (detected.length > 0 && !selectedScanner) {
            setSelectedScanner(detected[0].id);
          }
        }
      } catch (syncErr) {
        console.error('Sync scanner enumeration failed:', syncErr);
        if (mountedRef.current) {
          setError('Cannot communicate with scanner service');
        }
      }
    }
  }, [selectedScanner]);

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
      refreshScannerList();
      return;
    }

    // If initialization is in progress, wait for it
    if (globalInitPromise) {
      console.log('Waiting for existing DWT initialization...');
      globalInitPromise.then(() => {
        if (mountedRef.current && globalDwt) {
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
      return;
    }

    // Start new initialization
    globalInitPromise = new Promise<WebTwain>((resolve, reject) => {
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

      console.log('Creating DWT object...');

      Dynamsoft.DWT.CreateDWTObjectEx(
        { WebTwainId: 'dwtObject' },
        (dwt: WebTwain) => {
          console.log('DWT object created successfully');
          globalDwt = dwt;
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
      // Don't destroy the global instance on unmount
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
          const blob = await new Promise<Blob>((res, rej) => {
            globalDwt!.ConvertToBlob(
              [i],
              Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
              (result: Blob) => res(result),
              (errorCode: number, errorString: string) => rej(new Error(errorString))
            );
          });
          blobs.push(blob);
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
        // Reset global state and prompt refresh
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
