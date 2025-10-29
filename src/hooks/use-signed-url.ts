import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to get a signed URL for a storage file
 * @param publicUrl - The public URL or storage path
 * @param expiresIn - Expiry time in seconds (default: 3600 = 1 hour)
 * @returns The signed URL or null if loading/error
 */
export const useSignedUrl = (publicUrl: string | null | undefined, expiresIn: number = 3600) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!publicUrl) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    const getSignedUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        // Normalize to pathname to avoid query/fragment issues
        let filePath: string | null = null;
        try {
          const u = new URL(publicUrl);
          const path = u.pathname; // no query/fragment
          const m = path.match(/\/documents\/(.+)$/);
          filePath = m ? decodeURIComponent(m[1]) : null;
        } catch {
          // Not a standard URL (could be data:, blob:). Try regex fallback
          const m = publicUrl.match(/\/documents\/(.+?)(?:\?|#|$)/);
          filePath = m ? decodeURIComponent(m[1]) : null;
        }
        
        if (!filePath) {
          setSignedUrl(publicUrl);
          setLoading(false);
          return;
        }

        // If it's already a signed URL from storage, just use it
        if (/\/storage\/v1\/object\/sign\//.test(publicUrl)) {
          setSignedUrl(publicUrl);
          setLoading(false);
          return;
        }

        // Always generate a signed URL (works for public and private buckets)
        const { data, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, expiresIn);

        if (urlError || !data?.signedUrl) {
          console.warn('Falling back to original URL due to signing error', urlError);
          setSignedUrl(publicUrl);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error in useSignedUrl:', err);
        setError(err as Error);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    getSignedUrl();
  }, [publicUrl, expiresIn]);

  return { signedUrl, loading, error };
};

/**
 * Utility function to get a signed URL synchronously (use in event handlers)
 * @param publicUrl - The public URL or storage path
 * @param expiresIn - Expiry time in seconds (default: 3600 = 1 hour)
 * @returns Promise with the signed URL
 */
export const getSignedUrl = async (
  publicUrl: string,
  expiresIn: number = 3600
): Promise<string> => {
  if (!publicUrl) {
    throw new Error('No URL provided');
  }

  // Always try to sign, even if the URL looks public
  // Some environments mark buckets public but still require signed URLs
  // Proceed to extract storage path and create a signed URL

  // Extract the storage path from the URL safely (ignore query/fragment)
  let filePath: string | null = null;
  try {
    const u = new URL(publicUrl);
    const m = u.pathname.match(/\/documents\/(.+)$/);
    filePath = m ? decodeURIComponent(m[1]) : null;
  } catch {
    const m = publicUrl.match(/\/documents\/(.+?)(?:\?|#|$)/);
    filePath = m ? decodeURIComponent(m[1]) : null;
  }
  
  if (!filePath) {
    return publicUrl;
  }

  // Generate signed URL
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn);

  if (error || !data?.signedUrl) {
    return publicUrl;
  }

  return data.signedUrl;
};
