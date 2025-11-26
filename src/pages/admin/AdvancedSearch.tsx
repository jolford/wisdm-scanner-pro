import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdvancedSearchBar, SearchOptions } from '@/components/AdvancedSearchBar';
import { useAdvancedSearch } from '@/hooks/use-advanced-search';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Calendar, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ProjectSelector } from '@/components/ProjectSelector';

export default function AdvancedSearch() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    useFullTextSearch: true,
    searchFields: {
      extractedText: true,
      fieldValues: true,
      fileNames: true,
      validationNotes: false,
    },
  });
  const [filters, setFilters] = useState({});

  const { data: results, isLoading } = useAdvancedSearch(
    selectedProjectId || null,
    searchQuery,
    searchOptions
  );

  return (
    <AdminLayout
      title="Advanced Search"
      description="Search across all documents with powerful full-text search"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <ProjectSelector 
            onProjectSelect={(projectId) => setSelectedProjectId(projectId)}
            selectedProjectId={selectedProjectId}
          />
        </div>

        <AdvancedSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchOptions={searchOptions}
          onSearchOptionsChange={setSearchOptions}
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={() => setFilters({})}
        />

        {searchQuery && (
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              'Searching...'
            ) : (
              `Found ${results?.length || 0} document${results?.length !== 1 ? 's' : ''}`
            )}
          </div>
        )}

        {results && results.length > 0 && (
          <div className="grid gap-4">
            {results.map((doc: any) => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{doc.file_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Batch: {doc.batches?.batch_name}
                          </p>
                        </div>
                        <Badge variant={doc.validation_status === 'validated' ? 'default' : 'secondary'}>
                          {doc.validation_status}
                        </Badge>
                      </div>

                      {doc.extracted_metadata && Object.keys(doc.extracted_metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {Object.entries(doc.extracted_metadata).slice(0, 3).map(([key, value]) => (
                            <span key={key} className="bg-muted px-2 py-1 rounded">
                              <strong>{key}:</strong> {String(value)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                        </span>
                        {doc.confidence_score && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {Math.round(doc.confidence_score * 100)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {searchQuery && !isLoading && (!results || results.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No documents found matching your search.</p>
            <p className="text-sm mt-2">Try adjusting your search terms or filters.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
