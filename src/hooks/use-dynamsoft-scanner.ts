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
  needsCertificateTrust: boolean;
  trustCertificate: () => void;
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
  const [needsCertificateTrust, setNeedsCertificateTrust] = useState(false);
  const mountedRef = useRef(true);
  const scannersLoadedRef = useRef(false);

  // Function to open Dynamsoft Service certificate page
  const trustCertificate = useCallback(() => {
    window.open('https://127.0.0.1:18623', '_blank');
    // After user trusts, they should refresh the page
  }, []);

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
    // Use HTTP for localhost - Chrome allows mixed content for 127.0.0.1
    // This bypasses the SSL certificate trust issues
    // @ts-ignore - IfSSL exists but not in types
    Dynamsoft.DWT.IfSSL = false;
    // @ts-ignore
    Dynamsoft.DWT.ServiceInstallerLocation = 'https://unpkg.com/dwt@latest/dist';

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
          let blob: Blob | null = null;
          
          // Method 1: Use GetImageBitmap + Canvas (avoids service fetch issues)
          try {
            const imageBitmap = await new Promise<ImageBitmap>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
              // @ts-ignore - GetImageBitmap exists in newer DWT versions
              globalDwt!.GetImageBitmap(
                [i],
                Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
                (result: ImageBitmap) => {
                  clearTimeout(timeout);
                  resolve(result);
                },
                (errorCode: number, errorString: string) => {
                  clearTimeout(timeout);
                  reject(new Error(`${errorCode}: ${errorString}`));
                }
              );
            });
            
            // Convert ImageBitmap to Blob via canvas
            const canvas = document.createElement('canvas');
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(imageBitmap, 0, 0);
              blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error('Canvas toBlob failed'));
                }, 'image/png');
              });
              console.log(`Method 1 (GetImageBitmap) succeeded for image ${i + 1}, size: ${blob.size}`);
            }
            imageBitmap.close();
          } catch (e1) {
            console.log('GetImageBitmap failed:', e1);
          }

          // Method 2: Use ConvertToBlob (fallback)
          if (!blob) {
            try {
              blob = await new Promise<Blob>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                globalDwt!.ConvertToBlob(
                  [i],
                  Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
                  (result: Blob) => {
                    clearTimeout(timeout);
                    resolve(result);
                  },
                  (errorCode: number, errorString: string) => {
                    clearTimeout(timeout);
                    reject(new Error(`${errorCode}: ${errorString}`));
                  }
                );
              });
              if (blob && blob.size > 0) {
                console.log(`Method 2 (ConvertToBlob) succeeded for image ${i + 1}, size: ${blob.size}`);
              }
            } catch (e2) {
              console.log('ConvertToBlob failed:', e2);
            }
          }

          // Method 3: ConvertToBase64 (last resort)
          if (!blob) {
            try {
              const base64Result = await new Promise<string>((res, rej) => {
                const timeout = setTimeout(() => rej(new Error('Timeout')), 10000);
                globalDwt!.ConvertToBase64(
                  [i],
                  Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
                  (result: { getData: (index: number, count: number) => string; getLength: () => number }) => {
                    clearTimeout(timeout);
                    res(result.getData(0, result.getLength()));
                  },
                  (errorCode: number, errorString: string) => {
                    clearTimeout(timeout);
                    rej(new Error(`${errorCode}: ${errorString}`));
                  }
                );
              });
              
              const byteChars = atob(base64Result);
              const byteNums = new Array(byteChars.length);
              for (let j = 0; j < byteChars.length; j++) {
                byteNums[j] = byteChars.charCodeAt(j);
              }
              blob = new Blob([new Uint8Array(byteNums)], { type: 'image/png' });
              console.log(`Method 3 (ConvertToBase64) succeeded for image ${i + 1}`);
            } catch (e3) {
              console.log('ConvertToBase64 failed:', e3);
            }
          }
          
          if (blob && blob.size > 0) {
            blobs.push(blob);
          } else {
            console.error(`Failed to convert image ${i + 1} - all methods failed`);
            if (i === 0) {
              setNeedsCertificateTrust(true);
            }
          }
        } catch (e) {
          console.error('Error converting image:', e);
        }
      }
      
      // If we have images in buffer but couldn't extract any, certificate issue
      if (imageCount > 0 && blobs.length === 0) {
        setNeedsCertificateTrust(true);
        throw new Error('CERTIFICATE_TRUST_REQUIRED');
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
    refreshScanners: refreshScannerList,
    needsCertificateTrust,
    trustCertificate
  };
};
