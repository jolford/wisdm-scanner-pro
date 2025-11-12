import { useEffect } from 'react';

interface LaunchParams {
  files: FileSystemFileHandle[];
}

interface LaunchQueue {
  setConsumer: (callback: (params: LaunchParams) => void) => void;
}

declare global {
  interface Window {
    launchQueue?: LaunchQueue;
  }
}

export function useFileLaunch(onFilesLaunched: (files: File[]) => void) {
  useEffect(() => {
    if ('launchQueue' in window && window.launchQueue) {
      console.log('[PWA File Handlers] launchQueue available, registering consumer');
      window.launchQueue.setConsumer(async (launchParams: LaunchParams) => {
        try {
          if (!launchParams.files || launchParams.files.length === 0) {
            console.log('[PWA File Handlers] launch event received without files');
            return;
          }

          const files: File[] = [];
          for (const fileHandle of launchParams.files) {
            const file = await fileHandle.getFile();
            files.push(file);
          }

          console.log('[PWA File Handlers] received files', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
          if (files.length > 0) {
            onFilesLaunched(files);
          }
        } catch (e) {
          console.error('[PWA File Handlers] error consuming launch files', e);
        }
      });
    } else {
      console.warn('[PWA File Handlers] window.launchQueue not available in this browser/context');
    }
  }, [onFilesLaunched]);
}
