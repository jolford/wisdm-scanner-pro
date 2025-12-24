import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface DraggableListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
}

/**
 * Drag-and-drop reorderable list component
 */
export function DraggableList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  className,
  itemClassName,
  disabled = false,
}: DraggableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
    dragNode.current = e.target as HTMLDivElement;
    
    // Set drag image
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }

    // Add a slight delay before adding dragging styles
    setTimeout(() => {
      setDragOverIndex(index);
    }, 0);
  }, [disabled]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragNode.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setDragOverIndex(index);
  }, [draggedIndex]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    onReorder(newItems);
    handleDragEnd();
  }, [draggedIndex, items, onReorder, handleDragEnd]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        const isDragging = draggedIndex === index;
        const isOver = dragOverIndex === index && draggedIndex !== index;
        const key = keyExtractor(item);

        return (
          <div
            key={key}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={handleDragEnter}
            onDrop={(e) => handleDrop(e, index)}
            className={cn(
              "group relative transition-all duration-200",
              isDragging && "opacity-50 scale-[0.98]",
              isOver && "ring-2 ring-primary ring-offset-2",
              !disabled && "cursor-grab active:cursor-grabbing",
              itemClassName
            )}
          >
            {!disabled && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {renderItem(item, index, isDragging)}
          </div>
        );
      })}
    </div>
  );
}

// Hook for managing draggable list state
export function useDraggableList<T>(initialItems: T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [hasChanges, setHasChanges] = useState(false);

  const handleReorder = useCallback((newItems: T[]) => {
    setItems(newItems);
    setHasChanges(true);
  }, []);

  const resetChanges = useCallback(() => {
    setItems(initialItems);
    setHasChanges(false);
  }, [initialItems]);

  return {
    items,
    setItems,
    hasChanges,
    handleReorder,
    resetChanges,
  };
}
