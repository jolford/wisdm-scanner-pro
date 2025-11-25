import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Save, Star, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface SavedFilter {
  id: string;
  name: string;
  filters: any;
}

interface SavedFiltersManagerProps {
  currentFilters: any;
  onApplyFilter: (filters: any) => void;
  filterType: string; // 'document', 'batch', 'user', etc.
}

export const SavedFiltersManager = ({
  currentFilters,
  onApplyFilter,
  filterType,
}: SavedFiltersManagerProps) => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const queryClient = useQueryClient();

  const { data: savedFilters } = useQuery({
    queryKey: ['saved-filters', filterType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('saved_filters')
        .single();

      if (error) throw error;
      
      const filters = data?.saved_filters?.[filterType] || [];
      return filters as SavedFilter[];
    },
  });

  const saveFilter = useMutation({
    mutationFn: async () => {
      const { data: currentPrefs } = await supabase
        .from('user_preferences')
        .select('saved_filters')
        .single();

      const existingSaved = ((currentPrefs?.saved_filters || {}) as unknown) as Record<string, SavedFilter[]>;
      const typeFilters = existingSaved[filterType] || [];

      const newFilter = {
        id: crypto.randomUUID(),
        name: filterName,
        filters: currentFilters,
      };

      const updated = {
        ...existingSaved,
        [filterType]: [...typeFilters, newFilter],
      } as any;

      const { error } = await supabase
        .from('user_preferences')
        .update({ saved_filters: updated })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
      toast.success('Filter saved successfully');
      setIsSaveDialogOpen(false);
      setFilterName('');
    },
    onError: (error: any) => {
      toast.error('Failed to save filter: ' + error.message);
    },
  });

  const deleteFilter = useMutation({
    mutationFn: async (filterId: string) => {
      const { data: currentPrefs } = await supabase
        .from('user_preferences')
        .select('saved_filters')
        .single();

      const existingSaved = ((currentPrefs?.saved_filters || {}) as unknown) as Record<string, SavedFilter[]>;
      const typeFilters = (existingSaved[filterType] || []).filter(
        (f: SavedFilter) => f.id !== filterId
      );

      const updated = {
        ...existingSaved,
        [filterType]: typeFilters,
      } as any;

      const { error } = await supabase
        .from('user_preferences')
        .update({ saved_filters: updated })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
      toast.success('Filter deleted');
    },
  });

  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Star className="h-4 w-4" />
            Saved Filters
            {savedFilters && savedFilters.length > 0 && (
              <span className="ml-1 text-xs">({savedFilters.length})</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Saved Filter Views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {savedFilters && savedFilters.length > 0 ? (
            savedFilters.map((filter) => (
              <div key={filter.id} className="flex items-center group">
                <DropdownMenuItem
                  className="flex-1 cursor-pointer"
                  onClick={() => onApplyFilter(filter.filters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {filter.name}
                </DropdownMenuItem>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFilter.mutate(filter.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No saved filters yet
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!hasActiveFilters}
          >
            <Save className="h-4 w-4" />
            Save Current
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter View</DialogTitle>
            <DialogDescription>
              Save your current filters for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., High Priority Invoices"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Current filters: {Object.keys(currentFilters).length} active
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveFilter.mutate()} disabled={!filterName}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
