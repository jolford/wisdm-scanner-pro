import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Folder, Star, Bookmark, Briefcase, Layers, Box, Grid3x3, Package } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface ProjectIconSelectorProps {
  selectedIcon: string;
  onIconSelect: (iconUrl: string) => void;
  onCustomUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
}

const preloadedIcons: { name: string; icon: LucideIcon; id: string; description: string }[] = [
  { name: 'Folder', icon: Folder, id: 'folder', description: 'General projects' },
  { name: 'Star', icon: Star, id: 'star', description: 'Featured projects' },
  { name: 'Bookmark', icon: Bookmark, id: 'bookmark', description: 'Saved items' },
  { name: 'Briefcase', icon: Briefcase, id: 'briefcase', description: 'Business projects' },
  { name: 'Layers', icon: Layers, id: 'layers', description: 'Multi-part projects' },
  { name: 'Box', icon: Box, id: 'box', description: 'Archive projects' },
  { name: 'Grid', icon: Grid3x3, id: 'grid', description: 'Organized projects' },
  { name: 'Package', icon: Package, id: 'package', description: 'Packaged projects' },
];

export function ProjectIconSelector({ 
  selectedIcon, 
  onIconSelect, 
  onCustomUpload,
  uploading 
}: ProjectIconSelectorProps) {
  const [showCustomUpload, setShowCustomUpload] = useState(false);

  const isPreloadedIcon = preloadedIcons.some(icon => icon.id === selectedIcon);

  return (
    <div className="space-y-4">
      <div>
        <Label>Project Icon (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Choose a preloaded icon or upload your own
        </p>
      </div>

      {/* Preloaded Icons Grid */}
      <div className="grid grid-cols-4 gap-3">
        {preloadedIcons.map((iconItem) => {
          const IconComponent = iconItem.icon;
          return (
            <button
              key={iconItem.id}
              type="button"
              onClick={() => {
                onIconSelect(iconItem.id);
                setShowCustomUpload(false);
              }}
              className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:border-primary hover:shadow-md ${
                selectedIcon === iconItem.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border bg-card'
              }`}
              title={iconItem.description}
            >
              <IconComponent className="h-12 w-12 text-foreground" />
              <span className="text-xs font-medium text-center line-clamp-1">
                {iconItem.name}
              </span>
              {selectedIcon === iconItem.id && (
                <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-xs">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Upload Section */}
      <div className="pt-3 border-t">
        {!showCustomUpload && !selectedIcon || (selectedIcon && isPreloadedIcon) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCustomUpload(true)}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Custom Icon
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {selectedIcon && !isPreloadedIcon && (
                <div className="relative">
                  <img 
                    src={selectedIcon} 
                    alt="Custom icon" 
                    className="h-16 w-16 object-contain rounded border-2 border-primary"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                    onClick={() => {
                      onIconSelect('');
                      setShowCustomUpload(false);
                    }}
                  >
                    ×
                  </Button>
                </div>
              )}
              <div className="flex-1">
                <Label htmlFor="custom-icon" className="text-sm">Custom Icon</Label>
                <Input
                  id="custom-icon"
                  type="file"
                  accept="image/*"
                  onChange={onCustomUpload}
                  disabled={uploading}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, or WEBP • Max 2MB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCustomUpload(false);
                onIconSelect('');
              }}
              className="w-full"
            >
              Cancel Custom Upload
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
