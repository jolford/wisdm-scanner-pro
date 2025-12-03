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
  const initAttempted = useRef(false);

  const refreshScannerList = useCallback(() => {
    if (!dwtRef.current) {
      console.log('DWT not initialized');
      return;
    }

    try {
      // Use async method to get sources - more reliable than SourceCount
      dwtRef.current.GetSourceNamesAsync(false).then((sources: string[]) => {
        console.log('GetSourceNamesAsync result:', sources);
        const detected: ScannerInfo[] = sources.map((name, index) => ({
          id: `twain-${index}`,
          name: name || `Scanner ${index + 1}`,
          index
        }));
        
        setScanners(detected);
        
        if (detected.length > 0 && !selectedScanner) {
          setSelectedScanner(detected[0].id);
        }
        
        if (detected.length === 0) {
          console.log('No TWAIN scanners found via async method');
        }
      }).catch((err: Error) => {
        console.error('GetSourceNamesAsync error:', err);
        // Fallback to sync method with error handling
        try {
          const count = dwtRef.current?.SourceCount || 0;
          console.log('Fallback SourceCount:', count);
          const detected: ScannerInfo[] = [];
          for (let i = 0; i < count; i++) {
            const name = dwtRef.current?.GetSourceNameItems(i);
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
        } catch (syncErr) {
          console.error('Sync scanner enumeration also failed:', syncErr);
          setError('Cannot communicate with scanner service. Try: 1) Restart Dynamsoft Service, 2) Check if antivirus is blocking localhost connections, 3) Refresh page');
        }
      });
    } catch (err) {
      console.error('Error in refreshScannerList:', err);
    }
  }, [selectedScanner]);

  // Initialize Dynamsoft Web TWAIN
  useEffect(() => {
    if (!licenseKey || initAttempted.current) {
      if (!licenseKey) {
        setIsLoading(false);
        setError('License key not configured');
      }
      return;
    }
    
    initAttempted.current = true;

    const initDWT = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Configure Dynamsoft before loading
        Dynamsoft.DWT.ProductKey = licenseKey;
        Dynamsoft.DWT.ResourcesPath = 'https://unpkg.com/dwt@latest/dist';
        Dynamsoft.DWT.AutoLoad = false;
        
        // Register error event for better debugging
        Dynamsoft.DWT.RegisterEvent('OnWebTwainError', (error: { message: string }) => {
          console.error('OnWebTwainError:', error);
        });

        // Create hidden container
        let container = document.getElementById('dwtcontrolContainer');
        if (!container) {
          container = document.createElement('div');
          container.id = 'dwtcontrolContainer';
          container.style.display = 'none';
          document.body.appendChild(container);
        }

        console.log('Initializing Dynamsoft Web TWAIN...');
        console.log('Protocol:', window.location.protocol);
        console.log('License (first 20 chars):', licenseKey.substring(0, 20));

        // Use CreateDWTObjectEx with proper config
        Dynamsoft.DWT.CreateDWTObjectEx(
          {
            WebTwainId: 'dwtObject',
            // UseLocalService defaults to true for desktop scanning
          },
          (dwt: WebTwain) => {
            console.log('DWT object created successfully');
            dwtRef.current = dwt;
            setIsReady(true);
            setIsLoading(false);
            
            // Give the service a moment to enumerate sources
            setTimeout(() => {
              refreshScannerList();
            }, 500);
          },
          (error: { code: number; message: string }) => {
            console.error('DWT creation failed:', error.code, error.message);
            
            let errorMsg = `Scanner SDK Error (${error.code}): ${error.message}`;
            
            if (error.code === -2300 || error.message.toLowerCase().includes('service')) {
              errorMsg = 'Dynamsoft Service not responding. Please:\n1. Restart Dynamsoft Service from System Tray\n2. If issue persists, reinstall from dynamsoft.com/web-twain/downloads';
            } else if (error.code === -2319) {
              errorMsg = 'License expired or invalid';
            }
            
            setError(errorMsg);
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('DWT init exception:', err);
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
  }, [licenseKey, refreshScannerList]);

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

      // Use async select method for better reliability
      dwt.SelectSourceByIndex(scanner.index);
      dwt.OpenSource();
      dwt.IfDisableSourceAfterAcquire = true;
      dwt.IfShowUI = false;

      dwt.AcquireImage(
        {
          IfCloseSourceAfterAcquire: true,
          PixelType: Dynamsoft.DWT.EnumDWT_PixelType.TWPT_RGB,
          Resolution: 300,
          IfFeederEnabled: false,
          IfDuplexEnabled: false,
        },
        async () => {
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

          dwt.RemoveAllImages();
          resolve(blobs);
        },
        (_deviceConfig: unknown, errorCode: number, errorString: string) => {
          dwt.CloseSource();
          reject(new Error(`Scan failed (${errorCode}): ${errorString}`));
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
