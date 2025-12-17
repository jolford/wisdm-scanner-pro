import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type FilterValue = string | string[] | boolean | number | null | undefined;

interface UseFiltersOptions<T extends Record<string, FilterValue>> {
  defaultFilters?: Partial<T>;
  syncWithUrl?: boolean;
  urlPrefix?: string;
}

interface UseFiltersReturn<T extends Record<string, FilterValue>> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (newFilters: Partial<T>) => void;
  clearFilter: (key: keyof T) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  getFilterAsArray: (key: keyof T) => string[];
  toggleArrayFilter: (key: keyof T, value: string) => void;
}

export function useFilters<T extends Record<string, FilterValue>>(
  options: UseFiltersOptions<T> = {}
): UseFiltersReturn<T> {
  const { defaultFilters = {} as Partial<T>, syncWithUrl = false, urlPrefix = '' } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL or defaults
  const getInitialFilters = useCallback((): T => {
    if (!syncWithUrl) {
      return defaultFilters as T;
    }

    const urlFilters: Record<string, FilterValue> = {};
    searchParams.forEach((value, key) => {
      if (urlPrefix && !key.startsWith(urlPrefix)) return;
      const filterKey = urlPrefix ? key.replace(urlPrefix, '') : key;
      
      // Try to parse arrays (comma-separated)
      if (value.includes(',')) {
        urlFilters[filterKey] = value.split(',');
      }
      // Try to parse booleans
      else if (value === 'true' || value === 'false') {
        urlFilters[filterKey] = value === 'true';
      }
      // Try to parse numbers
      else if (!isNaN(Number(value)) && value !== '') {
        urlFilters[filterKey] = Number(value);
      }
      else {
        urlFilters[filterKey] = value;
      }
    });

    return { ...defaultFilters, ...urlFilters } as T;
  }, [searchParams, syncWithUrl, urlPrefix, defaultFilters]);

  const [filters, setFiltersState] = useState<T>(getInitialFilters);

  // Sync to URL when filters change
  const updateUrl = useCallback((newFilters: T) => {
    if (!syncWithUrl) return;

    const newParams = new URLSearchParams(searchParams);
    
    // Remove all filter params first
    Array.from(newParams.keys()).forEach(key => {
      if (!urlPrefix || key.startsWith(urlPrefix)) {
        newParams.delete(key);
      }
    });

    // Add new filter params
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        return;
      }

      const paramKey = urlPrefix ? `${urlPrefix}${key}` : key;
      if (Array.isArray(value)) {
        newParams.set(paramKey, value.join(','));
      } else {
        newParams.set(paramKey, String(value));
      }
    });

    setSearchParams(newParams, { replace: true });
  }, [syncWithUrl, urlPrefix, searchParams, setSearchParams]);

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState(prev => {
      const newFilters = { ...prev, [key]: value };
      updateUrl(newFilters);
      return newFilters;
    });
  }, [updateUrl]);

  const setFilters = useCallback((newFilters: Partial<T>) => {
    setFiltersState(prev => {
      const merged = { ...prev, ...newFilters };
      updateUrl(merged);
      return merged;
    });
  }, [updateUrl]);

  const clearFilter = useCallback((key: keyof T) => {
    setFiltersState(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      if (key in defaultFilters) {
        newFilters[key] = defaultFilters[key] as T[keyof T];
      }
      updateUrl(newFilters);
      return newFilters;
    });
  }, [defaultFilters, updateUrl]);

  const clearAllFilters = useCallback(() => {
    const cleared = defaultFilters as T;
    setFiltersState(cleared);
    updateUrl(cleared);
  }, [defaultFilters, updateUrl]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const defaultValue = defaultFilters[key as keyof T];
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return value !== defaultValue;
    });
  }, [filters, defaultFilters]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      const defaultValue = defaultFilters[key as keyof T];
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return value !== defaultValue;
    }).length;
  }, [filters, defaultFilters]);

  const getFilterAsArray = useCallback((key: keyof T): string[] => {
    const value = filters[key];
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return [String(value)];
  }, [filters]);

  const toggleArrayFilter = useCallback((key: keyof T, value: string) => {
    setFiltersState(prev => {
      const current = prev[key];
      let newArray: string[];
      
      if (Array.isArray(current)) {
        if (current.includes(value)) {
          newArray = current.filter(v => v !== value);
        } else {
          newArray = [...current, value];
        }
      } else {
        newArray = [value];
      }
      
      const newFilters = { ...prev, [key]: newArray as T[keyof T] };
      updateUrl(newFilters);
      return newFilters;
    });
  }, [updateUrl]);

  return {
    filters,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    getFilterAsArray,
    toggleArrayFilter,
  };
}
