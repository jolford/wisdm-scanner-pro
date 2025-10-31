import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export interface TableExtractionField {
  name: string;
  description: string;
}

export interface TableExtractionConfig {
  enabled: boolean;
  fields: TableExtractionField[];
}

interface TableExtractionConfigProps {
  config: TableExtractionConfig;
  onConfigChange: (config: TableExtractionConfig) => void;
}

export const TableExtractionConfig = ({ config, onConfigChange }: TableExtractionConfigProps) => {
  const addField = () => {
    onConfigChange({
      ...config,
      fields: [...config.fields, { name: '', description: '' }],
    });
  };

  const removeField = (index: number) => {
    onConfigChange({
      ...config,
      fields: config.fields.filter((_, i) => i !== index),
    });
  };

  const updateField = (index: number, updates: Partial<TableExtractionField>) => {
    onConfigChange({
      ...config,
      fields: config.fields.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    });
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...config.fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    onConfigChange({ ...config, fields: newFields });
  };

  const moveFieldDown = (index: number) => {
    if (index === config.fields.length - 1) return;
    const newFields = [...config.fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    onConfigChange({ ...config, fields: newFields });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => onConfigChange({ ...config, enabled: checked })}
          />
          <Label className="text-base font-semibold">Enable Table Extraction</Label>
        </div>
      </div>

      {config.enabled && (
        <>
          <p className="text-sm text-muted-foreground">
            Configure columns to extract from repeating tables (e.g., petition signer rows, invoice line items, form grids).
          </p>

          <div className="flex justify-between items-center">
            <Label>Table Column Fields</Label>
            <Button type="button" size="sm" onClick={addField}>
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          </div>

          <div className="space-y-3">
            {config.fields.map((field, index) => (
              <Card key={index} className="p-4 bg-muted/30">
                <div className="flex gap-3">
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveFieldUp(index)}
                      disabled={index === 0}
                      className="h-8 w-8"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveFieldDown(index)}
                      disabled={index === config.fields.length - 1}
                      className="h-8 w-8"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <Label htmlFor={`table-field-name-${index}`} className="text-xs">
                        Column Name *
                      </Label>
                      <Input
                        id={`table-field-name-${index}`}
                        value={field.name}
                        onChange={(e) => updateField(index, { name: e.target.value })}
                        placeholder="e.g., Product Description, Quantity, Unit Price, Total"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`table-field-desc-${index}`} className="text-xs">
                        Description (helps AI understand what to extract)
                      </Label>
                      <Input
                        id={`table-field-desc-${index}`}
                        value={field.description}
                        onChange={(e) => updateField(index, { description: e.target.value })}
                        placeholder="e.g., Product or service name, Quantity ordered, Price per unit"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {config.fields.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                No table fields configured. Click "Add Field" to define columns to extract from line item tables.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
