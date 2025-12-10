import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSignedUrl } from '@/hooks/use-signed-url';

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
      lookupEnabled?: boolean;
    }>;
  };
  keyField: string; // Which field to use as the lookup key (e.g., "Printed_Name")
  precomputedResults?: {
    validated: boolean;
    validatedAt?: string;
    totalItems: number;
    validCount: number;
    invalidCount: number;
    results: Array<{
      lineIndex: number;
      lineItem: Record<string, any>;
      found: boolean;
      matchScore: number;
      fieldResults: Array<{
        field: string;
        extractedValue: string;
        lookupValue: string | null;
        matches: boolean;
        score: number;
        suggestion: string | null;
      }>;
      bestMatch: Record<string, any> | null;
    }>;
  };
}

interface ValidationResult {
  index: number;
  keyValue: string;
  found: boolean;
  allMatch: boolean;
  matchScore?: number;
  validationResults?: Array<{
    field: string;
    excelValue: string;
    wisdmValue: string;
    matches: boolean;
    suggestion: string | null;
    score?: number;
  }>;
  message?: string;
}

export const LineItemValidation = ({ lineItems, lookupConfig, keyField, precomputedResults }: LineItemValidationProps) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [autoValidatedAt, setAutoValidatedAt] = useState<string | null>(null);
  const { toast } = useToast();

  // Load precomputed results if available
  useEffect(() => {
    if (precomputedResults?.validated && precomputedResults.results?.length > 0) {
      const converted: ValidationResult[] = precomputedResults.results.map((r) => ({
        index: r.lineIndex,
        keyValue: r.lineItem[keyField] || r.lineItem[keyField.toLowerCase()] || `Row ${r.lineIndex + 1}`,
        found: r.found,
        allMatch: r.found && r.matchScore >= 0.9,
        matchScore: r.matchScore,
        validationResults: r.fieldResults.map((fr) => ({
          field: fr.field,
          excelValue: fr.lookupValue || '',
          wisdmValue: fr.extractedValue || '',
          matches: fr.matches,
          suggestion: fr.suggestion,
          score: fr.score,
        })),
        message: r.found 
          ? `Match score: ${Math.round(r.matchScore * 100)}%` 
          : 'Not found in voter registry',
      }));
      
      setValidationResults(converted);
      setAutoValidatedAt(precomputedResults.validatedAt || null);
    }
  }, [precomputedResults, keyField]);

  const validateAllLineItems = async () => {
    if (!lookupConfig.excelFileUrl) {
      toast({
        title: 'Configuration incomplete',
        description: 'Please configure CSV/Excel validation in project settings',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    const results: ValidationResult[] = [];

    try {
      // Find the key column from lookupFields
      const keyColumn = lookupConfig.excelKeyColumn || 
        lookupConfig.lookupFields?.find(f => 
          f.wisdmField.toLowerCase() === keyField.toLowerCase()
        )?.ecmField;

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
          .filter(f => f.enabled !== false && f.lookupEnabled !== false)
          .map(f => ({
            ...f,
            wisdmValue: lineItem[f.wisdmField] || lineItem[f.wisdmField.toLowerCase()] || '',
          }));

        // Call validate-excel-lookup with a signed URL (works for private buckets)
        const signedUrl = await getSignedUrl(lookupConfig.excelFileUrl);
        const { data, error } = await supabase.functions.invoke('validate-excel-lookup', {
          body: {
            fileUrl: signedUrl,
            keyColumn: keyColumn || keyField,
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
      setAutoValidatedAt(null); // Clear auto-validation timestamp since this is manual

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

  const foundCount = validationResults.filter(r => r.found).length;
  const matchCount = validationResults.filter(r => r.allMatch).length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Voter Registry Validation</h3>
          <p className="text-sm text-muted-foreground">
            {validationResults.length > 0 ? (
              <>
                {foundCount}/{lineItems.length} found, {matchCount} fully matched
                {autoValidatedAt && (
                  <span className="ml-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Auto-validated
                  </span>
                )}
              </>
            ) : (
              `Validate ${lineItems.length} signer(s) against ${lookupConfig.system === 'csv' ? 'CSV' : 'Excel'} registry`
            )}
          </p>
        </div>
        <Button
          onClick={validateAllLineItems}
          disabled={isValidating || !lookupConfig.excelFileUrl}
          variant={validationResults.length > 0 ? 'outline' : 'default'}
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : validationResults.length > 0 ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-validate
            </>
          ) : (
            `Validate All ${lineItems.length} Items`
          )}
        </Button>
      </div>

      {/* Summary badges */}
      {validationResults.length > 0 && (
        <div className="flex gap-2 mb-4">
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {matchCount} Valid
          </Badge>
          {foundCount - matchCount > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              <AlertCircle className="h-3 w-3 mr-1" />
              {foundCount - matchCount} Mismatch
            </Badge>
          )}
          {lineItems.length - foundCount > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              <XCircle className="h-3 w-3 mr-1" />
              {lineItems.length - foundCount} Not Found
            </Badge>
          )}
        </div>
      )}

      {validationResults.length > 0 && (
        <div className="space-y-4">
          {validationResults.map((result, idx) => (
            <Card key={idx} className="p-4 bg-muted/30">
              <div className="flex items-start gap-4">
                <div className="mt-1">{getStatusIcon(result)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold text-base">
                      Row {result.index + 1}: {result.keyValue}
                    </span>
                    {getStatusBadge(result)}
                    {result.matchScore !== undefined && result.found && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(result.matchScore * 100)}% match
                      </span>
                    )}
                  </div>

                  {result.message && (
                    <p className="text-sm text-muted-foreground mb-3">{result.message}</p>
                  )}

                  {result.validationResults && result.validationResults.length > 0 && (
                    <div className="space-y-3 mt-3">
                      {result.validationResults.map((fieldResult, fieldIdx) => (
                        <div
                          key={fieldIdx}
                          className={`text-sm p-4 rounded-md border ${
                            fieldResult.matches
                              ? 'bg-success/10 border-success/20'
                              : 'bg-warning/10 border-warning/20'
                          }`}
                        >
                          <div className="font-semibold mb-3 text-foreground flex items-center justify-between">
                            <span>{fieldResult.field}</span>
                            {fieldResult.score !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                {Math.round(fieldResult.score * 100)}%
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide opacity-60">Document Value</span>
                              <span className="font-medium">{fieldResult.wisdmValue || '(empty)'}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide opacity-60">Registry Value</span>
                              <span className="font-medium">{fieldResult.excelValue || '(empty)'}</span>
                            </div>
                          </div>
                          {!fieldResult.matches && fieldResult.suggestion && (
                            <div className="mt-3 pt-3 border-t border-border/30">
                              <span className="text-xs font-medium uppercase tracking-wide opacity-60">Suggestion: </span>
                              <span className="font-semibold text-foreground">{fieldResult.suggestion}</span>
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