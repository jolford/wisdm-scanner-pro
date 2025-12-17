import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized React Query configuration with optimized caching strategies
 */

// Stale times for different data types
export const STALE_TIMES = {
  // Static data that rarely changes
  STATIC: 1000 * 60 * 60, // 1 hour
  
  // Reference data (projects, customers, templates)
  REFERENCE: 1000 * 60 * 10, // 10 minutes
  
  // List data (batches, documents)
  LIST: 1000 * 60 * 2, // 2 minutes
  
  // Real-time data (job status, processing)
  REALTIME: 1000 * 30, // 30 seconds
  
  // User-specific data
  USER: 1000 * 60 * 5, // 5 minutes
  
  // Command palette / search data
  SEARCH: 1000 * 60, // 1 minute
} as const;

// Cache times (how long to keep data after it becomes unused)
export const CACHE_TIMES = {
  SHORT: 1000 * 60 * 5, // 5 minutes
  MEDIUM: 1000 * 60 * 30, // 30 minutes
  LONG: 1000 * 60 * 60, // 1 hour
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  // Default retry for most queries
  DEFAULT: 3,
  // No retry for user-initiated actions
  MUTATIONS: 0,
  // More retries for critical data
  CRITICAL: 5,
} as const;

/**
 * Creates a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - data is fresh for 2 minutes
        staleTime: STALE_TIMES.LIST,
        
        // Keep unused data in cache for 30 minutes
        gcTime: CACHE_TIMES.MEDIUM,
        
        // Retry failed requests 3 times
        retry: RETRY_CONFIG.DEFAULT,
        
        // Exponential backoff for retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Don't refetch on window focus by default (can be overridden)
        refetchOnWindowFocus: false,
        
        // Keep previous data while fetching new data
        placeholderData: (previousData: unknown) => previousData,
      },
      mutations: {
        // Don't retry mutations by default
        retry: RETRY_CONFIG.MUTATIONS,
      },
    },
  });
}

/**
 * Query key factories for consistent key generation
 */
export const queryKeys = {
  // Projects
  projects: {
    all: ['projects'] as const,
    list: (filters?: Record<string, unknown>) => ['projects', 'list', filters] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  
  // Batches
  batches: {
    all: ['batches'] as const,
    list: (filters?: Record<string, unknown>) => ['batches', 'list', filters] as const,
    detail: (id: string) => ['batches', 'detail', id] as const,
    documents: (batchId: string) => ['batches', batchId, 'documents'] as const,
  },
  
  // Documents
  documents: {
    all: ['documents'] as const,
    list: (filters?: Record<string, unknown>) => ['documents', 'list', filters] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
    signedUrl: (id: string) => ['documents', 'signedUrl', id] as const,
  },
  
  // Customers
  customers: {
    all: ['customers'] as const,
    list: () => ['customers', 'list'] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    current: ['users', 'current'] as const,
    preferences: ['users', 'preferences'] as const,
    permissions: (userId: string) => ['users', userId, 'permissions'] as const,
  },
  
  // Jobs
  jobs: {
    all: ['jobs'] as const,
    queue: ['jobs', 'queue'] as const,
    status: (id: string) => ['jobs', 'status', id] as const,
  },
  
  // Analytics
  analytics: {
    dashboard: ['analytics', 'dashboard'] as const,
    metrics: (period: string) => ['analytics', 'metrics', period] as const,
  },
  
  // Command palette / search
  search: {
    batches: ['search', 'batches'] as const,
    projects: ['search', 'projects'] as const,
    documents: (query: string) => ['search', 'documents', query] as const,
  },
} as const;

/**
 * Helper to invalidate related queries after mutations
 */
export function getInvalidationKeys(type: keyof typeof queryKeys): readonly (readonly string[])[] {
  switch (type) {
    case 'projects':
      return [queryKeys.projects.all, queryKeys.search.projects] as const;
    case 'batches':
      return [queryKeys.batches.all, queryKeys.search.batches] as const;
    case 'documents':
      return [queryKeys.documents.all, queryKeys.batches.all] as const;
    case 'customers':
      return [queryKeys.customers.all] as const;
    case 'users':
      return [queryKeys.users.all] as const;
    default:
      return [] as const;
  }
}
