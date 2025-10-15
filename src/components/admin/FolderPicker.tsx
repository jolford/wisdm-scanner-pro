import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FolderOpen, ChevronRight, Home } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

export function FolderPicker({ value, onChange, disabled }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(value || '/exports/');
  const [customPath, setCustomPath] = useState(value || '/exports/');

  // Common folder suggestions
  const commonFolders = [
    '/exports/',
    '/exports/data/',
    '/exports/documents/',
    '/exports/images/',
    '/exports/csv/',
    '/exports/json/',
    '/exports/txt/',
    '/exports/archive/',
    '/documents/',
    '/data/',
  ];

  const handleSelect = (path: string) => {
    setCurrentPath(path);
    setCustomPath(path);
  };

  const handleConfirm = () => {
    onChange(customPath);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/exports/path/"
          disabled={disabled}
          className="flex-1"
        />
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            title="Browse folders"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </div>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Export Destination</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Common Folders</label>
            <ScrollArea className="h-[300px] rounded-md border p-2">
              <div className="space-y-1">
                {commonFolders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => handleSelect(folder)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      currentPath === folder
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <FolderOpen className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{folder}</span>
                    {currentPath === folder && <ChevronRight className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Custom Path</label>
            <div className="flex gap-2">
              <Input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="/custom/path/"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCustomPath('/exports/')}
                title="Reset to default"
              >
                <Home className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter a custom folder path or select from common folders above
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Select Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
