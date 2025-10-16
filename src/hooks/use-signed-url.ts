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

        // If this is already a public storage URL, no need to sign
        // Example: https://.../storage/v1/object/public/documents/path/to/file.ext
        const isPublic = /\/storage\/v1\/object\/public\//.test(publicUrl);
        if (isPublic) {
          setSignedUrl(publicUrl);
          setLoading(false);
          return;
        }

        // Extract the storage path from the public URL
        // Accepts both public and non-public object URLs
        const pathMatch = publicUrl.match(/\/documents\/(.+)$/);
        
        if (!pathMatch) {
          // If it's not a valid storage URL, return the original URL
          setSignedUrl(publicUrl);
          setLoading(false);
          return;
        }

        const filePath = pathMatch[1];

        // Generate signed URL for private buckets
        const { data, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, expiresIn);

        if (urlError) {
          console.error('Error creating signed URL:', urlError);
          setError(urlError);
          setSignedUrl(null);
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

  // If already public storage URL, just return as-is
  if (/\/storage\/v1\/object\/public\//.test(publicUrl)) {
    return publicUrl;
  }

  // Extract the storage path from the URL
  const pathMatch = publicUrl.match(/\/documents\/(.+)$/);
  
  if (!pathMatch) {
    // If it's not a valid storage URL, return the original URL
    return publicUrl;
  }

  const filePath = pathMatch[1];

  // Generate signed URL
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }

  return data.signedUrl;
};
