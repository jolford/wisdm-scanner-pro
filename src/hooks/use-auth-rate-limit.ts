import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retry_after_seconds?: number;
  remaining?: number;
  lockout_count?: number;
}

export function useAuthRateLimit() {
  const [isBlocked, setIsBlocked] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const getClientIP = useCallback(async (): Promise<string> => {
    // Use a simple approach - in production, you'd want to get this from headers
    // For now, we'll use a hash of user agent + timestamp as a fallback identifier
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      // Fallback to a browser fingerprint-like identifier
      return `browser-${navigator.userAgent.slice(0, 50)}`;
    }
  }, []);

  const checkRateLimit = useCallback(async (endpoint: string, email?: string): Promise<RateLimitResult> => {
    try {
      const ip = await getClientIP();
      
      const { data, error } = await supabase.functions.invoke('check-auth-rate-limit', {
        body: { ip_address: ip, endpoint, email },
      });

      if (error) {
        console.error('Rate limit check error:', error);
        // Fail open - allow the request if check fails
        return { allowed: true };
      }

      const result = data as RateLimitResult;

      if (!result.allowed) {
        setIsBlocked(true);
        setRetryAfter(result.retry_after_seconds || 300);
      } else {
        setIsBlocked(false);
        setRetryAfter(null);
        setRemainingAttempts(result.remaining || null);
      }

      return result;
    } catch (err) {
      console.error('Rate limit check failed:', err);
      // Fail open
      return { allowed: true };
    }
  }, [getClientIP]);

  const resetRateLimit = useCallback(async (endpoint: string): Promise<void> => {
    try {
      const ip = await getClientIP();
      
      await supabase.functions.invoke('reset-auth-rate-limit', {
        body: { ip_address: ip, endpoint },
      });

      setIsBlocked(false);
      setRetryAfter(null);
      setRemainingAttempts(null);
    } catch (err) {
      console.error('Rate limit reset failed:', err);
    }
  }, [getClientIP]);

  const formatRetryTime = useCallback((seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }, []);

  return {
    isBlocked,
    retryAfter,
    remainingAttempts,
    checkRateLimit,
    resetRateLimit,
    formatRetryTime,
  };
}
