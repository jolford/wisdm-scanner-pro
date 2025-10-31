import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import invoiceIcon from '@/assets/project-icons/invoice.png';
import checkIcon from '@/assets/project-icons/check.png';
import purchaseOrderIcon from '@/assets/project-icons/purchase-order.png';
import contractIcon from '@/assets/project-icons/contract.png';
import receiptIcon from '@/assets/project-icons/receipt.png';
import formIcon from '@/assets/project-icons/form.png';
import mapIcon from '@/assets/project-icons/map.png';
import petitionIcon from '@/assets/project-icons/petition.png';

interface ProjectIconSelectorProps {
  selectedIcon: string;
  onIconSelect: (iconUrl: string) => void;
  onCustomUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
}

const preloadedIcons = [
  { name: 'Invoice', url: invoiceIcon, description: 'Invoice processing' },
  { name: 'Check', url: checkIcon, description: 'Check scanning' },
  { name: 'Purchase Order', url: purchaseOrderIcon, description: 'Purchase orders' },
  { name: 'Contract', url: contractIcon, description: 'Contracts & agreements' },
  { name: 'Receipt', url: receiptIcon, description: 'Receipts & expenses' },
  { name: 'Form', url: formIcon, description: 'Forms & applications' },
  { name: 'Map', url: mapIcon, description: 'Maps & locations' },
  { name: 'Petition', url: petitionIcon, description: 'Petitions & signatures' },
];

export function ProjectIconSelector({ 
  selectedIcon, 
  onIconSelect, 
  onCustomUpload,
  uploading 
}: ProjectIconSelectorProps) {
  const [showCustomUpload, setShowCustomUpload] = useState(false);

  const isPreloadedIcon = preloadedIcons.some(icon => icon.url === selectedIcon);

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
        {preloadedIcons.map((icon) => (
          <button
            key={icon.name}
            type="button"
            onClick={() => {
              onIconSelect(icon.url);
              setShowCustomUpload(false);
            }}
            className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:border-primary hover:shadow-md ${
              selectedIcon === icon.url
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card'
            }`}
            title={icon.description}
          >
            <img 
              src={icon.url} 
              alt={icon.name}
              className="h-12 w-12 object-contain"
            />
            <span className="text-xs font-medium text-center line-clamp-1">
              {icon.name}
            </span>
            {selectedIcon === icon.url && (
              <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xs">✓</span>
              </div>
            )}
          </button>
        ))}
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
