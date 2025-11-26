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
  projectId: string | null | undefined,
  searchQuery: string,
  searchOptions: SearchOptions
) => {
  return useQuery({
    queryKey: ['advanced-search', projectId, searchQuery, searchOptions],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) {
        return [];
      }

      // Fetch documents - optionally filtered by project
      let query = supabase
        .from('documents')
        .select(`
          *,
          batches (
            id,
            batch_name,
            project_id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      // Only filter by project if projectId is provided
      if (projectId) {
        query = query.eq('batches.project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data) return [];

      // Client-side filtering for comprehensive search across all fields
      const searchTerm = searchQuery.toLowerCase();
      
      return data.filter(doc => {
        // Search file names
        if (searchOptions.searchFields.fileNames && 
            doc.file_name?.toLowerCase().includes(searchTerm)) {
          return true;
        }

        // Search extracted text
        if (searchOptions.searchFields.extractedText && 
            doc.extracted_text?.toLowerCase().includes(searchTerm)) {
          return true;
        }

        // Search validation notes
        if (searchOptions.searchFields.validationNotes && 
            doc.validation_notes?.toLowerCase().includes(searchTerm)) {
          return true;
        }

        // Search through extracted metadata (JSON field values)
        if (searchOptions.searchFields.fieldValues && doc.extracted_metadata) {
          const metadataStr = JSON.stringify(doc.extracted_metadata).toLowerCase();
          if (metadataStr.includes(searchTerm)) {
            return true;
          }
        }

        return false;
      }).slice(0, 100); // Limit to 100 results
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
  });
};
