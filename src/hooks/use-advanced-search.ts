import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SearchOptions {
  useFullTextSearch: boolean;
  searchFields: {
    extractedText: boolean;
    fieldValues: boolean;
    fileNames: boolean;
    validationNotes: boolean;
  };
}

export const useAdvancedSearch = (
  projectId: string,
  searchQuery: string,
  searchOptions: SearchOptions
) => {
  return useQuery({
    queryKey: ['advanced-search', projectId, searchQuery, searchOptions],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) {
        return [];
      }

      let query = supabase
        .from('documents')
        .select(`
          *,
          batches!inner (
            id,
            batch_name,
            project_id
          )
        `)
        .eq('batches.project_id', projectId);

      if (searchOptions.useFullTextSearch) {
        // Use PostgreSQL full-text search
        query = query.textSearch('search_vector', searchQuery, {
          type: 'websearch',
          config: 'english',
        });
      } else {
        // Fallback to basic ILIKE search
        const conditions = [];
        
        if (searchOptions.searchFields.fileNames) {
          conditions.push(`file_name.ilike.%${searchQuery}%`);
        }
        if (searchOptions.searchFields.extractedText) {
          conditions.push(`extracted_text.ilike.%${searchQuery}%`);
        }
        if (searchOptions.searchFields.validationNotes) {
          conditions.push(`validation_notes.ilike.%${searchQuery}%`);
        }

        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
  });
};
