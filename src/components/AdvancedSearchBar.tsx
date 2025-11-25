import { useState } from 'react';
import { Search, X, Sparkles, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SearchOptions {
  useFullTextSearch: boolean;
  searchFields: {
    extractedText: boolean;
    fieldValues: boolean;
    fileNames: boolean;
    validationNotes: boolean;
  };
}

interface AdvancedSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  filters?: {
    documentType?: string;
    confidenceFilter?: string;
    issuesFilter?: string;
  };
  onFiltersChange?: (filters: any) => void;
  onClearFilters?: () => void;
}

export const AdvancedSearchBar = ({
  searchQuery,
  onSearchChange,
  searchOptions,
  onSearchOptionsChange,
  filters = {},
  onFiltersChange,
  onClearFilters,
}: AdvancedSearchBarProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;
  const activeSearchFields = Object.values(searchOptions.searchFields).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={
              searchOptions.useFullTextSearch
                ? "Advanced semantic search across all documents..."
                : "Search documents..."
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => onSearchChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Advanced
              {searchOptions.useFullTextSearch && (
                <Badge variant="secondary" className="h-5 px-1.5">
                  {activeSearchFields}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Advanced Search Options</h4>
                <p className="text-sm text-muted-foreground">
                  Configure powerful full-text search capabilities
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="full-text-search" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Full-Text Search
                </Label>
                <Switch
                  id="full-text-search"
                  checked={searchOptions.useFullTextSearch}
                  onCheckedChange={(checked) =>
                    onSearchOptionsChange({ ...searchOptions, useFullTextSearch: checked })
                  }
                />
              </div>

              {searchOptions.useFullTextSearch && (
                <div className="space-y-3 pt-3 border-t">
                  <Label className="text-xs font-medium">Search across:</Label>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="search-extracted-text" className="text-sm font-normal">
                      Extracted Text (OCR)
                    </Label>
                    <Switch
                      id="search-extracted-text"
                      checked={searchOptions.searchFields.extractedText}
                      onCheckedChange={(checked) =>
                        onSearchOptionsChange({
                          ...searchOptions,
                          searchFields: { ...searchOptions.searchFields, extractedText: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="search-field-values" className="text-sm font-normal">
                      Field Values
                    </Label>
                    <Switch
                      id="search-field-values"
                      checked={searchOptions.searchFields.fieldValues}
                      onCheckedChange={(checked) =>
                        onSearchOptionsChange({
                          ...searchOptions,
                          searchFields: { ...searchOptions.searchFields, fieldValues: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="search-file-names" className="text-sm font-normal">
                      File Names
                    </Label>
                    <Switch
                      id="search-file-names"
                      checked={searchOptions.searchFields.fileNames}
                      onCheckedChange={(checked) =>
                        onSearchOptionsChange({
                          ...searchOptions,
                          searchFields: { ...searchOptions.searchFields, fileNames: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="search-validation-notes" className="text-sm font-normal">
                      Validation Notes
                    </Label>
                    <Switch
                      id="search-validation-notes"
                      checked={searchOptions.searchFields.validationNotes}
                      onCheckedChange={(checked) =>
                        onSearchOptionsChange({
                          ...searchOptions,
                          searchFields: { ...searchOptions.searchFields, validationNotes: checked },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {onFiltersChange && (
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filter Documents</h4>
                  {activeFilterCount > 0 && onClearFilters && (
                    <Button variant="ghost" size="sm" onClick={onClearFilters}>
                      Clear all
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Document Type</Label>
                    <Select
                      value={filters.documentType}
                      onValueChange={(value) =>
                        onFiltersChange({ ...filters, documentType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="receipt">Receipt</SelectItem>
                        <SelectItem value="po">Purchase Order</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Confidence Score</Label>
                    <Select
                      value={filters.confidenceFilter}
                      onValueChange={(value) =>
                        onFiltersChange({ ...filters, confidenceFilter: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any confidence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Confidence</SelectItem>
                        <SelectItem value="high">High (90%+)</SelectItem>
                        <SelectItem value="medium">Medium (70-90%)</SelectItem>
                        <SelectItem value="low">Low (&lt;70%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Issues</Label>
                    <Select
                      value={filters.issuesFilter}
                      onValueChange={(value) =>
                        onFiltersChange({ ...filters, issuesFilter: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All documents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Documents</SelectItem>
                        <SelectItem value="with_issues">With Issues</SelectItem>
                        <SelectItem value="needs_review">Needs Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
