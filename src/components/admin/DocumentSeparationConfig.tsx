import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface SeparationConfig {
  method: 'none' | 'barcode' | 'blank_page' | 'page_count';
  barcodePatterns?: string[];
  blankPageThreshold?: number;
  pagesPerDocument?: number;
}

interface DocumentSeparationConfigProps {
  config: SeparationConfig;
  onConfigChange: (config: SeparationConfig) => void;
  disabled?: boolean;
}

export function DocumentSeparationConfig({
  config,
  onConfigChange,
  disabled = false
}: DocumentSeparationConfigProps) {
  const [patterns, setPatterns] = useState<string[]>(config.barcodePatterns || ['SEPARATOR', 'DIVIDER']);

  useEffect(() => {
    if (config.barcodePatterns) {
      setPatterns(config.barcodePatterns);
    }
  }, [config.barcodePatterns]);

  const handleMethodChange = (method: string) => {
    onConfigChange({
      ...config,
      method: method as SeparationConfig['method']
    });
  };

  const addPattern = () => {
    const newPatterns = [...patterns, ''];
    setPatterns(newPatterns);
    onConfigChange({
      ...config,
      barcodePatterns: newPatterns
    });
  };

  const removePattern = (index: number) => {
    const newPatterns = patterns.filter((_, i) => i !== index);
    setPatterns(newPatterns);
    onConfigChange({
      ...config,
      barcodePatterns: newPatterns
    });
  };

  const updatePattern = (index: number, value: string) => {
    const newPatterns = [...patterns];
    newPatterns[index] = value;
    setPatterns(newPatterns);
    onConfigChange({
      ...config,
      barcodePatterns: newPatterns
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Document Separation</p>
          <p>Configure how multi-page PDFs are split into individual documents. This is useful when scanning batches of documents that need to be processed separately.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="separation-method" className="mb-2 block">
          Separation Method
        </Label>
        <Select
          value={config.method}
          onValueChange={handleMethodChange}
          disabled={disabled}
        >
          <SelectTrigger id="separation-method">
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="none">No Separation (Single Document)</SelectItem>
            <SelectItem value="blank_page">Blank Page Detection</SelectItem>
            <SelectItem value="barcode">Barcode/Separator Sheet</SelectItem>
            <SelectItem value="page_count">Fixed Page Count</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Choose how to identify document boundaries in multi-page PDFs
        </p>
      </div>

      {config.method === 'barcode' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Separator Patterns</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addPattern}
              disabled={disabled}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Pattern
            </Button>
          </div>
          <div className="space-y-2">
            {patterns.map((pattern, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={pattern}
                  onChange={(e) => updatePattern(index, e.target.value)}
                  placeholder="e.g., SEPARATOR, BARCODE-*, DIVIDER"
                  disabled={disabled}
                  className="flex-1"
                />
                {patterns.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removePattern(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Text patterns to look for on separator sheets. Pages containing these patterns will be used as document boundaries.
          </p>
        </div>
      )}

      {config.method === 'blank_page' && (
        <div>
          <Label htmlFor="blank-threshold" className="mb-2 block">
            Blank Page Threshold (%)
          </Label>
          <Input
            id="blank-threshold"
            type="number"
            min="50"
            max="100"
            value={config.blankPageThreshold || 95}
            onChange={(e) => onConfigChange({
              ...config,
              blankPageThreshold: parseInt(e.target.value) || 95
            })}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Percentage of white space required to consider a page blank (90-99% recommended)
          </p>
        </div>
      )}

      {config.method === 'page_count' && (
        <div>
          <Label htmlFor="pages-per-doc" className="mb-2 block">
            Pages Per Document
          </Label>
          <Input
            id="pages-per-doc"
            type="number"
            min="1"
            max="100"
            value={config.pagesPerDocument || 1}
            onChange={(e) => onConfigChange({
              ...config,
              pagesPerDocument: parseInt(e.target.value) || 1
            })}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Number of pages to include in each separated document
          </p>
        </div>
      )}

      {config.method !== 'none' && (
        <Card className="p-4 bg-muted/30">
          <h4 className="font-medium mb-2 text-sm">How it works:</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {config.method === 'barcode' && (
              <>
                <li>Scans each page for separator patterns</li>
                <li>Creates new document when pattern is found</li>
                <li>Separator pages are excluded from final documents</li>
              </>
            )}
            {config.method === 'blank_page' && (
              <>
                <li>Analyzes page content and whitespace</li>
                <li>Identifies pages with minimal text as separators</li>
                <li>Blank pages are excluded from final documents</li>
              </>
            )}
            {config.method === 'page_count' && (
              <>
                <li>Splits PDF into fixed-size chunks</li>
                <li>Each document contains the specified number of pages</li>
                <li>Last document may have fewer pages</li>
              </>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
