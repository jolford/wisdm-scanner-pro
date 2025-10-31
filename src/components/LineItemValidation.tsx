import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LineItemValidationProps {
  lineItems: Array<Record<string, any>>;
  lookupConfig: {
    system: string;
    excelFileUrl?: string;
    excelKeyColumn?: string;
    lookupFields?: Array<{
      wisdmField: string;
      ecmField: string;
      enabled?: boolean;
    }>;
  };
  keyField: string; // Which field to use as the lookup key (e.g., "Printed_Name")
}

interface ValidationResult {
  index: number;
  keyValue: string;
  found: boolean;
  allMatch: boolean;
  validationResults?: Array<{
    field: string;
    excelValue: string;
    wisdmValue: string;
    matches: boolean;
    suggestion: string | null;
  }>;
  message?: string;
}

export const LineItemValidation = ({ lineItems, lookupConfig, keyField }: LineItemValidationProps) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const validateAllLineItems = async () => {
    if (!lookupConfig.excelFileUrl || !lookupConfig.excelKeyColumn) {
      toast({
        title: 'Configuration incomplete',
        description: 'Please configure Excel/CSV validation in project settings',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    const results: ValidationResult[] = [];

    try {
      for (let i = 0; i < lineItems.length; i++) {
        const lineItem = lineItems[i];
        const keyValue = lineItem[keyField] || lineItem[keyField.toLowerCase()] || '';

        if (!keyValue) {
          results.push({
            index: i,
            keyValue: '(empty)',
            found: false,
            allMatch: false,
            message: `No value for ${keyField}`,
          });
          continue;
        }

        // Build lookup fields with values from this line item
        const lookupFields = (lookupConfig.lookupFields || [])
          .filter(f => f.enabled !== false)
          .map(f => ({
            ...f,
            wisdmValue: lineItem[f.wisdmField] || lineItem[f.wisdmField.toLowerCase()] || '',
          }));

        // Call validate-excel-lookup
        const { data, error } = await supabase.functions.invoke('validate-excel-lookup', {
          body: {
            fileUrl: lookupConfig.excelFileUrl,
            keyColumn: lookupConfig.excelKeyColumn,
            keyValue: keyValue,
            lookupFields: lookupFields,
          },
        });

        if (error) {
          console.error(`Validation error for row ${i}:`, error);
          results.push({
            index: i,
            keyValue: String(keyValue),
            found: false,
            allMatch: false,
            message: error.message || 'Validation failed',
          });
          continue;
        }

        results.push({
          index: i,
          keyValue: String(keyValue),
          found: data.found,
          allMatch: data.allMatch,
          validationResults: data.validationResults,
          message: data.message,
        });
      }

      setValidationResults(results);

      const foundCount = results.filter(r => r.found).length;
      const matchCount = results.filter(r => r.allMatch).length;

      toast({
        title: 'Line item validation complete',
        description: `${foundCount}/${results.length} found in registry, ${matchCount}/${foundCount} fully matched`,
      });
    } catch (error: any) {
      console.error('Line item validation error:', error);
      toast({
        title: 'Validation failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = (result: ValidationResult) => {
    if (!result.found) {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (result.allMatch) {
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
    return <AlertCircle className="h-5 w-5 text-warning" />;
  };

  const getStatusBadge = (result: ValidationResult) => {
    if (!result.found) {
      return <Badge variant="destructive">Not Found</Badge>;
    }
    if (result.allMatch) {
      return <Badge variant="default" className="bg-success">Valid</Badge>;
    }
    return <Badge variant="secondary" className="bg-warning">Mismatch</Badge>;
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Line Item Validation</h3>
          <p className="text-sm text-muted-foreground">
            Validate {lineItems.length} signer(s) against {lookupConfig.system === 'csv' ? 'CSV' : 'Excel'} registry
          </p>
        </div>
        <Button
          onClick={validateAllLineItems}
          disabled={isValidating || !lookupConfig.excelFileUrl}
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            `Validate All ${lineItems.length} Items`
          )}
        </Button>
      </div>

      {validationResults.length > 0 && (
        <div className="space-y-3">
          {validationResults.map((result, idx) => (
            <Card key={idx} className="p-3 bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon(result)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">
                      Row {result.index + 1}: {result.keyValue}
                    </span>
                    {getStatusBadge(result)}
                  </div>

                  {result.message && (
                    <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                  )}

                  {result.validationResults && result.validationResults.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {result.validationResults.map((fieldResult, fieldIdx) => (
                        <div
                          key={fieldIdx}
                          className={`text-xs p-2 rounded ${
                            fieldResult.matches
                              ? 'bg-success/10 text-success-foreground'
                              : 'bg-warning/10 text-warning-foreground'
                          }`}
                        >
                          <div className="font-medium">{fieldResult.field}</div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <span className="opacity-70">Document: </span>
                              <span>{fieldResult.wisdmValue || '(empty)'}</span>
                            </div>
                            <div>
                              <span className="opacity-70">Registry: </span>
                              <span>{fieldResult.excelValue || '(empty)'}</span>
                            </div>
                          </div>
                          {!fieldResult.matches && fieldResult.suggestion && (
                            <div className="mt-1 text-xs">
                              <span className="opacity-70">Suggestion: </span>
                              <span className="font-medium">{fieldResult.suggestion}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {validationResults.length === 0 && !isValidating && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Click "Validate All" to check each signer against the registry</p>
        </div>
      )}
    </Card>
  );
};
