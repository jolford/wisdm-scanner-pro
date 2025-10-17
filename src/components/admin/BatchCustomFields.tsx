import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export interface BatchField {
  name: string;
  value: string;
}

interface BatchCustomFieldsProps {
  fields: BatchField[];
  onChange: (fields: BatchField[]) => void;
  disabled?: boolean;
}

export function BatchCustomFields({ fields, onChange, disabled }: BatchCustomFieldsProps) {
  const addField = () => {
    onChange([...fields, { name: '', value: '' }]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: 'name' | 'value', value: string) => {
    const updated = [...fields];
    updated[index][key] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Batch Custom Fields</Label>
          <p className="text-sm text-muted-foreground">
            Add custom fields that will be included in all exports for this batch
          </p>
        </div>
        <Button type="button" size="sm" onClick={addField} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" />
          Add Field
        </Button>
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={index} className="p-4 bg-muted/30">
              <div className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`field-name-${index}`} className="text-xs mb-1">
                      Field Name
                    </Label>
                    <Input
                      id={`field-name-${index}`}
                      value={field.name}
                      onChange={(e) => updateField(index, 'name', e.target.value)}
                      placeholder="e.g., Department, Project Code"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`field-value-${index}`} className="text-xs mb-1">
                      Value
                    </Label>
                    <Input
                      id={`field-value-${index}`}
                      value={field.value}
                      onChange={(e) => updateField(index, 'value', e.target.value)}
                      placeholder="e.g., Finance, PRJ-2025"
                      disabled={disabled}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeField(index)}
                  disabled={disabled}
                  className="mt-6"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <Card className="p-6 text-center border-dashed">
          <p className="text-sm text-muted-foreground">
            No custom fields added. Click "Add Field" to create batch-level metadata.
          </p>
        </Card>
      )}
    </div>
  );
}