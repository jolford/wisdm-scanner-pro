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

export const useDynamsoftScanner = (licenseKey: string | null): UseDynamsoftScannerReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanners, setScanners] = useState<ScannerInfo[]>([]);
  const [selectedScanner, setSelectedScanner] = useState<string>('');
  const dwtRef = useRef<WebTwain | null>(null);
  const containerRef = useRef<string>('dwtcontrolContainer');

  // Initialize Dynamsoft Web TWAIN
  useEffect(() => {
    if (!licenseKey) {
      setIsLoading(false);
      setError('License key not configured');
      return;
    }

    const initDWT = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Configure Dynamsoft
        Dynamsoft.DWT.ProductKey = licenseKey;
        // Use CDN for resources (no local copy needed)
        Dynamsoft.DWT.ResourcesPath = 'https://unpkg.com/dwt@latest/dist';
        Dynamsoft.DWT.AutoLoad = false;

        // Create container if not exists
        let container = document.getElementById(containerRef.current);
        if (!container) {
          container = document.createElement('div');
          container.id = containerRef.current;
          container.style.display = 'none';
          document.body.appendChild(container);
        }

        // Load DWT
        Dynamsoft.DWT.CreateDWTObjectEx(
          { WebTwainId: 'dwtObject' },
          (dwt: WebTwain) => {
            dwtRef.current = dwt;
            setIsReady(true);
            setIsLoading(false);
            refreshScannerList();
          },
          (error: { code: number; message: string }) => {
            console.error('DWT init error:', error.message);
            setError(error.message);
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('DWT setup error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize scanner SDK');
        setIsLoading(false);
      }
    };

    initDWT();

    return () => {
      if (dwtRef.current) {
        try {
          Dynamsoft.DWT.DeleteDWTObject('dwtObject');
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      }
    };
  }, [licenseKey]);

  const refreshScannerList = useCallback(() => {
    if (!dwtRef.current) return;

    try {
      const count = dwtRef.current.SourceCount;
      const detected: ScannerInfo[] = [];

      for (let i = 0; i < count; i++) {
        const name = dwtRef.current.GetSourceNameItems(i);
        detected.push({
          id: `twain-${i}`,
          name: name || `Scanner ${i + 1}`,
          index: i
        });
      }

      setScanners(detected);
      
      if (detected.length > 0 && !selectedScanner) {
        setSelectedScanner(detected[0].id);
      }
    } catch (err) {
      console.error('Error getting scanners:', err);
    }
  }, [selectedScanner]);

  const scan = useCallback(async (): Promise<Blob[]> => {
    if (!dwtRef.current || !isReady) {
      throw new Error('Scanner not ready');
    }

    const scanner = scanners.find(s => s.id === selectedScanner);
    if (!scanner) {
      throw new Error('No scanner selected');
    }

    return new Promise((resolve, reject) => {
      const dwt = dwtRef.current!;

      // Select the scanner source
      dwt.SelectSourceByIndex(scanner.index);

      // Open source
      dwt.OpenSource();

      // Configure scan settings
      dwt.IfDisableSourceAfterAcquire = true;
      dwt.IfShowUI = false;

      // Acquire image using the simpler callback signature
      dwt.AcquireImage(
        {
          IfCloseSourceAfterAcquire: true,
          PixelType: Dynamsoft.DWT.EnumDWT_PixelType.TWPT_RGB,
          Resolution: 300,
          IfFeederEnabled: false,
          IfDuplexEnabled: false,
        },
        async () => {
          // Success - convert images to blobs
          const blobs: Blob[] = [];
          const imageCount = dwt.HowManyImagesInBuffer;

          for (let i = 0; i < imageCount; i++) {
            try {
              const blob = await new Promise<Blob>((res, rej) => {
                dwt.ConvertToBlob(
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

          // Clear buffer
          dwt.RemoveAllImages();

          resolve(blobs);
        },
        (_deviceConfig: unknown, errorCode: number, errorString: string) => {
          dwt.CloseSource();
          reject(new Error(`${errorCode}: ${errorString}`));
        }
      );
    });
  }, [isReady, scanners, selectedScanner]);

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
