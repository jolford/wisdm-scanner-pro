import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FolderOpen, ChevronRight, Home, HardDrive } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

export function FolderPicker({ value, onChange, disabled }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(value || 'C:\\Exports\\');
  const [customPath, setCustomPath] = useState(value || 'C:\\Exports\\');
  const [pathType, setPathType] = useState<'windows' | 'unix'>('windows');

  // Windows path suggestions
  const windowsPaths = [
    'C:\\Exports\\',
    'C:\\Exports\\Data\\',
    'C:\\Exports\\Documents\\',
    'C:\\Exports\\Images\\',
    'C:\\Documents\\',
    'D:\\Exports\\',
    '\\\\NetworkDrive\\Shared\\',
    '\\\\NetworkDrive\\Shared\\Exports\\',
    '\\\\Server\\Documents\\',
  ];

  // Unix/Linux path suggestions
  const unixPaths = [
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

  const commonFolders = pathType === 'windows' ? windowsPaths : unixPaths;

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
      
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Export Destination</DialogTitle>
        </DialogHeader>
        
        <Tabs value={pathType} onValueChange={(v) => setPathType(v as 'windows' | 'unix')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="windows" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Windows Paths
            </TabsTrigger>
            <TabsTrigger value="unix" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Unix/Linux Paths
            </TabsTrigger>
          </TabsList>

          <TabsContent value="windows" className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Common Windows Paths</label>
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
                      <span className="flex-1 text-left font-mono text-xs">{folder}</span>
                      {currentPath === folder && <ChevronRight className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground mt-2">
                Use backslashes (\) for Windows paths. Network drives start with \\
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Custom Windows Path</label>
              <div className="flex gap-2">
                <Input
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="C:\Custom\Path\ or \\NetworkDrive\Path\"
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCustomPath('C:\\Exports\\')}
                  title="Reset to default"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="unix" className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Common Unix/Linux Paths</label>
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
                      <span className="flex-1 text-left font-mono text-xs">{folder}</span>
                      {currentPath === folder && <ChevronRight className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground mt-2">
                Use forward slashes (/) for Unix/Linux paths
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Custom Unix Path</label>
              <div className="flex gap-2">
                <Input
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/custom/path/"
                  className="font-mono text-sm"
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
            </div>
          </TabsContent>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Select Folder
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
