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
        // Use CDN for resources
        Dynamsoft.DWT.ResourcesPath = 'https://unpkg.com/dwt@latest/dist';
        Dynamsoft.DWT.AutoLoad = false;
        
        // CRITICAL: Configure SSL for HTTPS pages
        // The service listens on port 18623 for SSL connections
        const isHttps = window.location.protocol === 'https:';
        if (isHttps) {
          console.log('HTTPS detected - configuring SSL connection to Dynamsoft Service');
          // @ts-ignore - IfSSL exists but may not be in types
          Dynamsoft.DWT.IfSSL = true;
          // @ts-ignore - ServiceInstallerLocation for SSL
          Dynamsoft.DWT.ServiceInstallerLocation = 'https://unpkg.com/dwt@latest/dist';
        }

        // Create container if not exists
        let container = document.getElementById(containerRef.current);
        if (!container) {
          container = document.createElement('div');
          container.id = containerRef.current;
          container.style.display = 'none';
          document.body.appendChild(container);
        }

        console.log('Initializing Dynamsoft Web TWAIN...');
        
        // Load DWT - the SDK handles service connection internally
        Dynamsoft.DWT.CreateDWTObjectEx(
          { WebTwainId: 'dwtObject' },
          (dwt: WebTwain) => {
            dwtRef.current = dwt;
            setIsReady(true);
            setIsLoading(false);
            
            // Wrap SourceCount access in try-catch - can throw JSON parse errors
            try {
              const sourceCount = dwt.SourceCount;
              console.log('Dynamsoft initialized. SourceCount:', sourceCount);
              
              // List all detected scanners
              for (let i = 0; i < sourceCount; i++) {
                console.log(`Scanner ${i}:`, dwt.GetSourceNameItems(i));
              }
              
              if (sourceCount === 0) {
                console.log('No TWAIN scanners found. Ensure scanner has TWAIN driver installed.');
              }
            } catch (sourceErr) {
              console.error('Error accessing scanner sources:', sourceErr);
              // SDK initialized but service communication may be unstable
              console.log('Dynamsoft SDK ready but scanner enumeration failed. Try refreshing.');
            }
            
            refreshScannerList();
          },
          (error: { code: number; message: string }) => {
            console.error('DWT error:', error.code, error.message);
            if (error.message.includes('service') || error.code === -2300) {
              setError('Dynamsoft Service not responding. Restart the service and refresh.');
            } else if (error.code === -2319) {
              setError('License expired or invalid.');
            } else {
              setError(`Error (${error.code}): ${error.message}`);
            }
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
    if (!dwtRef.current) {
      console.log('DWT not initialized, cannot refresh scanner list');
      return;
    }

    try {
      // SourceCount can throw JSON parse errors if service communication fails
      let count = 0;
      try {
        count = dwtRef.current.SourceCount;
      } catch (countErr) {
        console.error('Error getting SourceCount:', countErr);
        setError('Scanner service communication error. Please restart Dynamsoft Service and refresh the page.');
        return;
      }
      
      console.log('SourceCount:', count);
      const detected: ScannerInfo[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const name = dwtRef.current.GetSourceNameItems(i);
          console.log(`Found scanner ${i}:`, name);
          detected.push({
            id: `twain-${i}`,
            name: name || `Scanner ${i + 1}`,
            index: i
          });
        } catch (nameErr) {
          console.error(`Error getting scanner name for index ${i}:`, nameErr);
        }
      }

      setScanners(detected);
      
      if (detected.length > 0 && !selectedScanner) {
        setSelectedScanner(detected[0].id);
      }
      
      if (detected.length === 0) {
        console.log('No TWAIN scanners detected. Check: 1) Scanner connected, 2) PaperStream TWAIN driver installed, 3) Restart Dynamsoft Service');
      }
    } catch (err) {
      console.error('Error refreshing scanner list:', err);
      setError('Failed to enumerate scanners. Try restarting Dynamsoft Service.');
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
