import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentThumbnailNavProps {
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
  thumbnails: (string | null)[];
  onGenerateThumbnail: (page: number) => Promise<string | null>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DocumentThumbnailNav = ({
  totalPages,
  currentPage,
  onPageSelect,
  thumbnails,
  onGenerateThumbnail,
  isCollapsed = false,
  onToggleCollapse
}: DocumentThumbnailNavProps) => {
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<number>>(new Set());

  // Lazy load thumbnails as they come into view
  useEffect(() => {
    const loadVisibleThumbnails = async () => {
      // Load current page and adjacent pages
      const pagesToLoad = [
        currentPage - 1,
        currentPage,
        currentPage + 1
      ].filter(p => p > 0 && p <= totalPages && !thumbnails[p - 1] && !loadingThumbnails.has(p));

      if (pagesToLoad.length === 0) return;

      const newLoading = new Set(loadingThumbnails);
      pagesToLoad.forEach(p => newLoading.add(p));
      setLoadingThumbnails(newLoading);

      await Promise.all(
        pagesToLoad.map(async (pageNum) => {
          await onGenerateThumbnail(pageNum);
          setLoadingThumbnails(prev => {
            const next = new Set(prev);
            next.delete(pageNum);
            return next;
          });
        })
      );
    };

    if (!isCollapsed) {
      loadVisibleThumbnails();
    }
  }, [currentPage, totalPages, isCollapsed]);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-muted/30 border-r flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mt-4 text-xs text-muted-foreground rotate-90 whitespace-nowrap">
          Pages
        </div>
      </div>
    );
  }

  return (
    <div className="w-48 bg-muted/30 border-r flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h4 className="text-sm font-semibold">Pages ({totalPages})</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const thumbnail = thumbnails[pageNum - 1];
            const isLoading = loadingThumbnails.has(pageNum);
            const isCurrent = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageSelect(pageNum)}
                className={cn(
                  "w-full p-2 rounded-lg border-2 transition-all hover:border-primary hover:shadow-md",
                  isCurrent
                    ? "border-primary bg-primary/10 shadow-lg"
                    : "border-border bg-background"
                )}
              >
                <div className="aspect-[8.5/11] bg-muted rounded overflow-hidden mb-1">
                  {isLoading ? (
                    <Skeleton className="w-full h-full" />
                  ) : thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={`Page ${pageNum}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      Page {pageNum}
                    </div>
                  )}
                </div>
                <div className={cn(
                  "text-xs font-medium text-center",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {pageNum}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
