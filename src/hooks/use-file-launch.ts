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
      window.launchQueue.setConsumer(async (launchParams: LaunchParams) => {
        if (!launchParams.files || launchParams.files.length === 0) {
          return;
        }

        const files: File[] = [];
        for (const fileHandle of launchParams.files) {
          const file = await fileHandle.getFile();
          files.push(file);
        }

        if (files.length > 0) {
          onFilesLaunched(files);
        }
      });
    }
  }, [onFilesLaunched]);
}
