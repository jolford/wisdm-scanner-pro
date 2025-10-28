import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface SearchFilterBarProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: DocumentFilters) => void;
  totalResults: number;
}

export interface DocumentFilters {
  documentType?: string;
  minConfidence?: number;
  dateRange?: { start: string; end: string };
  hasIssues?: boolean;
}

export const SearchFilterBar = ({ onSearch, onFilterChange, totalResults }: SearchFilterBarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const updateFilter = (key: keyof DocumentFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents, vendors, invoice numbers..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => handleSearch('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Document Type</Label>
                  <Select
                    value={filters.documentType}
                    onValueChange={(value) => updateFilter('documentType', value || undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="po">Purchase Order</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Minimum Confidence</Label>
                  <Select
                    value={filters.minConfidence?.toString()}
                    onValueChange={(value) => updateFilter('minConfidence', value ? parseInt(value) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any confidence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90% or higher</SelectItem>
                      <SelectItem value="80">80% or higher</SelectItem>
                      <SelectItem value="70">70% or higher</SelectItem>
                      <SelectItem value="50">50% or higher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.hasIssues || false}
                      onChange={(e) => updateFilter('hasIssues', e.target.checked || undefined)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Show only documents with issues</span>
                  </label>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {(searchQuery || activeFilterCount > 0) && (
        <div className="text-sm text-muted-foreground">
          Found {totalResults} document{totalResults !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};