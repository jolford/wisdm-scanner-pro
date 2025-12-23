/**
 * Retry helper with exponential backoff for external API calls
 * 
 * Provides resilient API calling with:
 * - Configurable retry attempts
 * - Exponential backoff with jitter
 * - Timeout handling
 * - Error classification
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryOn?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 30000,
  retryOn: (error: Error) => {
    // Retry on network errors and 5xx status codes
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('fetch failed') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('429') // Rate limited
    );
  },
  onRetry: () => {},
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Execute an async function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      const result = await withTimeout(fn(), opts.timeoutMs);
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isLastAttempt = attempt > opts.maxRetries;
      const shouldRetry = !isLastAttempt && opts.retryOn(lastError, attempt);

      if (!shouldRetry) {
        break;
      }

      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      opts.onRetry(lastError, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Fetch with retry - convenience wrapper for HTTP requests
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<RetryResult<Response>> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      
      // Throw on error status codes so retry logic kicks in
      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      
      return response;
    },
    retryOptions
  );
}

/**
 * Graceful degradation helper - returns fallback on failure
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  options: RetryOptions = {}
): Promise<{ data: T; usedFallback: boolean; error?: Error }> {
  const result = await withRetry(fn, options);
  
  if (result.success && result.data !== undefined) {
    return { data: result.data, usedFallback: false };
  }
  
  return { data: fallback, usedFallback: true, error: result.error };
}

/**
 * Circuit breaker state
 */
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitStates = new Map<string, CircuitState>();

/**
 * Circuit breaker pattern for graceful degradation
 */
export function createCircuitBreaker(
  name: string,
  options: {
    failureThreshold?: number;
    resetTimeMs?: number;
  } = {}
) {
  const { failureThreshold = 5, resetTimeMs = 60000 } = options;

  return {
    async execute<T>(fn: () => Promise<T>, fallback?: T): Promise<T> {
      const state = circuitStates.get(name) || {
        failures: 0,
        lastFailure: 0,
        isOpen: false,
      };

      // Check if circuit should be reset
      if (state.isOpen && Date.now() - state.lastFailure > resetTimeMs) {
        state.isOpen = false;
        state.failures = 0;
      }

      // If circuit is open, return fallback immediately
      if (state.isOpen) {
        if (fallback !== undefined) {
          return fallback;
        }
        throw new Error(`Circuit breaker '${name}' is open - service unavailable`);
      }

      try {
        const result = await fn();
        // Success - reset failure count
        state.failures = 0;
        circuitStates.set(name, state);
        return result;
      } catch (error) {
        // Record failure
        state.failures++;
        state.lastFailure = Date.now();
        
        if (state.failures >= failureThreshold) {
          state.isOpen = true;
          console.warn(`Circuit breaker '${name}' opened after ${state.failures} failures`);
        }
        
        circuitStates.set(name, state);
        
        if (fallback !== undefined) {
          return fallback;
        }
        throw error;
      }
    },

    getState(): CircuitState {
      return circuitStates.get(name) || { failures: 0, lastFailure: 0, isOpen: false };
    },

    reset(): void {
      circuitStates.delete(name);
    },
  };
}
